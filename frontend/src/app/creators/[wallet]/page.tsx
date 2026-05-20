import CreatorClientPage from "./_CreatorClientPage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

async function getCreator(wallet: string) {
  try {
    const res = await fetch(`${API_URL}/creators/${wallet}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  const creator = await getCreator(wallet);
  const short = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  return creator
    ? {
        title: `${short} — JetForge Creator`,
        description: `Creator profile on JetForge. ${creator.tokensLaunched ?? 0} tokens launched, ${Number(creator.totalVolumeSol ?? 0).toFixed(1)} SOL total volume.`,
        alternates: { canonical: `https://jetforge.io/creators/${wallet}` },
      }
    : {
        title: "Creator — JetForge",
        description: "Token creator profile on JetForge, the Solana bonding curve launchpad.",
      };
}

export default async function CreatorPage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  const creator = await getCreator(wallet);

  return (
    <>
      <div className="sr-only">
        <h1>{wallet.slice(0, 4)}...{wallet.slice(-4)} — JetForge Creator Profile</h1>
        {creator ? (
          <>
            <p>Token creator on JetForge Solana launchpad. Wallet: {wallet}</p>
            <dl>
              <dt>Tokens Launched</dt><dd>{creator.tokensLaunched ?? 0}</dd>
              <dt>Graduated Tokens</dt><dd>{creator.graduatedTokens ?? 0}</dd>
              <dt>Total Volume</dt><dd>{Number(creator.totalVolumeSol ?? 0).toFixed(2)} SOL</dd>
              <dt>Total Raised</dt><dd>{Number(creator.totalRaisedSol ?? 0).toFixed(2)} SOL</dd>
              <dt>Estimated Earnings</dt><dd>{Number(creator.estimatedEarningsSol ?? 0).toFixed(4)} SOL</dd>
            </dl>
            {creator.tokens && creator.tokens.length > 0 && (
              <ul>
                {creator.tokens.slice(0, 10).map((t: { mint: string; name: string; symbol: string; realSolReserves: string }) => (
                  <li key={t.mint}>
                    <a href={`/token/${t.mint}`}>{t.name} ({t.symbol}) — {Number(t.realSolReserves).toFixed(2)} SOL raised</a>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p>Creator profile on JetForge, the fair-launch Solana token launchpad.</p>
        )}
      </div>
      <CreatorClientPage wallet={wallet} />
    </>
  );
}
