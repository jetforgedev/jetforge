# JetForge — Solana Token Launch Platform

A JetForge-style token launch and trading platform built on Solana devnet.
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

## Smart Contract (Anchor/Rust)

### Bonding Curve Math

Uses constant product formula (x × y = k):

- **Initial virtual SOL**: 30 SOL (30,000,000,000 lamports)
- **Initial virtual tokens**: 1,073,000,191,000,000
- **Trading supply**: 1,000,000,000,000,000 (100% — all tokens available for trading)
- **Total supply**: 1,000,000,000 tokens (with 6 decimals)
- **Graduation threshold**: 85 SOL real reserves

**Buy formula:**
```
k = virtual_sol × virtual_tokens
new_virtual_sol    = virtual_sol + sol_in_after_fee
new_virtual_tokens = k / new_virtual_sol
tokens_out         = virtual_tokens - new_virtual_tokens
```

**Sell formula:**
```
k = virtual_sol × virtual_tokens
new_virtual_tokens = virtual_tokens + token_in
new_virtual_sol    = k / new_virtual_tokens
sol_out            = virtual_sol - new_virtual_sol (before fee)
```

### Fee Structure

**1% fee on every buy and sell transaction.**

| Recipient | Share | Purpose |
|---|---|---|
| **Creator vault** | 40% of fee | Creator earns from trading activity |
| **Treasury** | 40% of fee | Platform revenue |
| **Buyback vault** | 20% of fee | Accumulated until 0.1 SOL threshold, then used to buy & burn tokens |

**Example:** On a 1 SOL buy (1% fee = 0.01 SOL):
- Creator receives: 0.004 SOL
- Treasury receives: 0.004 SOL
- Buyback vault: 0.002 SOL

**Graduation fee split (at 85 SOL):**
- 5% → treasury (platform cut)
- 5% → creator (graduation reward)
- 90% → treasury to seed DEX liquidity

### Program Instructions

| Instruction | Description |
|---|---|
| `create_token` | Deploy token with bonding curve, mint full supply to vault |
| `buy` | Buy tokens with SOL using constant product formula |
| `sell` | Sell tokens back for SOL |
| `graduate` | Migrate graduated token liquidity to DEX (callable when curve is complete) |
| `execute_buyback` | Permissionless: burns accumulated buyback fees when vault ≥ 0.1 SOL |
| `withdraw_creator_fees` | Creator withdraws accumulated fee SOL from their vault |

### Contract Addresses

| Network | Program ID |
|---|---|
| **Devnet** | `EFHQqg1qrv18pxgob5uuy4nRZ3XpUwBmUHzqpFUUK6MV` |
| Mainnet | Not deployed yet — audit in progress |

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
│       ├── indexer/           # Solana on-chain event indexer
│       ├── api/               # REST API routes
│       └── websocket/         # WebSocket broadcasting
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
        ├── lib/               # Bonding curve math, API client, program
        └── providers/         # Wallet + React Query providers
```

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
# Edit .env with your PostgreSQL connection string and program ID

npx prisma db push
npx prisma generate
```

### 4. Start backend + frontend together

```bash
# From root
npx concurrently "npm run dev --prefix backend" "npm run dev --prefix frontend"
```

Backend: `http://localhost:4000`
Frontend: `http://localhost:3000`

## Devnet Deployment

### 1. Get devnet SOL

```bash
solana airdrop 2 --url devnet
# Or visit https://faucet.solana.com
```

### 2. Build and deploy

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### 3. Configure backend

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com
PROGRAM_ID=EFHQqg1qrv18pxgob5uuy4nRZ3XpUwBmUHzqpFUUK6MV
TREASURY_ADDRESS=13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW
FRONTEND_URL=https://jetforge.io
```

## API Reference

### REST Endpoints

```
GET  /api/tokens                         # List tokens (sort: new|trending|graduating|marketcap)
GET  /api/tokens/:mint                   # Token details + stats
POST /api/tokens                         # Register new token (called after on-chain tx)
GET  /api/tokens/:mint/ohlcv             # Candlestick data (interval: 1m|5m|15m|30m|1h|1d)
GET  /api/tokens/:mint/holders           # Top 10 token holders

GET  /api/trades/:mint                   # Trades for a token
GET  /api/trades/user/:wallet            # User's trade history

GET  /api/leaderboard/tokens             # Top tokens by volume / market cap
GET  /api/leaderboard/traders            # Top traders by PnL / volume

GET  /api/creators/:wallet               # Creator profile + launched tokens
GET  /api/portfolio/:wallet              # Wallet holdings + trade history
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
- `token_graduated` — Token reached 85 SOL and graduated

## Testing on Devnet

1. Install **Phantom** wallet browser extension
2. Switch network to **Devnet** (Settings → Developer Settings → Devnet)
3. Get free devnet SOL at **[faucet.solana.com](https://faucet.solana.com)**
4. Visit **[https://jetforge.io](https://jetforge.io)**

## Security

- All arithmetic uses `checked_*` ops — no silent overflow
- Slippage protection on all trades (`min_tokens_out`, `min_sol_out`)
- Treasury address is hardcoded in program binary — cannot be spoofed by caller
- `has_one` constraints validate mint matches bonding curve on all instructions
- Graduation fee math uses `ok_or(MathOverflow)?` — no silent zero fallback
- Config validation on startup — server refuses to boot with placeholder addresses
- URI validation blocks `javascript:` and `data:` injection

## License

MIT
