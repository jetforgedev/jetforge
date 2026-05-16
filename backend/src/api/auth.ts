import { Router } from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jetforge-secret-change-in-prod';

// POST /api/auth/wallet-login
// Body: { wallet: string, signature: string, message: string }
router.post('/wallet-login', async (req, res) => {
  try {
    const { wallet, signature, message } = req.body;
    if (!wallet || !signature || !message) {
      return res.status(400).json({ error: 'Missing wallet, signature, or message' });
    }

    // Verify signature
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signature);
    const pubkeyBytes = bs58.decode(wallet);

    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Check message timestamp (must be within 5 minutes)
    const tsMatch = message.match(/(\d+)$/);
    if (tsMatch) {
      const ts = parseInt(tsMatch[1]);
      if (Date.now() - ts > 5 * 60 * 1000) {
        return res.status(401).json({ error: 'Message expired' });
      }
    }

    const token = jwt.sign({ wallet }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, wallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
