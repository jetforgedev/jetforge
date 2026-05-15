import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy — JetForge",
  description: "JetForge Privacy Policy — how we handle data for users of the JetForge Solana token launchpad.",
  alternates: { canonical: "https://jetforge.io/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-gray-400 mb-12">Last updated: May 15, 2026</p>

        <div className="space-y-10 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Overview</h2>
            <p>
              JetForge (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the JetForge token launchpad platform at{" "}
              <a href="https://jetforge.io" className="text-indigo-400 hover:text-indigo-300">jetforge.io</a>{" "}
              and{" "}
              <a href="https://app.jetforge.io" className="text-indigo-400 hover:text-indigo-300">app.jetforge.io</a>.
              This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
              JetForge is a non-custodial platform — we do not hold, manage, or control any user funds or private keys.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-white font-medium mb-2">2.1 Wallet Addresses</h3>
                <p>
                  When you connect a Solana wallet to JetForge, your public wallet address is recorded in association with
                  your on-chain activity (trades, token creations, comments). Wallet addresses are public by nature of the
                  Solana blockchain and are not considered personally identifiable information under most privacy frameworks.
                  We never collect or have access to your private keys or seed phrases.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">2.2 Usage Data</h3>
                <p>
                  We collect anonymised usage analytics including: pages visited, features used, browser type, device type,
                  approximate geographic region (country level), and session duration. This data is used to improve platform
                  performance and user experience. It is not sold or shared with third parties for advertising purposes.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">2.3 On-Chain Data</h3>
                <p>
                  All trades, token launches, and transactions executed through JetForge are recorded permanently on the
                  Solana blockchain. This data is public, immutable, and outside JetForge&apos;s control. JetForge indexes
                  this on-chain data to power platform features such as leaderboards, portfolio tracking, and token pages.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">2.4 Communications</h3>
                <p>
                  If you contact us via email or submit a support request, we retain the content of that communication
                  and your email address for the purpose of responding. We do not use this for marketing without
                  your explicit consent.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">2.5 Cookies and Local Storage</h3>
                <p>
                  JetForge uses browser local storage to remember wallet connection preferences and UI settings (such as
                  theme or chart interval). We use minimal session cookies required for platform functionality. We do not
                  use tracking cookies or third-party advertising cookies.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To operate and improve the JetForge platform</li>
              <li>To display your trading history, portfolio, and creator profile</li>
              <li>To power leaderboard rankings and creator statistics</li>
              <li>To detect and prevent fraudulent or abusive activity</li>
              <li>To respond to support enquiries</li>
              <li>To comply with applicable legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Data Sharing and Third Parties</h2>
            <p className="mb-4">
              We do not sell your personal data. We may share data with:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-white">Infrastructure providers</strong> — cloud hosting, database, and CDN
                services required to operate the platform (bound by data processing agreements)
              </li>
              <li>
                <strong className="text-white">Analytics providers</strong> — anonymised, aggregated analytics only
              </li>
              <li>
                <strong className="text-white">Legal authorities</strong> — where required by law, court order, or
                to protect the rights and safety of users
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Data Retention</h2>
            <p>
              On-chain data is retained indefinitely as part of the Solana blockchain and cannot be deleted.
              Off-chain platform data (comments, support communications) is retained for as long as your account
              is active or as required by law. You may request deletion of off-chain data associated with your
              wallet address by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Your Rights</h2>
            <p className="mb-4">
              Depending on your jurisdiction, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-white">Access</strong> — request a copy of data we hold about you</li>
              <li><strong className="text-white">Correction</strong> — request correction of inaccurate off-chain data</li>
              <li><strong className="text-white">Deletion</strong> — request deletion of off-chain data (note: on-chain data cannot be deleted)</li>
              <li><strong className="text-white">Portability</strong> — request your data in a machine-readable format</li>
              <li><strong className="text-white">Objection</strong> — object to certain processing of your data</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at{" "}
              <a href="mailto:itsdrsmith013@gmail.com" className="text-indigo-400 hover:text-indigo-300">
                itsdrsmith013@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Security</h2>
            <p>
              We implement industry-standard security measures including HTTPS encryption, security headers (HSTS,
              CSP, X-Frame-Options), and access controls on our infrastructure. However, no system is completely
              secure, and we cannot guarantee absolute security of data transmitted over the internet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Children</h2>
            <p>
              JetForge is not intended for users under the age of 18. We do not knowingly collect data from
              children. If you believe a minor has provided us with personal data, contact us and we will
              promptly delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated via
              the platform or by updating the &quot;Last updated&quot; date above. Continued use of the platform
              after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. Contact</h2>
            <p>
              For privacy-related enquiries, data access requests, or complaints:
            </p>
            <p className="mt-2">
              <a href="mailto:itsdrsmith013@gmail.com" className="text-indigo-400 hover:text-indigo-300">
                itsdrsmith013@gmail.com
              </a>
            </p>
            <p className="mt-4 text-gray-500 text-sm">
              See also:{" "}
              <Link href="/terms" className="text-indigo-400 hover:text-indigo-300">Terms of Service</Link>
              {" · "}
              <Link href="/disclaimer" className="text-indigo-400 hover:text-indigo-300">Disclaimer</Link>
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
