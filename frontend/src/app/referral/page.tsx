import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Referral Program — Earn SOL on JetForge',
  description: 'Earn 10% of platform fees from every trade your referrals make — forever. Share your link, grow your passive income on JetForge.',
  openGraph: {
    title: 'JetForge Referral Program — Earn SOL Passively',
    description: 'Share your referral link. Earn 10% of fees from every trade your referrals make. No cap, no expiry.',
    url: 'https://jetforge.io/referral',
  },
  alternates: { canonical: 'https://jetforge.io/referral' },
};

export default function ReferralPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#0f2a0f] border border-[#00ff88]/20 rounded-full px-4 py-1.5 text-[#00ff88] text-sm mb-6">
            \u{1F4B0} Passive Income on Solana
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Earn SOL Every Time<br />
            <span className="text-[#00ff88]">Someone You Referred Trades</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
            Share your referral link. Every trade your referrals make earns you 10% of the platform fee &mdash; automatically, forever, with no cap.
          </p>
          <Link
            href="/creators"
            className="inline-flex items-center gap-2 bg-[#00ff88] text-black font-bold px-8 py-3 rounded-xl hover:bg-[#00cc66] transition-all text-lg"
          >
            Get Your Referral Link &rarr;
          </Link>
        </div>

        {/* How it works */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: '\\uD83D\\uDD17',
                title: 'Get Your Link',
                desc: 'Connect your wallet, go to your creator profile, and sign in. Your unique referral link is generated instantly.',
              },
              {
                step: '02',
                icon: '\\uD83D\\uDCE3',
                title: 'Share It',
                desc: 'Post your link on X (Twitter), Telegram, Discord — anywhere your audience is. Use our pre-written share templates or write your own.',
              },
              {
                step: '03',
                icon: '\\uD83D\\uDCB0',
                title: 'Earn Forever',
                desc: 'Every trade your referrals make earns you 10% of the platform fee. Earnings accumulate automatically. Withdraw anytime.',
              },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-2xl p-6">
                <div className="text-[#00ff88]/40 text-xs font-mono mb-3">STEP {step}</div>
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Fee math */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">The Numbers</h2>
          <div className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="text-gray-400 text-sm mb-2">Example: Your referral trades 100 SOL in volume</div>
              <div className="text-4xl font-bold text-[#00ff88]">0.1 SOL</div>
              <div className="text-gray-400 text-sm">you earn — automatically</div>
            </div>
            <div className="space-y-3 max-w-lg mx-auto">
              {[
                { label: 'Total fee (1% per trade)', value: '1.00 SOL', color: 'text-white' },
                { label: 'Token creator', value: '0.40 SOL (40%)', color: 'text-gray-300' },
                { label: 'Buyback & burn', value: '0.20 SOL (20%)', color: 'text-gray-300' },
                { label: 'Platform treasury', value: '0.30 SOL (30%)', color: 'text-gray-300' },
                { label: 'You (referrer) earn', value: '0.10 SOL (10%)', color: 'text-[#00ff88] font-bold' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-[#1a2a1a] last:border-0">
                  <span className="text-gray-400 text-sm">{label}</span>
                  <span className={`text-sm font-mono ${color}`}>{value}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs text-center mt-6">
              Referrer earnings come from the platform&apos;s share. Creator earnings and buyback are never reduced.
            </p>
          </div>
        </section>

        {/* Cashback for referred users */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-[#0f2a1f] to-[#0f1a0f] border border-[#00ff88]/20 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="text-4xl">\\uD83C\\uDF81</div>
              <div>
                <h2 className="text-xl font-bold mb-2">10% Cashback for New Users</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  When someone joins JetForge through your referral link, they get <strong className="text-white">10% cashback on every trade for their first 30 days</strong>. This gives them a real reason to use your link — both sides win.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-[#0a1a0f] rounded-lg p-3">
                    <div className="text-[#00ff88] font-bold mb-1">You get</div>
                    <div className="text-gray-300">10% of fees from every trade they make — forever</div>
                  </div>
                  <div className="bg-[#0a1a0f] rounded-lg p-3">
                    <div className="text-[#00ff88] font-bold mb-1">They get</div>
                    <div className="text-gray-300">10% cashback on every trade for 30 days</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Withdrawal */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">Withdrawing Your Earnings</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: '\\uD83D\\uDCCA',
                title: 'Earnings Accumulate Automatically',
                desc: 'Every trade your referrals make credits your balance in real time. No manual claiming needed — it just builds up.',
              },
              {
                icon: '\\uD83D\\uDCB3',
                title: 'Withdraw When Ready',
                desc: 'Minimum withdrawal is 0.1 SOL. Request a withdrawal anytime from your creator profile — paid to your wallet within 24 hours.',
              },
              {
                icon: '\\u23F0',
                title: '24-Hour Cooldown',
                desc: 'There is a 24-hour cooldown between withdrawals to keep the system efficient. Earnings never expire.',
              },
              {
                icon: '\\uD83D\\uDD12',
                title: 'Abuse Protection Built-In',
                desc: 'Self-referrals, circular referrals, and wash trading are automatically blocked. The system is fair for everyone.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="text-2xl mt-0.5">{icon}</div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">FAQ</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Is there a limit to how much I can earn?',
                a: 'No. There is no cap on referral earnings. The more your referrals trade, the more you earn — indefinitely.',
              },
              {
                q: 'Does the referral last forever?',
                a: 'Yes. Once someone registers with your referral link, every trade they ever make on JetForge earns you 10% of the platform fee — for life.',
              },
              {
                q: 'What if someone already has a referrer?',
                a: "The first referrer wins. If a user already used someone else's link before yours, they are already registered and cannot be re-referred.",
              },
              {
                q: 'Can I refer myself?',
                a: 'No. Self-referrals are automatically blocked by the system.',
              },
              {
                q: 'How do I get my referral link?',
                a: 'Go to your creator profile on JetForge, connect your wallet, and click "Sign in with Wallet". Your unique link is generated instantly.',
              },
              {
                q: 'When does the 10% cashback for new users expire?',
                a: 'Cashback is active for the first 30 days after someone registers with your link. After 30 days, their trading still earns you referral fees — they just no longer get the cashback.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-[#0f1a0f] border border-[#1a2a1a] rounded-xl p-5">
                <h3 className="font-semibold mb-2">{q}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center bg-[#0f1a0f] border border-[#1a2a1a] rounded-2xl p-10">
          <h2 className="text-2xl font-bold mb-3">Ready to Start Earning?</h2>
          <p className="text-gray-400 mb-6">Go to your creator profile, sign in with your wallet, and get your referral link in seconds.</p>
          <Link
            href="/creators"
            className="inline-flex items-center gap-2 bg-[#00ff88] text-black font-bold px-8 py-3 rounded-xl hover:bg-[#00cc66] transition-all"
          >
            Get My Referral Link &rarr;
          </Link>
        </div>

      </div>
    </main>
  );
}
