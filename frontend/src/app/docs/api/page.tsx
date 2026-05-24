"use client";

import React, { useState } from "react";
import Link from "next/link";

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="text-[10px] px-2 py-1 rounded border border-[#2a2a2a] text-[#555] hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-colors"
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

// ─── Code block ──────────────────────────────────────────────────────────────

function Code({ children, lang = "" }: { children: string; lang?: string }) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#1a1a1a] rounded-t-lg">
        <span className="text-[10px] text-[#444] uppercase tracking-widest">{lang || "shell"}</span>
        <CopyButton text={children} />
      </div>
      <pre className="bg-[#0a0a0a] rounded-b-lg px-4 py-4 overflow-x-auto text-xs leading-relaxed text-[#ccc] font-mono">
        <code>{children}</code>
      </pre>
    </div>
  );
}

// ─── Endpoint card ────────────────────────────────────────────────────────────

function Badge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
        method === "GET"
          ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20"
          : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
      }`}
    >
      {method}
    </span>
  );
}

interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

interface EndpointProps {
  id: string;
  method: "GET" | "POST";
  path: string;
  description: string;
  params?: Param[];
  body?: Param[];
  example: string;
  response: string;
}

function Endpoint({ id, method, path, description, params, body, example, response }: EndpointProps) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="border border-[#1a1a1a] rounded-xl overflow-hidden scroll-mt-24">
      {/* header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-[#111] hover:bg-[#141414] transition-colors text-left"
      >
        <Badge method={method} />
        <code className="text-sm text-white font-mono">{path}</code>
        <span className="ml-auto text-[#444] text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="bg-[#0d0d0d] border-t border-[#1a1a1a] px-5 py-5 space-y-5">
          <p className="text-[#888] text-sm leading-relaxed">{description}</p>

          {params && params.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#444] mb-3">Query Parameters</div>
              <div className="border border-[#1a1a1a] rounded-lg overflow-hidden">
                {params.map((p, i) => (
                  <div key={p.name} className={`flex gap-4 px-4 py-3 text-xs ${i !== 0 ? "border-t border-[#1a1a1a]" : ""}`}>
                    <span className="font-mono text-[#00ff88] w-28 shrink-0">{p.name}</span>
                    <span className="text-[#555] w-16 shrink-0">{p.type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded h-fit shrink-0 ${p.required ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "bg-[#1a1a1a] text-[#444]"}`}>
                      {p.required ? "required" : "optional"}
                    </span>
                    <span className="text-[#666]">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {body && body.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#444] mb-3">Request Body (JSON)</div>
              <div className="border border-[#1a1a1a] rounded-lg overflow-hidden">
                {body.map((p, i) => (
                  <div key={p.name} className={`flex gap-4 px-4 py-3 text-xs ${i !== 0 ? "border-t border-[#1a1a1a]" : ""}`}>
                    <span className="font-mono text-[#00ff88] w-28 shrink-0">{p.name}</span>
                    <span className="text-[#555] w-16 shrink-0">{p.type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded h-fit shrink-0 ${p.required ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "bg-[#1a1a1a] text-[#444]"}`}>
                      {p.required ? "required" : "optional"}
                    </span>
                    <span className="text-[#666]">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#444] mb-2">Request</div>
              <Code lang="shell">{example}</Code>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#444] mb-2">Response</div>
              <Code lang="json">{response}</Code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const BASE = "https://jetforge.io/api/v1";
const SAMPLE_MINT = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";

const ENDPOINTS: EndpointProps[] = [
  {
    id: "health",
    method: "GET",
    path: "/api/v1/health",
    description:
      "Returns the API status, current Solana slot, on-chain program ID, and network (devnet / mainnet). Use this to verify connectivity before making trade calls.",
    example: `curl https://jetforge.io/api/v1/health`,
    response: `{
  "status": "ok",
  "version": "1.0.0",
  "network": "mainnet",
  "programId": "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk",
  "slot": 312847651,
  "docs": "https://jetforge.io/docs/api"
}`,
  },
  {
    id: "markets",
    method: "GET",
    path: "/api/v1/markets",
    description:
      "List all active (non-graduated) JetForge markets with live on-chain bonding curve state — price, reserves, and graduation progress. Suitable for building market screeners or aggregator feeds.",
    params: [
      { name: "limit", type: "number", description: "Number of markets to return. Default 50, max 200." },
      {
        name: "sort",
        type: "string",
        description: "Sort order: new (by creation time), trending (by volume), or graduating (closest to 85 SOL graduation).",
      },
    ],
    example: `curl "https://jetforge.io/api/v1/markets?limit=5&sort=trending"`,
    response: `{
  "markets": [
    {
      "marketId": "EKpQ...cjm",
      "name": "WIF",
      "baseSymbol": "WIF",
      "quoteSymbol": "SOL",
      "baseMint": "EKpQ...cjm",
      "bondingCurveAddress": "7xQ1...pda",
      "creator": "9xDe...xyz",
      "decimals": 6,
      "price": 0.00000003,
      "priceSOL": 0.00000003,
      "virtualSolReserves": "30000000000",
      "virtualTokenReserves": "1073000191000000",
      "realSolReserves": "1294200000",
      "realTokenReserves": "42731050000000",
      "graduated": false,
      "progress": 1.5,
      "imageUrl": "https://...",
      "createdAt": "2026-05-24T10:00:00Z"
    }
  ],
  "count": 1,
  "network": "mainnet"
}`,
  },
  {
    id: "quote",
    method: "GET",
    path: "/api/v1/quote",
    description:
      "Get a real-time trade quote directly from the on-chain bonding curve state. Returns expected output, fee, price impact, and minimum output after slippage. No transaction is sent.",
    params: [
      { name: "mint", type: "string", required: true, description: "Token mint address (base58)." },
      {
        name: "side",
        type: "string",
        required: true,
        description: "Trade direction: buy or sell.",
      },
      {
        name: "amount",
        type: "number",
        required: true,
        description: "For buy: SOL amount in lamports (1 SOL = 1,000,000,000). For sell: token amount in base units (6 decimals).",
      },
      { name: "slippageBps", type: "number", description: "Slippage tolerance in basis points. Default 300 (3%)." },
    ],
    example: `# Buy quote: 0.1 SOL (100,000,000 lamports)
curl "https://jetforge.io/api/v1/quote?mint=${SAMPLE_MINT}&side=buy&amount=100000000"

# Sell quote: 1,000 tokens (1,000,000,000 base units at 6 decimals)
curl "https://jetforge.io/api/v1/quote?mint=${SAMPLE_MINT}&side=sell&amount=1000000000"`,
    response: `{
  "quote": {
    "marketId": "EKpQ...cjm",
    "bondingCurveAddress": "7xQ1...pda",
    "side": "buy",
    "inputAmount": "100000000",
    "inputAmountHuman": "0.100000 SOL",
    "outputAmount": "3464437480000",
    "outputAmountHuman": "3,464,437.48 tokens",
    "price": 0.000000029,
    "priceImpactPct": 0.655,
    "estimatedFeeLamports": "1000000",
    "minimumOutput": "3354163955600",
    "slippageBps": 300,
    "curveState": {
      "virtualSolReserves": "30000000000",
      "virtualTokenReserves": "1073000191000000",
      "realSolReserves": "1294200000",
      "realTokenReserves": "42731050000000"
    }
  }
}`,
  },
  {
    id: "trade-prepare",
    method: "POST",
    path: "/api/v1/trade/prepare",
    description:
      "Build a fully-formed, unsigned Solana transaction for a buy or sell on the JetForge bonding curve. The server constructs the instruction, sets the fee payer and recent blockhash, then returns the transaction as base64. You sign it with your own wallet and broadcast it — JetForge never touches your private key.",
    body: [
      { name: "mint", type: "string", required: true, description: "Token mint address." },
      { name: "side", type: "string", required: true, description: '"buy" or "sell".' },
      {
        name: "amount",
        type: "string",
        required: true,
        description: "Lamports for buy, token base units for sell. Pass as string to avoid precision loss.",
      },
      { name: "walletPublicKey", type: "string", required: true, description: "Caller's wallet public key (base58). Used as fee payer." },
      { name: "slippageBps", type: "number", description: "Slippage tolerance in basis points. Default 300." },
    ],
    example: `curl -X POST https://jetforge.io/api/v1/trade/prepare \\
  -H "Content-Type: application/json" \\
  -d '{
    "mint": "${SAMPLE_MINT}",
    "side": "buy",
    "amount": "100000000",
    "walletPublicKey": "YOUR_WALLET_PUBLIC_KEY",
    "slippageBps": 300
  }'`,
    response: `{
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADe...base64==",
  "message": "Sign and broadcast this transaction to buy on JetForge",
  "quote": {
    "marketId": "EKpQ...cjm",
    "side": "buy",
    "inputAmount": "100000000",
    "outputAmount": "3464437480000",
    "fee": "1000000",
    "minimumOutput": "3354163955600",
    "slippageBps": 300,
    "blockhash": "8ZyJ...",
    "lastValidBlockHeight": 312847751
  },
  "instructions": {
    "description": "Sign with your wallet and sendRawTransaction",
    "code": [
      "const tx = Transaction.from(Buffer.from(response.transaction, 'base64'));",
      "const signed = await wallet.signTransaction(tx);",
      "const sig = await connection.sendRawTransaction(signed.serialize());",
      "await connection.confirmTransaction(sig, 'confirmed');"
    ]
  }
}`,
  },
  {
    id: "wallet",
    method: "GET",
    path: "/api/v1/wallet/:address",
    description:
      "Get the SOL balance and all SPL token positions for any Solana wallet. Optionally filter to specific mints. Useful for building portfolio views or checking a bot wallet's holdings before trading.",
    params: [
      { name: "mints", type: "string", description: "Comma-separated list of mint addresses to filter. Omit to return all token accounts." },
    ],
    example: `# All positions
curl "https://jetforge.io/api/v1/wallet/YOUR_WALLET_ADDRESS"

# Filter to specific tokens
curl "https://jetforge.io/api/v1/wallet/YOUR_WALLET_ADDRESS?mints=${SAMPLE_MINT}"`,
    response: `{
  "wallet": "9xDe...xyz",
  "solBalance": "2450000000",
  "solBalanceSOL": 2.45,
  "tokenCount": 2,
  "tokens": [
    {
      "mint": "EKpQ...cjm",
      "balance": "3464437480000",
      "balanceUi": 3464437.48,
      "decimals": 6,
      "ataAddress": "4rT2...ata"
    }
  ]
}`,
  },
];

const SDK_EXAMPLE = `import { Connection, Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

const BASE = "https://jetforge.io/api/v1";
const connection = new Connection("https://api.mainnet-beta.solana.com");

// 1. Get a buy quote
const quote = await fetch(
  \`\${BASE}/quote?mint=\${MINT}&side=buy&amount=100000000\`
).then(r => r.json());

console.log("You will receive:", quote.quote.outputAmountHuman);
console.log("Price impact:", quote.quote.priceImpactPct + "%");

// 2. Build the unsigned transaction
const { transaction: txBase64 } = await fetch(\`\${BASE}/trade/prepare\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mint: MINT,
    side: "buy",
    amount: "100000000",
    walletPublicKey: wallet.publicKey.toBase58(),
    slippageBps: 300,
  }),
}).then(r => r.json());

// 3. Sign and broadcast (using Solana wallet adapter)
const { signTransaction } = useWallet();
const tx = Transaction.from(Buffer.from(txBase64, "base64"));
const signed = await signTransaction(tx);
const sig = await connection.sendRawTransaction(signed.serialize());
await connection.confirmTransaction(sig, "confirmed");
console.log("TX:", sig);`;

export default function ApiDocsPage() {
  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-10">

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-[#444]">
          <Link href="/" className="hover:text-[#666] transition-colors">JetForge</Link>
          <span>/</span>
          <span>Docs</span>
          <span>/</span>
          <span className="text-[#666]">API Reference</span>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Public REST API <span className="text-[#333] text-base font-normal">v1</span></h1>
            <p className="text-[#666] text-sm max-w-2xl leading-relaxed">
              Integrate JetForge bonding curve markets into your app, trading bot, or aggregator.
              Fetch live market data, get real-time quotes, and prepare unsigned Solana transactions.
              No API key or authentication required.
            </p>
          </div>
          <div className="flex gap-2 text-xs shrink-0">
            <span className="px-3 py-1.5 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 rounded-full font-mono">● Live</span>
            <a
              href="https://github.com/jetforgedev/jetforge"
              target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#111] border border-[#1a1a1a] text-[#666] hover:text-white rounded-full transition-colors"
            >
              GitHub →
            </a>
          </div>
        </div>
      </div>

      {/* Quick info */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          {
            label: "Base URL",
            value: "https://jetforge.io/api/v1",
            mono: true,
          },
          { label: "Auth", value: "None required", mono: false },
          { label: "Rate limit", value: "60 req / min per IP", mono: false },
        ].map((item) => (
          <div key={item.label} className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#444] mb-1">{item.label}</div>
            <div className={`text-sm text-[#ccc] ${item.mono ? "font-mono text-xs" : ""}`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar nav + content */}
      <div className="flex gap-8">
        {/* Sticky nav */}
        <aside className="hidden lg:block w-44 shrink-0">
          <div className="sticky top-24 space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-[#333] mb-3 px-2">Endpoints</div>
            {ENDPOINTS.map((ep) => (
              <a
                key={ep.id}
                href={`#${ep.id}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#555] hover:text-white hover:bg-[#111] transition-colors"
              >
                <span className={`text-[9px] font-bold font-mono ${ep.method === "GET" ? "text-[#00ff88]" : "text-orange-400"}`}>
                  {ep.method}
                </span>
                <span className="font-mono truncate">{ep.path.replace("/api/v1", "")}</span>
              </a>
            ))}
            <div className="border-t border-[#1a1a1a] mt-3 pt-3">
              <a
                href="#sdk-example"
                className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#555] hover:text-white hover:bg-[#111] transition-colors"
              >
                <span className="text-[9px] font-bold font-mono text-[#888]">JS</span>
                <span>SDK Example</span>
              </a>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 space-y-5 min-w-0">
          {ENDPOINTS.map((ep) => (
            <Endpoint key={ep.id} {...ep} />
          ))}
        </div>
      </div>

      {/* SDK / code example */}
      <div id="sdk-example" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-bold text-white">SDK Example</h2>
        <p className="text-[#666] text-sm">
          Full buy flow in TypeScript — get a quote, prepare the unsigned transaction, sign with your wallet, and broadcast.
        </p>
        <Code lang="typescript">{SDK_EXAMPLE}</Code>
      </div>

      {/* Error format */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Error Responses</h2>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          {[
            { code: "400", label: "Bad Request", desc: "Missing or invalid parameters." },
            { code: "404", label: "Not Found", desc: "Mint not found on JetForge." },
            { code: "500", label: "Server Error", desc: "RPC or internal error. Retry with backoff." },
          ].map((e) => (
            <div key={e.code} className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3">
              <div className="font-mono text-orange-400 font-bold mb-1">{e.code}</div>
              <div className="text-white text-xs mb-1">{e.label}</div>
              <div className="text-[#555] text-xs">{e.desc}</div>
            </div>
          ))}
        </div>
        <Code lang="json">{`{ "error": "Human-readable error message" }`}</Code>
      </div>

      {/* On-chain notes */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 space-y-3">
        <div className="text-white font-semibold text-sm">On-Chain Details</div>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          {[
            {
              label: "Program ID",
              value: "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk",
            },
            {
              label: "Treasury",
              value: "13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW",
            },
            {
              label: "Fee",
              value: "1% per trade — split: 40% creator / 40% treasury / 20% buyback",
            },
            {
              label: "Graduation",
              value: "85 SOL real reserves → auto-migrate to Raydium",
            },
            {
              label: "Token supply",
              value: "1,000,000,000 tokens, 6 decimals",
            },
            {
              label: "AMM",
              value: "Constant-product bonding curve (k = virtualSol × virtualTokens)",
            },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="text-[#444] text-[10px] uppercase tracking-widest">{item.label}</div>
              <div className="font-mono text-[#888] break-all">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer links */}
      <div className="flex gap-4 text-xs text-[#444] flex-wrap">
        <Link href="/support" className="hover:text-[#666] transition-colors">Support</Link>
        <a href="https://t.me/jetforgechat" target="_blank" rel="noopener noreferrer" className="hover:text-[#666] transition-colors">
          Telegram
        </a>
        <a href="https://github.com/jetforgedev/jetforge" target="_blank" rel="noopener noreferrer" className="hover:text-[#666] transition-colors">
          GitHub
        </a>
        <Link href="/about" className="hover:text-[#666] transition-colors">About</Link>
        <span className="ml-auto text-[#333]">JetForge Public API v1 — 2026</span>
      </div>
    </div>
  );
}
