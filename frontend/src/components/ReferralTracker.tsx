'use client';
import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.jetforge.io';

/**
 * Global referral tracker — mounted in root layout, runs on every page.
 *
 * Flow for user B who clicks a referral link:
 *  1. /r/[code] → redirect → /?ref=code
 *  2. This component saves jf_ref to localStorage immediately.
 *  3a. If wallet is already connected → register right now (single combined effect).
 *  3b. If wallet not yet connected → registration fires when publicKey changes.
 *
 * The combined single-effect approach means BOTH scenarios are handled:
 *  • Landing on /?ref=code with wallet already connected (publicKey truthy)
 *  • Connecting wallet later on any page while code is still in localStorage
 *
 * Registration is idempotent on the server — safe to call multiple times.
 */
export default function ReferralTracker() {
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();

  useEffect(() => {
    // 1. Capture ref code from URL if present
    const ref = searchParams.get('ref');
    if (ref && ref.length >= 4) {
      localStorage.setItem('jf_ref', ref);
    }

    // 2. If wallet is connected, register with whatever code is in localStorage
    //    (just captured above, or saved from a previous page visit)
    if (!publicKey) return;
    const code = localStorage.getItem('jf_ref');
    if (!code) return;

    fetch(`${API_BASE}/api/referral/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode: code, visitorWallet: publicKey.toBase58() }),
    })
      .then(() => {
        // Clear regardless of server response (alreadyRegistered, success, etc.)
        localStorage.removeItem('jf_ref');
      })
      .catch(() => {
        // Keep in localStorage on network error — will retry on next mount/wallet change
      });
  }, [searchParams, publicKey]); // fires on URL change OR wallet connect

  return null;
}
