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

    const existing = await prisma.referralLink.findUnique({ where: { referredWallet: visitorWallet } });
    if (existing) return res.json({ ok: true, alreadyRegistered: true });

    const account = await prisma.referralAccount.findUnique({ where: { referralCode } });
    if (!account) return res.status(404).json({ error: 'Invalid referral code' });
    if (account.wallet === visitorWallet) return res.status(400).json({ error: 'Cannot refer yourself' });

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

export default router;
