export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Disclaimer</h1>
        <p className="text-[#555] text-sm">Last updated: March 2026</p>
      </div>

      <div className="bg-[#ff444410] border border-[#ff444430] rounded-xl p-5">
        <p className="text-[#ff4444] font-semibold text-sm mb-2">⚠️ High Risk Warning</p>
        <p className="text-[#ff8888] text-sm leading-relaxed">
          Trading meme tokens and newly launched tokens carries extreme risk. You may lose 100% of your investment. Do not use funds you cannot afford to lose.
        </p>
      </div>

      {[
        {
          title: "Not Financial Advice",
          body: "Nothing on JetForge constitutes financial, investment, legal, or tax advice. All content is for informational purposes only. Always conduct your own research (DYOR) before making any investment decision.",
        },
        {
          title: "No Endorsement",
          body: "JetForge does not endorse, verify, or vouch for any token listed on the platform. Any token can be created by anyone. The presence of a token on JetForge does not imply legitimacy, utility, or investment merit.",
        },
        {
          title: "Smart Contract Risk",
          body: "JetForge smart contracts have not been formally audited by a third party. While every effort has been made to write secure code, bugs may exist. Interact with the contracts at your own risk.",
        },
        {
          title: "Market Risk",
          body: "Bonding curve tokens are highly illiquid during early stages. Selling large amounts can cause significant price impact. Graduation to a DEX is not guaranteed and depends on sufficient buying pressure.",
        },
        {
          title: "Regulatory Risk",
          body: "The regulatory landscape for cryptocurrencies and DeFi is rapidly evolving. JetForge may become unavailable in certain jurisdictions due to regulatory requirements without notice.",
        },
        {
          title: "Creator Risk",
          body: "Token creators may hold significant portions of supply and could sell at any time (visible via Dev Holdings on each token page). This is publicly visible on-chain. Always check Dev Holdings before buying.",
        },
        {
          title: "Technology Risk",
          body: "Solana network congestion, RPC failures, or wallet issues may prevent you from executing trades at desired prices. We are not responsible for failed transactions or missed opportunities.",
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
