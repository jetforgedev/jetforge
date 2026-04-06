# TokenDex - Solana Token Launch Platform

A production-ready pump.fun-style token launch and trading platform built on Solana.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      User's Browser                             │
│  Next.js 14 Frontend (React, TailwindCSS, lightweight-charts)   │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼───────────────────────────────────────┐
│              Node.js Backend (Express + Socket.io)              │
│  REST API | Event Indexer | Live Feed Broadcaster               │
└──────┬─────────────────────────────────────────┬───────────────┘
       │ Prisma ORM                               │ @solana/web3.js
┌──────▼──────┐                        ┌─────────▼────────────────┐
│ PostgreSQL  │                        │  Solana Blockchain        │
│  Database  │                        │  Anchor Program (Rust)    │
└─────────────┘                        └──────────────────────────┘
```

## Smart Contract (Anchor/Rust)

### Bonding Curve Math

Uses constant product formula (x * y = k), identical to pump.fun:

- **Initial virtual SOL**: 30 SOL (30,000,000,000 lamports)
- **Initial virtual tokens**: 1,073,000,191,000,000
- **Trading supply**: 793,100,000,000,000 tokens (79.31%)
- **Reserve supply**: 206,900,000,000,000 tokens (20.69%)
- **Total supply**: 1,000,000,000 tokens (with 6 decimals)
- **Graduation threshold**: 85 SOL real reserves

**Buy formula:**
```
k = virtual_sol × virtual_token
new_virtual_sol = virtual_sol + sol_in_after_fee
new_virtual_token = k / new_virtual_sol
tokens_out = virtual_token - new_virtual_token
```

**Sell formula:**
```
k = virtual_sol × virtual_token
new_virtual_token = virtual_token + token_in
new_virtual_sol = k / new_virtual_token
sol_out = virtual_sol - new_virtual_sol (then minus fee)
```

**Fees:** 1% on all trades. 10% of fee → creator, 90% → treasury.

### Program Instructions

| Instruction     | Description                                        |
|-----------------|----------------------------------------------------|
| `create_token`  | Deploy token with bonding curve, mint all supply   |
| `buy`           | Buy tokens with SOL using constant product formula |
| `sell`          | Sell tokens back for SOL                           |
| `graduate`      | Migrate graduated token liquidity to DEX           |

### Contract Addresses

| Network  | Program ID                                       |
|----------|--------------------------------------------------|
| Localnet | `TokenLaunchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`   |
| Devnet   | Deploy with `anchor deploy --provider.cluster devnet` |
| Mainnet  | Not deployed yet                                 |

## Project Structure

```
token-dex/
├── programs/token-launch/     # Anchor smart contract (Rust)
│   └── src/
│       ├── lib.rs             # Program entry point
│       ├── instructions/      # buy, sell, create_token, graduate
│       ├── state/             # BondingCurveState account
│       └── errors.rs          # Custom error codes
├── tests/                     # Integration tests (TypeScript)
├── backend/                   # Node.js API server
│   ├── prisma/schema.prisma   # Database schema
│   └── src/
│       ├── index.ts           # Express server + Socket.io
│       ├── config.ts          # Configuration
│       ├── indexer/           # Solana event indexer
│       ├── api/               # REST API routes
│       └── websocket/         # WebSocket broadcasting
└── frontend/                  # Next.js 14 frontend
    └── src/
        ├── app/               # App Router pages
        ├── components/        # React components
        ├── hooks/             # Custom React hooks
        ├── lib/               # Utilities (bonding curve math, API)
        └── providers/         # Wallet + Query providers
```

## Local Development

### Prerequisites

- Node.js 20+
- Rust + Cargo
- Solana CLI 1.18+
- Anchor CLI 0.29+
- PostgreSQL 14+
- Yarn

### 1. Install dependencies

```bash
# Install all dependencies
yarn install

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked
```

### 2. Build the smart contract

```bash
anchor build
```

After building, copy the generated IDL to the frontend/backend:
```bash
cp target/idl/token_launch.json frontend/src/lib/
cp target/idl/token_launch.json backend/src/
```

Update the program ID in `Anchor.toml` and `declare_id!()` in `lib.rs`:
```bash
anchor keys list
```

### 3. Set up the database

```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL connection string

yarn db:generate
yarn db:migrate
```

### 4. Start a local validator

```bash
solana-test-validator --reset
```

Or use the Anchor test validator:
```bash
anchor localnet
```

### 5. Deploy the contract locally

```bash
anchor deploy --provider.cluster localnet
```

### 6. Start the backend

```bash
cd backend
yarn dev
# Server starts at http://localhost:4000
```

### 7. Start the frontend

```bash
cd frontend
cp .env.example .env
# Edit NEXT_PUBLIC_PROGRAM_ID with your deployed program ID
yarn dev
# App starts at http://localhost:3000
```

### 8. Run tests

```bash
anchor test
```

## Devnet Deployment

### 1. Get devnet SOL

```bash
solana airdrop 2 --url devnet
```

### 2. Build and deploy

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### 3. Update configuration

Update `Anchor.toml` `[programs.devnet]` and both `.env` files with the deployed program ID.

### 4. Configure backend for devnet

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WS_URL=wss://api.devnet.solana.com
PROGRAM_ID=<your-deployed-program-id>
```

## API Reference

### REST Endpoints

```
GET  /api/tokens                    # List tokens (sort: new|trending|graduating)
GET  /api/tokens/:mint              # Token details + stats
POST /api/tokens                    # Register new token (called after on-chain tx)
GET  /api/tokens/:mint/ohlcv        # Candlestick data (interval: 1m|5m|1h|1d)

GET  /api/trades/:mint              # Trades for a token
GET  /api/trades/user/:wallet       # User's trade history

GET  /api/leaderboard/tokens        # Top tokens by volume/marketcap
GET  /api/leaderboard/traders       # Top traders
```

### WebSocket Events

**Client → Server:**
- `subscribe:token <mint>` — Join token room for price updates
- `unsubscribe:token <mint>` — Leave token room
- `subscribe:feed` — Join global live feed

**Server → Client:**
- `price_update` — Real-time price/reserves update
- `new_trade` — New trade on subscribed token
- `feed_trade` — Any trade (global feed)
- `token_created` — New token launched
- `token_graduated` — Token graduated to DEX

## Key Design Decisions

### Why constant product (x*y=k)?

The constant product formula ensures that:
1. Price always increases with buys, decreases with sells
2. The price impact of large trades is visible upfront
3. There's always liquidity available at any price point

The virtual reserves act as a "price floor" — the initial 30 SOL virtual offset means the starting market cap is non-zero and the initial price is ~$0.000028 SOL per token.

### Why 85 SOL graduation threshold?

This mirrors pump.fun's graduation mechanics. At 85 SOL real reserves, the bonding curve has discovered sufficient market interest to warrant permanent DEX liquidity. The reserve tokens (20.69%) are paired with the raised SOL to create an LP position.

### Anti-rug mechanics

1. All tokens are minted directly to the bonding curve vault at launch
2. The creator has no ability to withdraw from the curve
3. The bonding curve program is immutable (no upgrade authority after deployment)
4. At graduation, LP tokens are burned/locked, preventing rug pulls

## Security Considerations

- All arithmetic uses checked math to prevent overflow
- Slippage protection on all trades (`min_tokens_out`, `min_sol_out`)
- PDA signer validates all vault operations
- Creator fee is hardcoded at 10% of the 1% trade fee
- The `complete` flag is set atomically when graduation is reached

## License

MIT
