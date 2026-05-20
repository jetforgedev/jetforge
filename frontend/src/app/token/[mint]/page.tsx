import TokenClientPage from "./_TokenClientPage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

async function getTokenSSR(mint: string) {
  try {
    const res = await fetch(`${API_URL}/tokens/${mint}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function TokenPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;
  const token = await getTokenSSR(mint);

  return (
    <>
      {/*
        Server-rendered semantic HTML — injected into the initial HTTP response.
        Googlebot, GPTBot, Claude-Web, and PerplexityBot all read this directly
        without executing JavaScript.  The interactive trading UI that follows
        (TokenClientPage) renders on top after hydration.
      */}
      <div className="sr-only">
        {token ? (
          <>
            <h1>
              {token.name} ({token.symbol}) — Trade on JetForge
            </h1>
            <p>
              {token.description ||
                `${token.name} ($${token.symbol}) is a Solana meme token trading on the JetForge fair-launch bonding curve.`}
            </p>
            <dl>
              <dt>Market Cap</dt>
              <dd>{Number(token.marketCapSol).toFixed(2)} SOL</dd>
              <dt>Status</dt>
              <dd>
                {token.isGraduated
                  ? "Graduated to Raydium DEX"
                  : `Bonding curve ${Math.min(
                      100,
                      Number(token.graduationProgress) || 0
                    ).toFixed(1)}% complete`}
              </dd>
              <dt>Total Trades</dt>
              <dd>{token.trades}</dd>
              <dt>Holders</dt>
              <dd>{token.holders}</dd>
              <dt>Mint Address</dt>
              <dd>{mint}</dd>
              <dt>Creator</dt>
              <dd>{token.creator}</dd>
            </dl>
          </>
        ) : (
          <>
            <h1>Token — JetForge</h1>
            <p>
              Trade Solana tokens on JetForge, the fair-launch bonding curve
              launchpad. No presales, no team allocations.
            </p>
          </>
        )}
      </div>

      {/* Full interactive trading interface (chart, swap panel, holders, trades) */}
      <TokenClientPage mint={mint} />
    </>
  );
}
