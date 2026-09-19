import { Router } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { payoutSol } from '../services/payoutService';
import { secrets } from '../config';

const router = Router();
const JWT_SECRET = secrets.jwtSecret;

// ── Thresholds ────────────────────────────────────────────────────────────────
const MIN_REFERRAL_WITHDRAWAL = 0.1;   // SOL — referrer earnings
const MIN_CASHBACK_CLAIM      = 0.05;  // SOL — referred-user cashback
const WITHDRAWAL_COOLDOWN_MS  = 24 * 60 * 60 * 1000; // 24 h between withdrawals

// Per-wallet in-flight guard: prevents a second payout attempt for the same
// wallet from even starting while one is running. The authoritative protection
// is the atomic compare-and-set debit below; this just avoids wasted work.
const inFlight = new Set<string>();

const num = (d: Prisma.Decimal | number | null | undefined): number =>
  d == null ? 0 : (typeof d === 'number' ? d : d.toNumber());

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

// GET /api/referral/code
router.get('/code', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    let account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) {
      let code = nanoid(8);
      while (await prisma.referralAccount.findUnique({ where: { referralCode: code } })) {
        code = nanoid(8);
      }
      account = await prisma.referralAccount.create({ data: { wallet, referralCode: code } });
    }
    res.json({ ...account, pendingBalance: num(account.pendingBalance), totalEarned: num(account.totalEarned) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referral/stats/:wallet
router.get('/stats/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) return res.json({ totalEarned: 0, totalReferrals: 0, hasReferralAccount: false });
    res.json({
      totalEarned: num(account.totalEarned),
      totalReferrals: account.totalReferrals,
      hasReferralAccount: true,
      referralCode: account.referralCode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referral/dashboard
router.get('/dashboard', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) return res.json({
      pendingBalance: 0, totalEarned: 0, totalReferrals: 0,
      canWithdraw: false, referralCode: null,
      minWithdrawal: MIN_REFERRAL_WITHDRAWAL,
    });

    const pendingBalance = num(account.pendingBalance);
    const cooldownOk = !account.lastWithdrawnAt ||
      Date.now() - account.lastWithdrawnAt.getTime() > WITHDRAWAL_COOLDOWN_MS;
    const canWithdraw = pendingBalance >= MIN_REFERRAL_WITHDRAWAL && cooldownOk;

    res.json({
      ...account,
      pendingBalance,
      totalEarned: num(account.totalEarned),
      canWithdraw,
      minWithdrawal: MIN_REFERRAL_WITHDRAWAL,
      referralLink: `https://jetforge.io/r/${account.referralCode}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referral/register
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

// POST /api/referral/withdraw  — referrer claims earnings
//
// Safe payout flow (prevents the concurrent double-withdraw race):
//   1. Atomic compare-and-set: debit pendingBalance to 0 ONLY if it still equals
//      the amount we read AND the cooldown has elapsed, and create a PENDING
//      Payout row — all in one transaction. A second concurrent request finds
//      pendingBalance already changed, matches no row, and is rejected.
//   2. Send SOL on-chain for exactly the debited amount.
//   3. Mark the Payout COMPLETED (success) or refund the balance + mark FAILED.
router.post('/withdraw', requireAuth, async (req: any, res) => {
  const { walletFromToken: wallet } = req;
  if (inFlight.has(wallet)) {
    return res.status(409).json({ error: 'A withdrawal is already in progress. Please wait.' });
  }
  inFlight.add(wallet);
  try {
    const account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) return res.status(404).json({ error: 'No referral account' });

    const balance = new Prisma.Decimal(account.pendingBalance);
    if (balance.lessThan(MIN_REFERRAL_WITHDRAWAL)) {
      return res.status(400).json({
        error: `Minimum withdrawal is ${MIN_REFERRAL_WITHDRAWAL} SOL. You have ${num(balance).toFixed(4)} SOL.`,
        pendingBalance: num(balance),
        minWithdrawal: MIN_REFERRAL_WITHDRAWAL,
      });
    }

    const cutoff = new Date(Date.now() - WITHDRAWAL_COOLDOWN_MS);
    if (account.lastWithdrawnAt && account.lastWithdrawnAt > cutoff) {
      const nextAt = new Date(account.lastWithdrawnAt.getTime() + WITHDRAWAL_COOLDOWN_MS);
      return res.status(400).json({ error: `Withdrawal cooldown active. Next available at ${nextAt.toISOString()}` });
    }

    const prevLastWithdrawnAt = account.lastWithdrawnAt;

    // ── Step 1: atomic debit + PENDING ledger row ────────────────────────────
    let payoutId: string;
    try {
      payoutId = await prisma.$transaction(async (tx) => {
        const upd = await tx.referralAccount.updateMany({
          where: {
            wallet,
            pendingBalance: balance,          // compare-and-set guard
            OR: [{ lastWithdrawnAt: null }, { lastWithdrawnAt: { lte: cutoff } }],
          },
          data: { pendingBalance: 0, lastWithdrawnAt: new Date() },
        });
        if (upd.count !== 1) throw new Error('CONFLICT');
        const payout = await tx.payout.create({
          data: { wallet, kind: 'REFERRAL', amountSol: balance, status: 'PENDING' },
        });
        return payout.id;
      });
    } catch (e: any) {
      if (e.message === 'CONFLICT') {
        return res.status(409).json({ error: 'Balance changed — please refresh and try again.' });
      }
      throw e;
    }

    // ── Step 2: on-chain transfer ─────────────────────────────────────────────
    const amount = num(balance);
    let txSig: string;
    try {
      txSig = await payoutSol(wallet, amount);
    } catch (payErr: any) {
      // Refund: restore balance + prior cooldown, mark payout FAILED.
      await prisma.$transaction([
        prisma.referralAccount.update({
          where: { wallet },
          data: { pendingBalance: { increment: balance }, lastWithdrawnAt: prevLastWithdrawnAt },
        }),
        prisma.payout.update({
          where: { id: payoutId },
          data: { status: 'FAILED', error: String(payErr.message).slice(0, 400) },
        }),
      ]);
      console.error(`[referral] Payout failed for ${wallet.slice(0, 8)}…:`, payErr.message);
      return res.status(500).json({ error: 'Payout failed — your balance has NOT been deducted. Please try again.' });
    }

    // ── Step 3: mark complete ─────────────────────────────────────────────────
    await prisma.payout.update({ where: { id: payoutId }, data: { status: 'COMPLETED', txSig } });
    console.log(`[referral] Withdrawal complete: ${wallet.slice(0, 8)}… ${amount.toFixed(4)} SOL tx=${txSig}`);
    res.json({ ok: true, amount, txSig, message: `${amount.toFixed(4)} SOL sent to your wallet!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    inFlight.delete(wallet);
  }
});

// GET /api/referral/cashback
router.get('/cashback', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const link = await prisma.referralLink.findUnique({ where: { referredWallet: wallet } });
    if (!link) return res.json({
      cashbackBalance: 0, cashbackEarned: 0, active: false,
      daysRemaining: 0, canClaim: false, minClaim: MIN_CASHBACK_CLAIM,
    });

    const daysSince = (Date.now() - new Date(link.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, 30 - Math.floor(daysSince));
    const cashbackBalance = num(link.cashbackBalance);

    res.json({
      cashbackBalance,
      cashbackEarned: num(link.cashbackEarned),
      active: daysRemaining > 0,
      daysRemaining,
      canClaim: cashbackBalance >= MIN_CASHBACK_CLAIM,
      minClaim: MIN_CASHBACK_CLAIM,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referral/cashback/claim  — same safe payout flow as /withdraw
router.post('/cashback/claim', requireAuth, async (req: any, res) => {
  const { walletFromToken: wallet } = req;
  const lockKey = `cb:${wallet}`;
  if (inFlight.has(lockKey)) {
    return res.status(409).json({ error: 'A claim is already in progress. Please wait.' });
  }
  inFlight.add(lockKey);
  try {
    const link = await prisma.referralLink.findUnique({ where: { referredWallet: wallet } });
    if (!link) return res.status(404).json({ error: 'No cashback account' });

    const balance = new Prisma.Decimal(link.cashbackBalance);
    if (balance.lessThan(MIN_CASHBACK_CLAIM)) {
      return res.status(400).json({
        error: `Minimum claim is ${MIN_CASHBACK_CLAIM} SOL. You have ${num(balance).toFixed(4)} SOL.`,
        cashbackBalance: num(balance),
        minClaim: MIN_CASHBACK_CLAIM,
      });
    }

    // Step 1: atomic debit + PENDING ledger row.
    let payoutId: string;
    try {
      payoutId = await prisma.$transaction(async (tx) => {
        const upd = await tx.referralLink.updateMany({
          where: { referredWallet: wallet, cashbackBalance: balance },
          data: { cashbackBalance: 0 },
        });
        if (upd.count !== 1) throw new Error('CONFLICT');
        const payout = await tx.payout.create({
          data: { wallet, kind: 'CASHBACK', amountSol: balance, status: 'PENDING' },
        });
        return payout.id;
      });
    } catch (e: any) {
      if (e.message === 'CONFLICT') {
        return res.status(409).json({ error: 'Balance changed — please refresh and try again.' });
      }
      throw e;
    }

    // Step 2: on-chain transfer.
    const amount = num(balance);
    let txSig: string;
    try {
      txSig = await payoutSol(wallet, amount);
    } catch (payErr: any) {
      await prisma.$transaction([
        prisma.referralLink.update({
          where: { referredWallet: wallet },
          data: { cashbackBalance: { increment: balance } },
        }),
        prisma.payout.update({
          where: { id: payoutId },
          data: { status: 'FAILED', error: String(payErr.message).slice(0, 400) },
        }),
      ]);
      console.error(`[cashback] Payout failed for ${wallet.slice(0, 8)}…:`, payErr.message);
      return res.status(500).json({ error: 'Payout failed — your balance has NOT been deducted. Please try again.' });
    }

    // Step 3: mark complete.
    await prisma.payout.update({ where: { id: payoutId }, data: { status: 'COMPLETED', txSig } });
    console.log(`[cashback] Claim complete: ${wallet.slice(0, 8)}… ${amount.toFixed(4)} SOL tx=${txSig}`);
    res.json({ ok: true, amount, txSig, message: `${amount.toFixed(4)} SOL cashback sent to your wallet!` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    inFlight.delete(lockKey);
  }
});

export default router;
