# JetForge — Project Memory for Claude

## What is JetForge
Permissionless Solana token launchpad with a bonding curve AMM. Creators launch tokens in seconds, traders buy/sell on the curve, tokens graduate to Raydium DEX at 85 SOL.

Live at: https://jetforge.io
API at: https://api.jetforge.io
VPS: 187.77.143.74 (root)
Repo: /var/www/jetforge

## Stack
- Frontend: Next.js (port 3000), /var/www/jetforge/frontend
- Backend: Node.js/Express (port 4000), /var/www/jetforge/backend
- DB: PostgreSQL via Prisma
- Chain: Solana devnet → mainnet
- Smart contract: Anchor/Rust, program ID: 7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk
- Process manager: PM2 (jetforge-frontend, jetforge-backend)
- Nginx proxies api.jetforge.io → localhost:4000

## Bonding Curve
- 70/30 split: 700M tokens on curve, 300M reserved for Raydium
- Virtual SOL start: 30 SOL
- Graduation threshold: 85 SOL (85_000_000_000 lamports)
- Constant product AMM: x*y=k

## Fee Structure (Trading — 1% per trade)
| Recipient | Share | Amount on 100 SOL volume |
|---|---|---|
| Creator vault (on-chain) | 40% | 0.40 SOL |
| Platform treasury | 20-30% | 0.20-0.30 SOL |
| Buyback vault (on-chain) | 20% | 0.20 SOL |
| Referrer (DB accumulation) | 10% | 0.10 SOL |
| Referred user cashback | 10% (first 30 days) | 0.10 SOL |

Fee with referral + cashback active: platform keeps 20% instead of 40%.
Creator and buyback shares NEVER change regardless of referral.

## Graduation Fee (One-time at 85 SOL)
- 90% → Raydium DEX liquidity (LP tokens burned permanently)
- 5% → Creator reward
- 5% → Platform treasury

## Post-Graduation
- Trading on Raydium CPMM: 0.25% fee (goes to LP holders)
- JetForge earns nothing post-graduation

## Referral System (implemented)
### How it works
- Creator gets unique referral link: jetforge.io/r/[code]
- New user clicks link → code stored in localStorage
- User connects wallet → auto-registered as creator's referral (first referrer wins)
- Every trade by referred user → referrer earns 10% of platform's fee cut
- Earnings accumulate in DB (ReferralAccount.pendingBalance)
- Minimum withdrawal: 0.1 SOL, 24h cooldown between withdrawals
- Referred user gets 10% cashback for first 30 days (stored in ReferralLink.cashbackBalance)
- Cashback minimum claim: 0.05 SOL

### Abuse Prevention
- Self-referral: blocked server-side
- Circular referral (A→B, B→A): blocked
- Rate limit: max 50 new referrals per referrer per 24h
- Minimum trade size: 0.05 SOL (dust ignored)
- Cashback expires after 30 days
- Wallet format validation (base58)

### DB Tables
- ReferralAccount: wallet (PK), referralCode (unique), pendingBalance, totalEarned, totalReferrals, lastWithdrawnAt
- ReferralLink: id, referredWallet (unique), referrerWallet, cashbackBalance, cashbackEarned, createdAt

### API Endpoints
- GET /api/referral/code (auth) — get/create referral account
- GET /api/referral/stats/:wallet — public stats
- GET /api/referral/dashboard (auth) — private dashboard
- POST /api/referral/register — register new referral link
- POST /api/referral/withdraw (auth) — request withdrawal
- GET /api/referral/cashback (auth) — referred user's cashback
- POST /api/referral/cashback/claim (auth) — claim cashback

## Creator Profiles (implemented)
- /creators — leaderboard with avatars, display names, volume, badges
- /creators/[wallet] — individual profile with:
  - Display name, bio, avatar, Twitter/Website links
  - Follow/unfollow with counts
  - Posts feed (social updates)
  - Referral stats (public) + dashboard (owner only)
  - Tokens launched table
- Auth: wallet signature → JWT (7 days), stored in localStorage as 'jf_token'

### DB Tables
- CreatorProfile: wallet (PK), displayName, bio, avatarUrl, twitterUrl, websiteUrl
- CreatorPost: id, wallet, content, imageUrl, createdAt
- Follow: follower, following (compound unique)

## Key API Files
- /backend/src/api/tokens.ts — token CRUD, price feeds (CoinGecko SOL/USD cached 10min)
- /backend/src/api/creators.ts — creator profiles, follow, posts
- /backend/src/api/referral.ts — referral system
- /backend/src/api/auth.ts — wallet signature auth (nacl + JWT)
- /backend/src/api/upload.ts — dual-store: local disk + Arweave
- /backend/src/indexer/index.ts — blockchain event listener (BuyEvent, SellEvent, TokenCreatedEvent, GraduationEvent)

## Image Storage (Dual-store)
- Primary: local disk at /var/www/jetforge/backend/uploads/
- Secondary: Arweave (Irys node) — permanent storage
- Token images saved locally first (fast), Arweave upload in background
- DB imageUrl = local URL; Arweave URL used in metadata JSON

## Common Commands
```bash
# Rebuild and restart
cd /var/www/jetforge/backend && npm run build && pm2 restart jetforge-backend
cd /var/www/jetforge/frontend && npm run build && pm2 restart jetforge-frontend

# Logs
pm2 logs jetforge-backend --lines 50 --nostream
pm2 logs jetforge-frontend --lines 50 --nostream

# DB
grep DATABASE_URL /var/www/jetforge/backend/.env
```

## Environment
- NEXT_PUBLIC_API_URL=https://api.jetforge.io/api (frontend .env.production — already includes /api, strip it when building base URL)
- JWT_SECRET set in backend .env
- API_BASE in frontend components: strip trailing /api from NEXT_PUBLIC_API_URL
