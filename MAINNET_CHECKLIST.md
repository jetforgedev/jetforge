# Before-Mainnet Checklist

This project is currently in **DEVNET-TEST mode**. The following changes are required before any mainnet deployment. All items are tagged `DEVNET-TEST` in code comments across the repo.

---

## 🔴 Program (Requires Recompile + Redeploy)

These constants are burned into the on-chain binary. Changing them requires a full `anchor build` + `anchor deploy` + program ID update everywhere.

- [ ] **GRADUATION_THRESHOLD**: change from `500_000_000` (0.5 SOL) to `85_000_000_000` (85 SOL)
  - `programs/token-launch/src/state/bonding_curve.rs`
- [ ] **BUYBACK_THRESHOLD**: change from `100_000_000` (0.1 SOL) to production value (e.g. `1_000_000_000` = 1 SOL)
  - `programs/token-launch/src/state/bonding_curve.rs`
- [ ] **TREASURY_PUBKEY**: confirm `13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW` is the intended mainnet treasury address (or substitute a new one)
  - `programs/token-launch/src/lib.rs`
- [ ] After redeploy, update program ID in:
  - `Anchor.toml` (all three `[programs.*]` entries)
  - `frontend/.env.local` → `NEXT_PUBLIC_PROGRAM_ID`
  - `backend/.env` → `PROGRAM_ID`

---

## 🔴 Security

- [ ] **Rotate treasury keypair**: the devnet keypair currently in `backend/.env` must never be used for mainnet funds. Generate a new keypair with `solana-keygen new`.
- [ ] **Confirm `backend/.env` is NOT tracked by git**: run `git ls-files backend/.env` — it must return nothing. If it does, run `git rm --cached backend/.env` and commit.
- [ ] **Confirm no secrets in git history**: run `git log --all --full-history -- backend/.env` to verify.

---

## 🔴 Cluster / RPC

- [ ] **Backend RPC**: set `SOLANA_RPC_URL` and `SOLANA_WS_URL` in `backend/.env` to a paid mainnet endpoint (e.g. Helius, Triton, QuickNode). Remove devnet defaults.
  - `backend/src/config.ts` — remove the devnet fallback strings after confirming env vars are always set.
- [ ] **Frontend RPC**: set `NEXT_PUBLIC_SOLANA_RPC` in `frontend/.env.local` to mainnet endpoint.
  - `frontend/src/lib/solana.ts`
- [ ] **Frontend network**: set `NEXT_PUBLIC_NETWORK=mainnet-beta` in `frontend/.env.local`.
  - `frontend/src/providers/WalletProvider.tsx`
- [ ] **Frontend API/WS**: set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to production backend URLs.
  - `frontend/src/lib/api.ts`, `frontend/src/hooks/useLiveFeed.ts`

---

## 🔴 Raydium

- [ ] **Confirm cluster switch works**: `raydiumService.ts` now selects `DEVNET_PROGRAM_ID` vs `MAINNET_PROGRAM_ID` based on whether the RPC URL contains "devnet". When `SOLANA_RPC_URL` is set to mainnet, `MAINNET_PROGRAM_ID` is used automatically. Verify this with a dry-run simulation before first live graduation.
  - `backend/src/services/raydiumService.ts`
- [ ] **Lock Raydium SDK version**: `@raydium-io/raydium-sdk-v2` is pinned to an alpha release. Either upgrade to stable or lock the exact version (remove `^`) before mainnet.
  - `backend/package.json`

---

## 🟡 Backend

- [ ] **Anchor client version**: sync `@coral-xyz/anchor` in `backend/package.json` from `^0.29.0` to `^0.30.x` (matching the on-chain program's `anchor-lang` version in `programs/token-launch/Cargo.toml`).
- [ ] **Rate limiting**: add `express-rate-limit` middleware to all API routes before public launch.
- [ ] **Polling interval**: reduce indexer polling aggressiveness (`backend/src/indexer/index.ts` — currently 3s). Use 15–30s on mainnet or rely solely on WebSocket subscriptions.
- [ ] **Graduation threshold**: `backend/src/config.ts` `BONDING_CURVE_CONSTANTS.GRADUATION_THRESHOLD` — update to match recompiled program value.
- [ ] **Metadata URL**: `backend/src/api/metadata.ts` — confirm `SITE_URL` env var is set to the production domain before launch (currently falls back to `http://localhost:4000`).

---

## 🟡 Frontend

- [ ] **GRADUATION_THRESHOLD**: update `frontend/src/lib/bondingCurve.ts` to match the new on-chain value after program recompile.
- [ ] **Add deploy script**: add `anchor:deploy:mainnet` to root `package.json` so mainnet deployment is explicit and never accidental.
- [ ] **Custom 404/500 pages**: create `frontend/src/app/not-found.tsx` and `frontend/src/app/error.tsx`.
- [ ] **Fast Trade session key warning**: ensure users understand the session key risk before funding the fast-trade wallet.

---

## 🟡 Docs / Config

- [ ] Update `README.md` line 3–4: change "Solana devnet" to "Solana mainnet" after launch.
- [ ] Update `README.md` contract addresses table: fill in the real mainnet program ID.
- [ ] Add `anchor:deploy:mainnet` script to root `package.json`.
- [ ] Verify `Anchor.toml` `[provider] cluster` is set correctly for the deploy environment.

---

## Final Pre-Deploy Verification

Before opening to the public:
1. Run a full lifecycle test on localnet/devnet with mainnet threshold values (use a fresh validator).
2. Verify the graduation keeper can successfully call `graduate` and the Raydium pool is created.
3. Verify the Raydium pool appears on raydium.io with correct liquidity.
4. Verify LP tokens are burned (sent to incinerator address).
5. Verify explorer links point to mainnet (no `?cluster=devnet` in any toast or UI element).
6. Do a full wallet connect → buy → sell → withdraw creator fees flow on mainnet with a small amount before opening to traffic.
