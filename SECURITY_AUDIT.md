# JetForge Security Audit — On-Chain Program + Backend

**Date:** 2026-08-31 · **Scope:** `programs/token-launch` (Rust/Anchor) and `backend/src` (Node/indexer/keeper/payouts) · **Basis:** `origin/main` @ `20b9c98` · **Type:** read-only review, no code changed.

Severity = likelihood × impact for a platform holding real SOL. "CRITICAL (conditional)" means it becomes trivial-to-exploit if a specific env var is unset in production — verify those on the VPS.

---

## Headline findings

| # | Sev | Area | Issue |
|---|-----|------|-------|
| 1 | **CRITICAL** | referral | Double-/N-withdrawal race in `/withdraw` & `/cashback/claim` — treasury drain |
| 2 | **HIGH (CRITICAL if env unset)** | auth | Fallback secrets: default `JWT_SECRET`; `ADMIN_SECRET` `undefined===undefined` bypass on `/upload/fund` |
| 3 | **HIGH** | auth | Wallet-login signature: expiry bypass, no nonce, no domain binding |
| 4 | **HIGH** | infra | All fund-controlling keys co-located on a box with plaintext root creds |
| 5 | **MEDIUM** | referral | Double-credit race in indexer inflates payable balances |
| 6 | **MEDIUM** | rate-limit | Payout endpoints not under the strict write-limiter |
| 7 | **MEDIUM** | upload | Unauthenticated `/upload/token` burns real Arweave funds |
| 8 | **MEDIUM** | referral | `/register` hijack — pre-register others' wallets under attacker code |
| 9 | **MEDIUM** | program | Token metadata `is_mutable = true`, update authority = creator (rug-rename) |
| 10 | **LOW** | program | Freeze authority left set; mint authority not revoked (dormant) |
| 11 | **LOW** | program | Sell output cap desyncs virtual reserves from the invariant (edge case) |
| 12 | **INFO** | program | `BUYBACK_THRESHOLD` comment says 1 SOL, value is 0.1 SOL |

---

## 1. CRITICAL — Double-withdrawal race in referral payouts
`backend/src/api/referral.ts` — `/withdraw` (159) and `/cashback/claim` (255)

The flow is read balance → `await payoutSol()` (a multi-second on-chain send) → set balance to 0. There is **no lock, no DB transaction, and no atomic conditional update**. Two requests bearing the same JWT, fired concurrently, both read `pendingBalance ≥ MIN` and both pass the cooldown check (which reads `lastWithdrawnAt` *before* it is written), then both call `payoutSol`. The treasury pays the balance **once per concurrent request**; both then set it to 0.

**Exploit:** authenticate once, fire ~10 parallel `POST /api/referral/withdraw`. Get paid ~10× a balance owed once. Repeat until treasury empty. The 300/min general limiter does not stop this — 2 concurrent requests already suffice.

**Fix:** make the debit atomic and do it *before* the transfer. Reserve the balance with a single conditional write and only pay what you reserved:
```ts
const claimed = await prisma.referralAccount.updateMany({
  where: { wallet, pendingBalance: { gte: MIN_REFERRAL_WITHDRAWAL },
           OR: [{ lastWithdrawnAt: null },
                { lastWithdrawnAt: { lt: new Date(Date.now() - WITHDRAWAL_COOLDOWN_MS) } }] },
  data: { pendingBalance: 0, lastWithdrawnAt: new Date() },
});
if (claimed.count === 0) return res.status(400)./* nothing to withdraw / cooldown */;
// pay `amount` captured just before; on payout failure, credit it back.
```
Also add a per-wallet in-flight mutex and treat a failed payout as a compensating credit (or a `PENDING` payout row) rather than a silent re-open.

---

## 2. HIGH — Fallback secrets create auth bypasses
- `backend/src/api/auth.ts:7` and `referral.ts:8`: `const JWT_SECRET = process.env.JWT_SECRET || 'jetforge-secret-change-in-prod'`. If the env var is unset in prod, anyone forges a JWT for **any** wallet (`jwt.sign({wallet}, 'jetforge-secret-change-in-prod')`) and withdraws that wallet's referral/cashback balance. **Fail-fast on startup if `JWT_SECRET` is missing; never ship a literal fallback.**
- `backend/src/api/upload.ts:304`: `if (secret !== process.env.ADMIN_SECRET) return 403`. If `ADMIN_SECRET` is unset, a request that omits `secret` yields `undefined !== undefined` → `false` → the guard passes. `/api/upload/fund` then calls `irys.fund()`, moving real value from the Arweave-funding wallet. **Require the env var at boot and use a constant-time compare.**

---

## 3. HIGH — Wallet-login signature verification is weak
`backend/src/api/auth.ts`
- **Expiry bypass:** timestamp is scraped with `message.match(/(\d+)$/)`. If the signed message doesn't end in digits, `tsMatch` is null and the 5-minute check is **skipped entirely** — the signature never expires.
- **No nonce / not single-use:** any captured signature replays within the window; nothing is stored to burn it.
- **No domain/purpose binding:** the server accepts *any* message the wallet ever signed (ending in a fresh-enough number). A signature harvested by an unrelated dApp can be replayed here.

**Fix:** server-issued single-use nonce (short TTL, stored, deleted on use); require a fixed message template (`"JetForge login\nnonce:<n>\nissued:<ts>"`) and validate every field server-side; reject when the timestamp is absent.

---

## 4. HIGH — Key concentration / hot-wallet custody
`payoutService.ts`, `graduateKeeper.ts`, `raydiumService.ts` load `TREASURY_PRIVATE_KEY`; `telegramTradingBot.ts` holds `TELEGRAM_ENCRYPTION_KEY` which decrypts **every** bot user's Solana private key (stored ciphertext in the DB). The treasury key is simultaneously the fee sink, the payout source, and the keeper funder. All of these sit in `.env` on the deploy VPS — the same box whose **root password appears in plaintext** in the leftover `deploy.py` / `ssh_*.py` scripts. One host compromise = treasury **and** all custodial bot wallets drained.

**Fix:** rotate the VPS root credential and the treasury keypair; move payouts behind a dedicated low-balance hot wallet topped up from cold storage; store `TELEGRAM_ENCRYPTION_KEY` in a secrets manager / KMS, not alongside the ciphertext it protects; audit git history for any committed `.env`.

*Note — the AES-256-GCM construction itself (random IV, auth tag, 32-byte key length check at startup) is correct; the risk is key placement, not the crypto.*

---

## 5. MEDIUM — Referral double-credit race in the indexer
`backend/src/indexer/index.ts` — `creditReferral` (28), called at 249 (buy) / 418 (sell)

The WebSocket `onLogs` handler and the polling fallback can process the same signature concurrently. Both pass the `trade.findUnique({signature})` dedup check before either inserts, then both call the fire-and-forget `creditReferral(...).catch(()=>{})`. The unique constraint on `trade.signature` blocks the duplicate *trade row*, but the referral/cashback `increment` writes are independent and both land — inflating payable balances that later convert to real SOL via finding #1.

**Fix:** perform the credit inside the same transaction/idempotency boundary as the trade insert — e.g. credit only in the code path that actually created the trade row (guard on `create` success / `P2002`), or key the credit off the trade signature.

---

## 6. MEDIUM — Payout endpoints not under the strict write-limiter
`backend/src/index.ts:69` applies the 20/min `writeLimiter` to `/api/tokens`, `/api/comments`, `/api/upload` only. `/api/referral/*` and `/api/auth/*` get just the 300/min general limiter — ample room to exploit #1. Add `/api/referral` (and ideally `/api/auth`) to the write-limiter list, and add a per-wallet limiter on withdraw/claim.

---

## 7. MEDIUM — Unauthenticated `/upload/token` spends real Arweave funds
`backend/src/api/upload.ts:194` uploads image + metadata to Arweave via Irys with no auth. At 20/min/IP across many IPs an attacker steadily drains the project's Arweave balance (the low-balance Telegram alert is only reactive). Gate token/metadata uploads behind wallet auth, or defer the paid Arweave upload until an on-chain `create_token` for that mint is observed.

---

## 8. MEDIUM — Referral registration hijack
`backend/src/api/referral.ts:101` `/register` is unauthenticated and takes `visitorWallet` on trust (format-checked only). `referredWallet` is unique and first-writer-wins, so an attacker can pre-register popular/known wallets under their own code before the real referrer — stealing referral credit and permanently blocking the legitimate link. Bind registration to a signed action from the visitor wallet, or make it best-effort and non-authoritative.

---

## Program findings (on-chain)

The Anchor program is well-constructed: checked arithmetic throughout, PDA/`has_one`/treasury/creator constraints validated, permissionless `graduate`/`buyback` are safe because destinations are hardcoded/validated, and reserve/lamport accounting stays in sync across buy/sell/buyback/graduate. No fund-loss bug found in the trading math. Remaining items are trust-model and hygiene:

- **9. MEDIUM — `create_token.rs:427` sets `is_mutable = true` with update authority = creator.** The creator can later change the token's name/symbol/URI (bait-and-switch after buyers are in). Most launchpads set `is_mutable = false` for a fair-launch token. Decide deliberately.
- **10. LOW — mint freeze authority is set to the bonding-curve PDA and mint authority is never revoked.** No instruction exercises either, so they're dormant and safe, but a "trustless" token normally has both revoked so holders can verify immutability on-chain.
- **11. LOW — `bonding_curve.rs:123` caps sell output at `real_sol_reserves`, then `apply_sell` subtracts the *capped* value from `virtual_sol_reserves`.** In the edge case where the raw curve output exceeds real reserves, this desyncs virtual reserves from the constant-product invariant — a pricing anomaly, not a drain.
- **12. INFO — `bonding_curve.rs:43` `BUYBACK_THRESHOLD = 100_000_000` (0.1 SOL) but the comment says "MAINNET-READY: 1 SOL".** Reconcile before mainnet.

---

## What looks good
- On-chain: exhaustive `checked_*` math; treasury pubkey hardcoded in the program; graduation idempotent and permissionless-safe; keeper deduped (in-flight set + DB + on-chain pre-flight).
- Backend: Prisma `$queryRaw` uses parameterized tagged templates (no SQLi); uploads validate magic bytes and re-encode via Sharp; AES-256-GCM correctly built; `/v1/trade/prepare` returns an **unsigned** tx (non-custodial for the public API); payout only ever pays the JWT's own wallet; `trust proxy` set to a hop count (1), not `true`.

---

## Deep-dive addendum (second pass)

### 13. MEDIUM — Liquidity lock at graduation is best-effort (rug-enabling on failure)
`backend/src/services/raydiumService.ts:203`, swallow at `:251`

The "liquidity permanently locked" guarantee depends on `burnLpTokens` sending the treasury's LP tokens to the incinerator. Two ways it silently doesn't happen, each leaving **redeemable LP in the treasury hot wallet** (i.e. liquidity is *not* locked and can later be pulled):
- **Swallowed failure:** the burn is wrapped and its failure is explicitly *non-fatal* — `catch { console.error("LP burn failed (non-fatal)") }`. Pool exists, LP unburned, no retry, no alert.
- **Commitment race:** immediately after pool creation it reads `treasuryLpAta.amount`; if the freshly-minted LP isn't visible yet (`amount === 0n`), it logs "No LP tokens to burn" and returns — again leaving LP unburned.

**Fix:** make the LP burn mandatory and idempotent — retry with backoff until the treasury LP balance is 0, persist a `lpBurned` flag per mint, alert on failure, and never mark the graduation "done" until burn is confirmed. Consider routing LP to a burn address inside the same flow that reads its balance at `finalized`.

### 14. MEDIUM — Graduation marks `isGraduated=true` before the pool exists; pool creation is fire-and-forget with no retry
`backend/src/indexer/index.ts:551` (`handleGraduationEvent`)

The token is set `isGraduated: true` and the UI switches to "trade on Raydium", then `createRaydiumPool(...)` is launched fire-and-forget (`.then/.catch`, no await, no queue). If it throws (pinned **alpha** Raydium SDK, RPC, compute), the **95% SOL + 300M tokens sit stranded in the treasury** with no automatic recovery, no persistent "pending pool" record, and only a `console.error`. The sole idempotency guard is `raydiumPoolId` being stored on success. **Fix:** persist a durable "graduation → pool" job with retry/backoff and alerting; don't advertise Raydium trading until `raydiumPoolId` is set.

### 15. MEDIUM — Money stored as `Float`; no payout/idempotency ledger
`backend/prisma/schema.prisma` — `ReferralAccount.pendingBalance/totalEarned` and `ReferralLink.cashbackBalance/cashbackEarned` are `Float` (Postgres double), credited via `Number(feeLamports)/1e9 * …` in `indexer/index.ts:creditReferral`. Floating-point accumulation of money drifts and interacts imprecisely with the `>= MIN` thresholds. There is also **no `Payout` table / idempotency key** — payouts leave no auditable ledger and nothing ties a payout to a unique claim (this is what makes finding #1 unbounded). **Fix:** store balances as integer lamports (`BigInt`) or `Decimal`, and add an append-only payout ledger with a unique claim key.

### 16. INFO — Economic: Raydium opening price is decoupled from the curve's final price
The pool is seeded with 90% of raised SOL against the fixed 300M reserve tokens, while the bonding curve closes at a much higher per-token price. The discontinuity creates a first-block snipe window on the new pool. Inherent to the 70/30 model (pump.fun has the analogue) — flagging so it's a deliberate choice, not an accident.

### 17. LOW — Minor signature/authz gaps
- `api/comments.ts`: the signature is bound to the mint (good) but has **no nonce/timestamp**, so the same signed comment can be replayed (duplicate-post spam). 
- `api/follows.ts`: follow/unfollow is **unauthenticated by design** ("wallet IS identity"); anyone can inflate any wallet's follower count, which feeds creator rankings/leaderboard. Low, but it pollutes a ranked surface.

*Positive confirmations this pass:* the Telegram bot uses `polling` (Telegram-authenticated `from.id`, no webhook spoofing) and `/withdraw` only moves the user's **own** wallet to a user-chosen address; `comments` and `creators` profile/posts/avatar correctly enforce wallet ownership (`walletFromToken === wallet` / signature); the shared Prisma singleton is consistent; Holder/volume tables are derived only from on-chain events (no client-trusted balances).

---

## Fixes applied (branch `fix/security-hardening`)

Backend + on-chain source fixes are committed on this branch. **Nothing was deployed** — the VPS picks these up only when you run your deploy, and the on-chain program only changes after you `anchor build` + `anchor deploy`.

| # | Status | What changed |
|---|--------|--------------|
| 1 | ✅ Fixed | `referral.ts` withdraw/claim now debit via an atomic compare-and-set inside a transaction that also writes a PENDING `Payout` row, **before** the transfer; a concurrent request matches no row and is rejected. Payout failure refunds the balance and marks the row FAILED. Per-wallet in-flight guard added. |
| 2 | ✅ Fixed | `config.ts` `secrets.jwtSecret` throws in production if `JWT_SECRET` is unset (no baked-in fallback); `auth.ts`, `referral.ts`, `creators.ts` use it. `/upload/fund` now refuses when `ADMIN_SECRET` is unset and uses a constant-time compare. |
| 3 | ✅ Fixed | `auth.ts` requires the `Sign in to JetForge` prefix + a matching `Wallet:` line + a mandatory fresh `Timestamp:` (rejects missing timestamp — the old expiry bypass). Signature length-checked. Matches the existing frontend message, so no client change needed. |
| 5/6 | ✅ Fixed | `index.ts` adds `/api/referral` + `/api/auth` to the write-limiter and a 5 req/min limiter on the two payout routes. |
| 13 | ✅ Fixed | `raydiumService.ts` LP burn is now retrying + mandatory, reads balance at `finalized`, returns a boolean, and alerts ops (`telegram.notifyOps`) on failure instead of swallowing it. |
| 14 | ✅ Fixed | `indexer.ts` retries pool creation (5×, backoff), persists `raydiumLpBurned`, guards against WS+poll double-creation, and alerts ops if funds end up stranded. |
| 15 | ✅ Fixed | Money columns → `Decimal(20,9)`; new append-only `Payout` ledger (kind/status/txSig). Migration `20260831000000_security_hardening`. |
| 9 | ✅ Fixed (source) | `create_token.rs` metadata `is_mutable = false`. |
| 10 | ✅ Fixed (source) | `create_token.rs` revokes mint + freeze authority after metadata (fixed supply, unfreezable). |
| 12 | ✅ Fixed (source) | `BUYBACK_THRESHOLD` comment corrected to 0.1 SOL with a mainnet note. |
| 11 | 📝 Documented | Sell-cap invariant divergence documented in `bonding_curve.rs`; logic intentionally unchanged (it's a safety cap, not a fund-loss path). |
| 4 | ⛔ Yours | Rotate the VPS root password + treasury keypair; move `TELEGRAM_ENCRYPTION_KEY`/treasury key to a secrets manager. I can't rotate keys or touch the server. |
| 7 | 📝 Deferred | Unauthenticated `/upload/token` Arweave spend — gating it needs a wallet-auth decision that would change the frontend launch flow; left for you to decide. |
| 8 | 📝 Deferred | `/register` hijack — needs a visitor-signed action (frontend change). |
| 17 | 📝 Deferred | Comment replay / unauthenticated follows — low; left as-is. |

**Verification notes:** backend type-checks cleanly against the new schema (the only `tsc` errors are the stale generated Prisma client, which `prisma generate` fixes on deploy). The Rust changes could **not** be compiled in this environment (no MSVC linker on PATH for host `cargo check`); they use standard anchor-spl 0.30 APIs but **must be `anchor build`-verified before redeploy**.

**Deploy steps for the backend fixes:**
1. `cd backend && npx prisma migrate deploy` (applies the Decimal + Payout + lpBurned migration).
2. Ensure `JWT_SECRET` (and `ADMIN_SECRET` if `/upload/fund` is used) are set in `backend/.env` — the server now refuses to start in production without `JWT_SECRET`.
3. `npm run build && pm2 restart` (your `deploy.py` flow).

Existing graduated tokens will show `raydiumLpBurned=false` (the flag is new); this only affects future ops alerts, not historical pools.

---

## Suggested order of remediation
1. Finding **1** (atomic debit) — active drain vector.
2. Finding **2** (fail-fast on `JWT_SECRET` / `ADMIN_SECRET`) and **4** (rotate VPS root + treasury key).
3. Findings **3, 5, 6** (auth hardening + credit idempotency + limiter).
4. Findings **7, 8, 9** and program hygiene **10–12** before mainnet.
