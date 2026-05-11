# JetForge Developer Notes

## Mobile Wallet Deep-Links

### ✅ Phantom iOS / Android — CORRECT URL format

```
https://phantom.app/ul/browse/{encodedUrl}?ref={encodedOrigin}
```

**Critical rules:**
- Domain:  `phantom.app`  (NOT phantom.com — that is just a marketing redirect)
- Path:    `/ul/browse/`  (NO `/v1/` — the versioned path does not exist in Phantom's router)
- `url`:   full current page URL, URL-encoded with encodeURIComponent()
- `ref`:   site **origin only** (no path), URL-encoded  e.g. `https%3A%2F%2Fjetforge.io`

**Working example (from Phantom's own docs):**
```
https://phantom.app/ul/browse/https%3A%2F%2Fmagiceden.io%2Fitem-details%2Fabc?ref=https%3A%2F%2Fmagiceden.io
```

**What went wrong during development (do not repeat):**

| Attempt | URL used | Result |
|---------|----------|--------|
| ❌ 1 | `phantom.app/ul/v1/browse/...` | Phantom opens, home screen (wrong path) |
| ❌ 2 | `phantom://v1/browse/...` | Phantom opens, home screen (wrong path) |
| ❌ 3 | `phantom.com/ul/v1/browse/...` | Phantom opens, home screen (wrong domain + wrong path) |
| ✅ 4 | `phantom.app/ul/browse/...` | Phantom opens JetForge in its browser ✓ |

**Why the domain confusion:** `phantom.app/.well-known/apple-app-site-association` 301-redirects
to `phantom.com`. iOS does NOT follow redirects for AASA files (pre-iOS 14 CDN behaviour).
However the path was the actual bug — `/v1/` does not exist. The docs at
`docs.phantom.com/phantom-deeplinks/other-methods/browse` show the correct path clearly.

---

### ✅ Solflare iOS / Android — CORRECT URL format

```
https://solflare.com/ul/v1/browse/{encodedUrl}?ref={encodedUrl}
```

Note: Solflare DOES use `/v1/` in its path. Different app, different routing.

---

### iOS Universal Link behaviour (important)

- Universal Links are intercepted by iOS when the app is installed AND the domain's
  `apple-app-site-association` file registers the path.
- iOS does NOT follow 301/302 redirects when fetching AASA files (pre-iOS 14).
  From iOS 14+, Apple fetches AASA via their own CDN which may follow redirects,
  but never rely on this — always use the canonical domain.
- If a user has previously tapped "Open in Safari" on a Universal Link, iOS disables
  Universal Links for that app. The `phantom://` custom scheme bypasses this, but
  Phantom's custom scheme also uses the same path: `phantom://browse/{url}?ref={ref}`.

---

### Desktop wallet detection

- Use `window.phantom?.solana`, `window.solflare`, `window.solana` to detect Solana wallets.
- Do NOT use `wallet.readyState === WalletReadyState.Installed` — MetaMask (Ethereum)
  registers via Wallet Standard as Installed, giving a false positive.

---

### Mobile browser detection

```ts
/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
```

On mobile, never check `window.phantom?.solana` to decide if a wallet is available —
those globals are only set when running INSIDE Phantom's built-in browser.
On regular Chrome/Safari on mobile, always show the deep-link sheet.
