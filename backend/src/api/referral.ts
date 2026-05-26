import { Router } from 'express';
import { prisma } from '../index';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { payoutSol } from '../services/payoutService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jetforge-secret-change-in-prod';

// ── Thresholds ────────────────────────────────────────────────────────────────
// Minimum balance required before a user can withdraw / claim.
// Keeps a single payout > tx fee (~0.000005 SOL) — fee is absorbed by treasury.
const MIN_REFERRAL_WITHDRAWAL = 0.1;   // SOL — referrer earnings
const MIN_CASHBACK_CLAIM      = 0.05;  // SOL — referred-user cashback
const WITHDRAWAL_COOLDOWN_MS  = 24 * 60 * 60 * 1000; // 24 h between withdrawals

function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    req.walletFromToken = payload.wallet;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/referral/code  — get or create referral account for authenticated user
// ─────────────────────────────────────────────────────────────────────────────
router.get('/code', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    let account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) {
      let code = nanoid(8);
      while (await prisma.referralAccount.findUnique({ where: { referralCode: code } })) {
        code = nanoid(8);
      }
      account = await prisma.referralAccount.create({
        data: { wallet, referralCode: code },
      });
    }
    res.json(account);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/referral/stats/:wallet  — public stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) return res.json({ totalEarned: 0, totalReferrals: 0, hasReferralAccount: false });
    res.json({
      totalEarned: account.totalEarned,
      totalReferrals: account.totalReferrals,
      hasReferralAccount: true,
      referralCode: account.referralCode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/referral/dashboard  — private dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) return res.json({
      pendingBalance: 0, totalEarned: 0, totalReferrals: 0,
      canWithdraw: false, referralCode: null,
      minWithdrawal: MIN_REFERRAL_WITHDRAWAL,
    });

    const cooldownOk = !account.lastWithdrawnAt ||
      Date.now() - account.lastWithdrawnAt.getTime() > WITHDRAWAL_COOLDOWN_MS;
    const canWithdraw = account.pendingBalance >= MIN_REFERRAL_WITHDRAWAL && cooldownOk;

    res.json({
      ...account,
      canWithdraw,
      minWithdrawal: MIN_REFERRAL_WITHDRAWAL,
      referralLink: `https://jetforge.io/r/${account.referralCode}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/referral/register  — called when new user visits via referral link
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { referralCode, visitorWallet } = req.body;
    if (!referralCode || !visitorWallet) return res.status(400).json({ error: 'Missing fields' });

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(visitorWallet)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const existing = await prisma.referralLink.findUnique({ where: { referredWallet: visitorWallet } });
    if (existing) return res.json({ ok: true, alreadyRegistered: true });

    const account = await prisma.referralAccount.findUnique({ where: { referralCode } });
    if (!account) return res.status(404).json({ error: 'Invalid referral code' });

    if (account.wallet === visitorWallet) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    const circularCheck = await prisma.referralLink.findUnique({ where: { referredWallet: account.wallet } });
    if (circularCheck && circularCheck.referrerWallet === visitorWallet) {
      return res.status(400).json({ error: 'Circular referral not allowed' });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReferrals = await prisma.referralLink.count({
      where: { referrerWallet: account.wallet, createdAt: { gte: oneDayAgo } },
    });
    if (recentReferrals >= 50) {
      return res.status(429).json({ error: 'Too many referrals today. Try again tomorrow.' });
    }

    await prisma.referralLink.create({
      data: { referredWallet: visitorWallet, referrerWallet: account.wallet },
    });
    await prisma.referralAccount.update({
      where: { wallet: account.wallet },
      data: { totalReferrals: { increment: 1 } },
    });

    res.json({ ok: true, referrerWallet: account.wallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/referral/withdraw  — referrer claims earnings
//
// Flow:
//   1. Validate balance >= MIN_REFERRAL_WITHDRAWAL and cooldown elapsed
//   2. Send SOL on-chain from treasury → user wallet (REAL transfer)
//   3. Only if transfer succeeds: zero pendingBalance in DB
//   4. Return tx signature so user can verify on-chain
//
// If the on-chain transfer fails, the DB is NOT modified — the user keeps
// their balance and can retry.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/withdraw', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) return res.status(404).json({ error: 'No referral account' });

    if (account.pendingBalance < MIN_REFERRAL_WITHDRAWAL) {
      return res.status(400).json({
        error: `Minimum withdrawal is ${MIN_REFERRAL_WITHDRAWAL} SOL. ` +
          `You have ${account.pendingBalance.toFixed(4)} SOL — ` +
          `need ${(MIN_REFERRAL_WITHDRAWAL - account.pendingBalance).toFixed(4)} more.`,
        pendingBalance: account.pendingBalance,
        minWithdrawal: MIN_REFERRAL_WITHDRAWAL,
      });
    }

    if (account.lastWithdrawnAt &&
        Date.now() - account.lastWithdrawnAt.getTime() < WITHDRAWAL_COOLDOWN_MS) {
      const nextAt = new Date(account.lastWithdrawnAt.getTime() + WITHDRAWAL_COOLDOWN_MS);
      return res.status(400).json({
        error: `Withdrawal cooldown active. Next withdrawal available at ${nextAt.toISOString()}`,
      });
    }

    const amount = account.pendingBalance;

    // ── Step 1: Send SOL on-chain ─────────────────────────────────────────────
    // This throws if treasury is misconfigured, underfunded, or tx fails.
    // DB is NOT modified until this succeeds.
    let txSig: string;
    try {
      txSig = await payoutSol(wallet, amount);
    } catch (payErr: any) {
      console.error(`[referral] Payout failed for ${wallet.slice(0, 8)}…:`, payErr.message);
      return res.status(500).json({
        error: 'Payout failed — your balance has NOT been deducted. Please try again.',
        detail: payErr.message,
      });
    }

    // ── Step 2: Payout confirmed — now update DB ──────────────────────────────
    await prisma.referralAccount.update({
      where: { wallet },
      data: { pendingBalance: 0, lastWithdrawnAt: new Date() },
    });

    console.log(`[referral] Withdrawal complete: ${wallet.slice(0, 8)}… ${amount.toFixed(4)} SOL tx=${txSig}`);
    res.json({
      ok: true,
      amount,
      txSig,
      message: `${amount.toFixed(4)} SOL sent to your wallet!`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/referral/cashback  — referred user's cashback balance
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cashback', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const link = await (prisma as any).referralLink.findUnique({ where: { referredWallet: wallet } });
    if (!link) return res.json({
      cashbackBalance: 0, cashbackEarned: 0, active: false,
      daysRemaining: 0, canClaim: false, minClaim: MIN_CASHBACK_CLAIM,
    });

    const daysSince = (Date.now() - new Date(link.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, 30 - Math.floor(daysSince));
    const active = daysRemaining > 0;
    const canClaim = link.cashbackBalance >= MIN_CASHBACK_CLAIM;

    res.json({
      cashbackBalance: link.cashbackBalance,
      cashbackEarned: link.cashbackEarned,
      active,
      daysRemaining,
      canClaim,
      minClaim: MIN_CASHBACK_CLAIM,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/referral/cashback/claim  — referred user claims cashback
//
// Same flow as /withdraw above:
//   1. Validate balance >= MIN_CASHBACK_CLAIM
//   2. Send SOL on-chain (REAL transfer)
//   3. Zero cashbackBalance only after on-chain success
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cashback/claim', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const link = await (prisma as any).referralLink.findUnique({ where: { referredWallet: wallet } });
    if (!link) return res.status(404).json({ error: 'No cashback account' });

    if (link.cashbackBalance < MIN_CASHBACK_CLAIM) {
      return res.status(400).json({
        error: `Minimum claim is ${MIN_CASHBACK_CLAIM} SOL. ` +
          `You have ${link.cashbackBalance.toFixed(4)} SOL — ` +
          `need ${(MIN_CASHBACK_CLAIM - link.cashbackBalance).toFixed(4)} more.`,
        cashbackBalance: link.cashbackBalance,
        minClaim: MIN_CASHBACK_CLAIM,
      });
    }

    const amount = link.cashbackBalance;

    // ── Step 1: Send SOL on-chain ─────────────────────────────────────────────
    let txSig: string;
    try {
      txSig = await payoutSol(wallet, amount);
    } catch (payErr: any) {
      console.error(`[cashback] Payout failed for ${wallet.slice(0, 8)}…:`, payErr.message);
      return res.status(500).json({
        error: 'Payout failed — your balance has NOT been deducted. Please try again.',
        detail: payErr.message,
      });
    }

    // ── Step 2: Payout confirmed — now update DB ──────────────────────────────
    await (prisma as any).referralLink.update({
      where: { referredWallet: wallet },
      data: { cashbackBalance: 0 },
    });

    console.log(`[cashback] Claim complete: ${wallet.slice(0, 8)}… ${amount.toFixed(4)} SOL tx=${txSig}`);
    res.json({
      ok: true,
      amount,
      txSig,
      message: `${amount.toFixed(4)} SOL cashback sent to your wallet!`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
