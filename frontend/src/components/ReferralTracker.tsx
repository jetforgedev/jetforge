'use client';
import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.jetforge.io';

export default function ReferralTracker() {
  const searchParams = useSearchParams();
  const { publicKey } = useWallet();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('jf_ref', ref);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!publicKey) return;
    const code = localStorage.getItem('jf_ref');
    if (!code) return;

    // Register referral (idempotent — server ignores if already registered)
    fetch(`${API_BASE}/api/referral/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode: code, visitorWallet: publicKey.toBase58() }),
    }).then(() => {
      localStorage.removeItem('jf_ref'); // clear after registering
    }).catch(() => {});
  }, [publicKey]);

  return null;
}
