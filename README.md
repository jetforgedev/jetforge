# JetForge — Solana Token Launch Platform

A pump.fun-style token launch and trading platform built on Solana devnet.
Live at **[https://jetforge.io](https://jetforge.io)**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      User's Browser                             │
│  Next.js 16 Frontend (React, TailwindCSS, lightweight-charts)   │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTPS + WebSocket (Socket.io)
┌────────────────────────▼───────────────────────────────────────┐
│              Node.js Backend (Express + Socket.io)              │
│  REST API | Solana Event Indexer | Live Feed Broadcaster        │
└──────┬─────────────────────────────────────────┬───────────────┘
       │ Prisma ORM                               │ @solana/web3.js
┌──────▼──────┐                        ┌─────────▼────────────────┐
│ PostgreSQL  │                        │  Solana Blockchain        │
│  Database   │                        │  Anchor Program (Rust)    │
└─────────────┘                        └──────────────────────────┘
```

## Tokenomics

### Token Supply Distribution (70/30 Model)

Every token launched on JetForge uses a fixed 1 billion token supply split into two pools:

| Pool | Amount | % | Purpose |
|------|--------|---|---------|
| **Bonding Curve** | 700,000,000 tokens | 70% | Available for trading on the bonding curve |
| **Raydium Reserve** | 300,000,000 tokens | 30% | Locked; released to Raydium pool at graduation |
| **Total Supply** | 1,000,000,000 tokens | 100% | — |

> Tokens have **6 decimal places** (raw values are 1,000× larger, e.g. 1,000,000,000,000,000 raw = 1B tokens).

### Bonding Curve Constants

Uses a constant product AMM formula (x × y = k):

| Constant | Value | Notes |
|----------|-------|-------|
| Initial virtual SOL | 30 SOL (30,000,000,000 lamports) | Sets the starting price |
| Initial virtual tokens | 1,073,000,191,000,000 raw | ~1.073B virtual — higher than real supply to price token low at launch |
| Real token reserves (init) | 700,000,000,000,000 raw | 700M tokens available on curve |
| Graduation threshold | **0.5 SOL** (devnet) / **85 SOL** (mainnet) | Real SOL raised to trigger graduation |

**Starting price** ≈ 30 SOL ÷ 1,073,000,191,000 = ~0.0000000000280 SOL per raw unit  
= ~0.0000280 SOL per token (6 decimals) = ~$0.0000023 at $82/SOL

**Buy formula:**
```
k                  = virtual_sol × virtual_tokens
new_virtual_sol    = virtual_sol + sol_in_after_fee
new_virtual_tokens = k / new_virtual_sol
tokens_out         = virtual_tokens - new_virtual_tokens
```

**Sell formula:**
```
k                  = virtual_sol × virtual_tokens
new_virtual_tokens = virtual_tokens + token_in
new_virtual_sol    = k / new_virtual_tokens
sol_out            = virtual_sol - new_virtual_sol  (capped at real_sol_reserves, then 1% fee deducted)
```

### Fee Structure

**1% fee on every buy and sell.**

| Recipient | Share | Purpose |
|-----------|-------|---------|
| **Creator vault** | 40% of fee | Creator earns passively from all trading activity |
| **Treasury** | 40% of fee | Platform revenue |
| **Buyback vault** | 20% of fee | Auto-burns tokens when vault reaches 0.1 SOL threshold |

**Example — 1 SOL buy (fee = 0.01 SOL):**
- Creator vault: +0.004 SOL
- Treasury: +0.004 SOL
- Buyback vault: +0.002 SOL → burns tokens when vault ≥ 0.1 SOL

### Graduation

When `real_sol_reserves` reaches the graduation threshold the bonding curve is marked complete and the `graduate` instruction is triggered automatically.

**What happens at graduation:**

1. **300M reserve tokens** are transferred from the reserve vault → treasury ATA (for Raydium pool seeding)
2. **Unsold curve tokens** (any of the 700M not bought) are burned — deflationary
3. **SOL is split:**

| Recipient | % | Purpose |
|-----------|---|---------|
| Creator | 5% | Graduation bonus reward |
| Treasury (platform fee) | 5% | Platform cut |
| Treasury (liquidity) | 90% | Seeds the Raydium CLMM pool together with the 300M reserve tokens |

4. **Raydium CLMM pool** is created with the 90% SOL + 300M tokens
5. Token is marked `is_graduated = true` — bonding curve trading disabled

### Buyback & Burn

The buyback vault accumulates 20% of every trading fee. When it reaches **0.1 SOL**, anyone can call `execute_buyback`:

- The 0.1 SOL is used to buy tokens from the bonding curve at market price
- All purchased tokens are immediately burned
- This is permissionless — any wallet can trigger it

---

## Smart Contract

### Program Instructions

| Instruction | Description |
|---|---|
| `create_token` | Deploy token: mint 1B supply, create bonding curve PDA, split tokens into curve vault (700M) and reserve vault (300M), create Metaplex metadata |
| `buy` | Buy tokens with SOL using constant product formula, distribute 1% fee |
| `sell` | Sell tokens back for SOL, distribute 1% fee, cap sol_out at real reserves |
| `graduate` | Triggered when curve is complete — burns unsold tokens, seeds Raydium pool, splits SOL 5/5/90 |
| `execute_buyback` | Permissionless: burns accumulated buyback fees when vault ≥ 0.1 SOL |
| `withdraw_creator_fees` | Creator withdraws accumulated fee SOL from their vault |

### Contract Addresses

| Network | Program ID |
|---|---|
| **Devnet** | `7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk` |
| Mainnet | Not deployed yet — audit in progress |

---

## Project Structure

```
jetforge/
├── programs/token-launch/     # Anchor smart contract (Rust)
│   └── src/
│       ├── lib.rs             # Program entry point + TREASURY_PUBKEY
│       ├── instructions/      # buy, sell, create_token, graduate,
│       │                      # execute_buyback, withdraw_creator_fees
│       ├── state/             # BondingCurveState + constants
│       └── errors.rs          # Custom error codes
├── backend/                   # Node.js API server
│   ├── prisma/schema.prisma   # Database schema (Token, Trade)
│   └── src/
│       ├── index.ts           # Express server + Socket.io
│       ├── config.ts          # Config + startup validation
│       ├── indexer/           # Solana event indexer (WS + polling fallback)
│       ├── api/               # REST API routes
│       └── services/          # graduateKeeper, raydiumService
└── frontend/                  # Next.js 16 frontend
    └── src/
        ├── app/               # App Router pages
        │   ├── page.tsx       # Homepage (token list)
        │   ├── token/[mint]/  # Token detail + chart + trading
        │   ├── portfolio/     # Wallet portfolio + trade history
        │   ├── leaderboard/   # Top tokens + top traders
        │   └── launch/        # Create new token
        ├── components/        # TradingPanel, PriceChart, LaunchForm…
        ├── hooks/             # useTokenData, useTrades, usePrice…
        ├── lib/               # bondingCurve.ts, api.ts, program.ts
        └── providers/         # Wallet + React Query providers
```

---

## Local Development

### Prerequisites

- Node.js 20+
- Rust + Cargo
- Solana CLI 1.18+
- Anchor CLI 0.30+
- PostgreSQL 14+

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Build the smart contract

```bash
anchor build
```

### 3. Set up the database

```bash
cd backend
cp .env.devnet-public .env
# Edit .env with your PostgreSQL connection string

npx prisma db push
npx prisma generate
```

### 4. Start backend + frontend

```bash
# From root
npx concurrently "npm run dev --prefix backend" "npm run dev --prefix frontend"
```

Backend: `http://localhost:4000`  
Frontend: `http://localhost:3000`

---

## VPS / Production Deployment

### Backend `.env`

```env
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/jetforge
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com
PROGRAM_ID=7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk
TREASURY_ADDRESS=<your treasury wallet pubkey>
FRONTEND_URL=https://jetforge.io
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=https://api.jetforge.io/api
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

> Setting `NEXT_PUBLIC_API_URL` to your public domain is required for Raydium to display token name and image — the metadata URI stored on-chain points to this URL.

### Update VPS after a pull

```bash
git pull origin main

# Backend
cd backend && npm install && npm run build
pm2 restart backend

# Frontend
cd ../frontend && npm install && npm run build
pm2 restart frontend
```

---

## API Reference

### REST Endpoints

```
GET  /api/tokens                         # List tokens (sort: new|trending|graduating|graduated|marketcap)
GET  /api/tokens/:mint                   # Token details + live chain sync
POST /api/tokens                         # Register new token (called after on-chain tx)
GET  /api/tokens/:mint/ohlcv             # Candlestick data (interval: 1s|1m|5m|15m|30m|1h|1d)
GET  /api/tokens/:mint/holders           # Top 10 token holders (live from RPC)

GET  /api/trades/:mint                   # Trades for a token
GET  /api/trades/user/:wallet            # User's trade history

GET  /api/metadata/:mint                 # Metaplex-standard JSON metadata (used as on-chain URI)

GET  /api/leaderboard/tokens             # Top tokens by volume / market cap
GET  /api/leaderboard/traders            # Top traders by PnL / volume

GET  /api/creators/:wallet               # Creator profile + launched tokens
GET  /api/portfolio/:wallet              # Wallet holdings + trade history
GET  /api/stats                          # Platform stats (total tokens, 24h volume)
```

### WebSocket Events

**Client → Server:**
- `subscribe:token <mint>` — Join token room for live price updates
- `unsubscribe:token <mint>` — Leave token room
- `subscribe:feed` — Join global live feed

**Server → Client:**
- `price_update` — Real-time price / reserves / graduation progress
- `new_trade` — New trade on subscribed token
- `feed_trade` — Any trade across all tokens (global feed)
- `token_created` — New token launched
- `token_graduated` — Token reached graduation threshold

---

## Testing on Devnet

1. Install **Phantom** wallet browser extension
2. Switch network to **Devnet** (Settings → Developer Settings → Devnet)
3. Get free devnet SOL at **[faucet.solana.com](https://faucet.solana.com)**
4. Visit **[https://jetforge.io](https://jetforge.io)**

---

## Security

- All arithmetic uses `checked_*` ops — no silent overflow
- Slippage protection on all trades (`min_tokens_out`, `min_sol_out`)
- Treasury address is hardcoded in program binary — cannot be spoofed by caller
- `has_one` constraints validate mint matches bonding curve on all instructions
- Graduation fee math uses `ok_or(MathOverflow)?` — no silent zero fallback
- Config validation on startup — server refuses to boot with placeholder addresses
- URI validation blocks `javascript:` and `data:` injection

---

## License

MIT
