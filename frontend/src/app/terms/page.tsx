export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-[#555] text-sm">Last updated: March 2026</p>
      </div>

      {[
        {
          title: "1. Acceptance of Terms",
          body: "By accessing or using JetForge, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform. JetForge is a decentralized protocol — transactions are executed on the Solana blockchain and are irreversible.",
        },
        {
          title: "2. Eligibility",
          body: "You must be at least 18 years old and not a resident of any jurisdiction where use of decentralized finance protocols is prohibited. You are solely responsible for compliance with applicable laws in your jurisdiction.",
        },
        {
          title: "3. No Custodial Services",
          body: "JetForge is a non-custodial platform. We never hold, control, or have access to your funds or private keys. All trades occur directly on-chain through smart contracts. You are solely responsible for the security of your wallet.",
        },
        {
          title: "4. Risk Acknowledgment",
          body: "Cryptocurrency trading involves substantial risk of loss. Token prices on bonding curves can be highly volatile. You may lose all funds you invest. Past performance is not indicative of future results. Never invest more than you can afford to lose.",
        },
        {
          title: "5. No Guarantees",
          body: "JetForge makes no guarantees regarding token graduation, DEX listing, liquidity, or returns. The platform is provided as-is. Smart contracts may contain bugs or vulnerabilities despite audits.",
        },
        {
          title: "6. Prohibited Activities",
          body: "You agree not to: manipulate token prices, engage in wash trading, use automated bots to front-run trades, create tokens with misleading information, or use the platform for money laundering or any illegal activity.",
        },
        {
          title: "7. Intellectual Property",
          body: 'JetForge and its logo are trademarks of the JetForge team. The open-source smart contract code is licensed under MIT. "JetForge" as a brand name is not to be used without written permission.',
        },
        {
          title: "8. Limitation of Liability",
          body: "To the maximum extent permitted by law, JetForge shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the platform, including but not limited to loss of funds.",
        },
        {
          title: "9. Changes to Terms",
          body: "We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.",
        },
        {
          title: "10. Governing Law",
          body: "These terms shall be governed by applicable international law. Any disputes shall be resolved through binding arbitration.",
        },
      ].map((section) => (
        <div key={section.title}>
          <h2 className="text-white font-semibold mb-2">{section.title}</h2>
          <p className="text-[#888] text-sm leading-relaxed">{section.body}</p>
        </div>
      ))}
    </div>
  );
}
