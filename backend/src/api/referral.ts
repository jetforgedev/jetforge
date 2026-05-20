import { Router } from 'express';
import { prisma } from '../index';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jetforge-secret-change-in-prod';
const MIN_WITHDRAWAL = 0.1; // SOL
const WITHDRAWAL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

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

// GET /api/referral/code - get or create referral account for authenticated user
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

// GET /api/referral/stats/:wallet - public stats
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

// GET /api/referral/dashboard - private dashboard
router.get('/dashboard', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) return res.json({ pendingBalance: 0, totalEarned: 0, totalReferrals: 0, canWithdraw: false, referralCode: null });

    const canWithdraw = account.pendingBalance >= MIN_WITHDRAWAL &&
      (!account.lastWithdrawnAt || Date.now() - account.lastWithdrawnAt.getTime() > WITHDRAWAL_COOLDOWN_MS);

    res.json({
      ...account,
      canWithdraw,
      minWithdrawal: MIN_WITHDRAWAL,
      referralLink: `https://jetforge.io/r/${account.referralCode}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referral/register - called when new user visits via referral link
router.post('/register', async (req, res) => {
  try {
    const { referralCode, visitorWallet } = req.body;
    if (!referralCode || !visitorWallet) return res.status(400).json({ error: 'Missing fields' });

    // Rule: validate wallet format (basic check - 32-44 base58 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(visitorWallet)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Check if visitor already has a referrer
    const existing = await prisma.referralLink.findUnique({ where: { referredWallet: visitorWallet } });
    if (existing) return res.json({ ok: true, alreadyRegistered: true });

    // Find referrer by code
    const account = await prisma.referralAccount.findUnique({ where: { referralCode } });
    if (!account) return res.status(404).json({ error: 'Invalid referral code' });

    // Rule 1: Cannot refer yourself
    if (account.wallet === visitorWallet) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    // Rule 2: Circular referral check - is the referrer already referred BY the visitor?
    const circularCheck = await prisma.referralLink.findUnique({ where: { referredWallet: account.wallet } });
    if (circularCheck && circularCheck.referrerWallet === visitorWallet) {
      return res.status(400).json({ error: 'Circular referral not allowed' });
    }

    // Rule 3: Rate limit - referrer cannot add more than 50 referrals per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReferrals = await prisma.referralLink.count({
      where: { referrerWallet: account.wallet, createdAt: { gte: oneDayAgo } },
    });
    if (recentReferrals >= 50) {
      return res.status(429).json({ error: 'Too many referrals today. Try again tomorrow.' });
    }

    // Register the link
    await prisma.referralLink.create({
      data: { referredWallet: visitorWallet, referrerWallet: account.wallet },
    });

    // Increment referral count
    await prisma.referralAccount.update({
      where: { wallet: account.wallet },
      data: { totalReferrals: { increment: 1 } },
    });

    res.json({ ok: true, referrerWallet: account.wallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referral/withdraw - request withdrawal
router.post('/withdraw', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const account = await prisma.referralAccount.findUnique({ where: { wallet } });
    if (!account) return res.status(404).json({ error: 'No referral account' });
    if (account.pendingBalance < MIN_WITHDRAWAL) {
      return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL} SOL. Current balance: ${account.pendingBalance.toFixed(4)} SOL` });
    }
    if (account.lastWithdrawnAt && Date.now() - account.lastWithdrawnAt.getTime() < WITHDRAWAL_COOLDOWN_MS) {
      return res.status(400).json({ error: 'Withdrawal cooldown: 24 hours between withdrawals' });
    }

    const amount = account.pendingBalance;

    await prisma.referralAccount.update({
      where: { wallet },
      data: { pendingBalance: 0, lastWithdrawnAt: new Date() },
    });

    console.log(`[referral] Withdrawal requested: ${wallet} => ${amount} SOL`);

    res.json({ ok: true, amount, message: `${amount.toFixed(4)} SOL will be sent to your wallet within 24 hours` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referral/cashback - get referred user's cashback balance (auth required)
router.get('/cashback', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const link = await (prisma as any).referralLink.findUnique({ where: { referredWallet: wallet } });
    if (!link) return res.json({ cashbackBalance: 0, cashbackEarned: 0, active: false, daysRemaining: 0, canClaim: false });

    const daysSince = (Date.now() - new Date(link.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, 30 - Math.floor(daysSince));
    const active = daysRemaining > 0;
    const canClaim = link.cashbackBalance >= 0.05;

    res.json({
      cashbackBalance: link.cashbackBalance,
      cashbackEarned: link.cashbackEarned,
      active,
      daysRemaining,
      canClaim,
      minClaim: 0.05,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referral/cashback/claim - claim cashback (auth required)
router.post('/cashback/claim', requireAuth, async (req: any, res) => {
  try {
    const { walletFromToken: wallet } = req;
    const link = await (prisma as any).referralLink.findUnique({ where: { referredWallet: wallet } });
    if (!link) return res.status(404).json({ error: 'No referral cashback account' });
    if (link.cashbackBalance < 0.05) {
      return res.status(400).json({ error: `Minimum claim is 0.05 SOL. Current: ${link.cashbackBalance.toFixed(4)} SOL` });
    }

    const amount = link.cashbackBalance;
    await (prisma as any).referralLink.update({
      where: { referredWallet: wallet },
      data: { cashbackBalance: 0 },
    });

    console.log(`[cashback] Claim requested: ${wallet} => ${amount} SOL`);
    res.json({ ok: true, amount, message: `${amount.toFixed(4)} SOL cashback will be sent to your wallet within 24 hours` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
