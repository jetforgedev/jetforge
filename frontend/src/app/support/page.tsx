export default function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Support</h1>
        <p className="text-[#555] text-sm">We're here to help. Choose the best channel below.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            icon: "💬",
            title: "Telegram Community",
            desc: "Join our Telegram group for real-time help from the community and team.",
            link: "https://t.me/jetforgechat",
            label: "Join Telegram",
          },
          {
            icon: "𝕏",
            title: "Twitter / X",
            desc: "Follow us for updates, announcements, and platform news.",
            link: "https://x.com/jetforgeDev",
            label: "Follow on X",
          },
          {
            icon: "💻",
            title: "GitHub Issues",
            desc: "Found a bug? Open an issue on our GitHub repository.",
            link: "https://github.com/jetforge",
            label: "Open Issue",
          },
          {
            icon: "📧",
            title: "Email Support",
            desc: "For business inquiries or sensitive issues, email our team directly.",
            link: "mailto:support@jetforge.io",
            label: "Send Email",
          },
        ].map((item) => (
          <div key={item.title} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 space-y-3">
            <div className="text-2xl">{item.icon}</div>
            <div>
              <div className="text-white font-semibold text-sm mb-1">{item.title}</div>
              <p className="text-[#666] text-xs leading-relaxed">{item.desc}</p>
            </div>
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs px-4 py-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-lg text-[#888] hover:text-white transition-colors"
            >
              {item.label} →
            </a>
          </div>
        ))}
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5">
        <div className="text-white font-semibold mb-3 text-sm">Common Issues</div>
        <div className="space-y-3 text-sm">
          {[
            ["Transaction failed", "Try increasing your slippage tolerance in the trading panel and ensure you have enough SOL for fees."],
            ["Wallet not connecting", "Refresh the page and ensure Phantom is unlocked. Try disconnecting and reconnecting your wallet."],
            ["Token not showing", "Newly created tokens may take 30–60 seconds to appear. Refresh the homepage."],
            ["Chart is empty", "Charts populate after the first trade. Be the first to buy and you'll see the initial candle."],
          ].map(([issue, solution]) => (
            <div key={issue} className="border-b border-[#1a1a1a] pb-3 last:border-0 last:pb-0">
              <div className="text-[#00ff88] font-medium text-xs mb-1">{issue}</div>
              <div className="text-[#666] text-xs">{solution}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[#444] text-xs text-center">
        Response times vary. For urgent trading issues, check our{" "}
        <a href="/faq" className="text-[#00ff88] hover:underline">FAQ</a> first.
      </p>
    </div>
  );
}
