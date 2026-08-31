import { Router } from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import { secrets } from '../config';

const router = Router();
const JWT_SECRET = secrets.jwtSecret;

// Signed-message contract (must match the frontend exactly):
//   Sign in to JetForge
//   Wallet: <base58 pubkey>
//   Timestamp: <ms since epoch>
const LOGIN_PREFIX = 'Sign in to JetForge';
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000; // 5 minutes

// POST /api/auth/wallet-login
// Body: { wallet: string, signature: string, message: string }
router.post('/wallet-login', async (req, res) => {
  try {
    const { wallet, signature, message } = req.body;
    if (!wallet || !signature || !message) {
      return res.status(400).json({ error: 'Missing wallet, signature, or message' });
    }

    // Bind the message to this app's purpose — reject anything that isn't a
    // JetForge login, so a signature captured for another dApp can't be replayed.
    if (typeof message !== 'string' || !message.startsWith(LOGIN_PREFIX)) {
      return res.status(400).json({ error: 'Invalid login message' });
    }

    // The message must name the wallet that is authenticating.
    if (!message.includes(`Wallet: ${wallet}`)) {
      return res.status(400).json({ error: 'Login message does not match wallet' });
    }

    // Timestamp is REQUIRED and must be fresh. (Previously a message with no
    // trailing digits skipped the expiry check entirely — non-expiring auth.)
    const tsMatch = message.match(/Timestamp:\s*(\d{10,})\s*$/);
    if (!tsMatch) {
      return res.status(400).json({ error: 'Login message missing timestamp' });
    }
    const ts = parseInt(tsMatch[1], 10);
    const age = Date.now() - ts;
    if (!Number.isFinite(age) || age < -MAX_MESSAGE_AGE_MS || age > MAX_MESSAGE_AGE_MS) {
      return res.status(401).json({ error: 'Message expired' });
    }

    // Verify the signature over the exact message bytes.
    let valid = false;
    try {
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = bs58.decode(signature);
      const pubkeyBytes = bs58.decode(wallet);
      if (sigBytes.length === 64 && pubkeyBytes.length === 32) {
        valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
      }
    } catch {
      valid = false;
    }
    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const token = jwt.sign({ wallet }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, wallet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
