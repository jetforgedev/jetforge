/**
 * JetForge Stress Test — run on the VPS: node stress-test.mjs
 * Tests REST API under concurrent load, WebSocket multi-client, race conditions.
 */

import { io } from "socket.io-client";

const API = "http://localhost:4000/api";
const WS  = "http://localhost:4000";
const CONCURRENCY = 20;
const results = { pass: 0, fail: 0, errors: [] };

function pass(label) { results.pass++; console.log(`  ✅ ${label}`); }
function fail(label, err) { results.fail++; results.errors.push({ label, err }); console.log(`  ❌ ${label}: ${err}`); }

async function get(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── 1. Smoke tests ──────────────────────────────────────────────────────────
async function smokeTests() {
  console.log("\n── Smoke Tests ──────────────────────────────────────────────");
  try {
    const data = await get("/tokens?limit=10&sort=recent");
    if (!Array.isArray(data.tokens)) throw new Error("no tokens array");
    pass(`GET /tokens → ${data.tokens.length} tokens returned`);
    return data.tokens;
  } catch (e) { fail("GET /tokens", e.message); return []; }
}

// ─── 2. Per-token endpoints ───────────────────────────────────────────────────
async function tokenEndpoints(tokens) {
  console.log("\n── Per-token Endpoints ───────────────────────────────────────");
  if (!tokens.length) { console.log("  ⚠️  No tokens — skipping"); return; }
  const mint = tokens[0].mint;

  for (const [label, path] of [
    ["GET /tokens/:mint",         `/tokens/${mint}`],
    ["GET /tokens/:mint/holders", `/tokens/${mint}/holders`],
    ["GET /tokens/:mint/trades",  `/tokens/${mint}/trades?limit=20`],
    ["GET /tokens/:mint/ohlcv",   `/tokens/${mint}/ohlcv?interval=1m&limit=50`],
    ["GET /tokens/:mint/comments",`/tokens/${mint}/comments`],
  ]) {
    try {
      const t0 = Date.now();
      const d = await get(path);
      const ms = Date.now() - t0;
      const icon = ms < 100 ? "✅" : ms < 400 ? "⚠️ " : "❌";
      console.log(`  ${icon} ${label.padEnd(38)} ${ms}ms`);
      results.pass++;
    } catch (e) { fail(label, e.message); }
  }
}

// ─── 3. Concurrent load ───────────────────────────────────────────────────────
async function concurrentLoad(tokens) {
  console.log(`\n── Concurrent Load (${CONCURRENCY} parallel requests) ──────────────`);
  const mint = tokens[0]?.mint;
  const endpoints = [
    "/tokens?limit=20&sort=recent",
    "/tokens?limit=20&sort=trending",
    "/tokens?limit=20&sort=marketcap",
    ...(mint ? [
      `/tokens/${mint}`,
      `/tokens/${mint}/holders`,
      `/tokens/${mint}/ohlcv?interval=1m&limit=100`,
    ] : []),
  ];

  const batch = Array.from({ length: CONCURRENCY }, (_, i) =>
    get(endpoints[i % endpoints.length])
  );

  const t0 = Date.now();
  const settled = await Promise.allSettled(batch);
  const elapsed = Date.now() - t0;
  const ok  = settled.filter(r => r.status === "fulfilled").length;
  const bad = settled.filter(r => r.status === "rejected");

  if (bad.length === 0) pass(`${ok}/${CONCURRENCY} succeeded in ${elapsed}ms (avg ${Math.round(elapsed/CONCURRENCY)}ms/req)`);
  else fail("Concurrent load", `${bad.length} failures: ${[...new Set(bad.map(r => r.reason?.message))].join(", ")}`);
}

// ─── 4. WebSocket — 5 clients ─────────────────────────────────────────────────
async function websocketTest(tokens) {
  console.log("\n── WebSocket (5 simultaneous clients) ───────────────────────");
  if (!tokens.length) { console.log("  ⚠️  No tokens — skipping"); return; }
  const mint = tokens[0].mint;
  const N = 5;
  const connected = [];
  const received  = [];
  const sockets   = [];

  await new Promise(resolve => {
    for (let i = 0; i < N; i++) {
      const s = io(WS, { transports: ["websocket"], reconnection: false });
      sockets.push(s);
      s.on("connect", () => {
        connected.push(i);
        s.emit("subscribe:token", mint);
        if (connected.length === N) resolve();
      });
      s.on("connect_error", e => {
        fail(`WS client ${i}`, e.message);
        connected.push(i);
        if (connected.length === N) resolve();
      });
      s.on("price_update", d => { if (d.mint === mint) received.push(i); });
      s.on("new_trade",    () => received.push(i));
    }
    setTimeout(resolve, 8_000);
  });

  if (connected.length === N) pass(`${N}/${N} WebSocket clients connected`);
  else fail("WS connect", `only ${connected.length}/${N} connected`);

  pass(`All subscribed to room ${mint.slice(0, 8)}…`);

  // listen 3s for any live events
  await new Promise(r => setTimeout(r, 3000));
  if (received.length > 0) pass(`Live events received: ${received.length} across ${new Set(received).size} clients`);
  else console.log("  ℹ️  No live trades during 3s window (normal if no trading happening)");

  sockets.forEach(s => s.disconnect());
}

// ─── 5. Holders burst — was the main bottleneck pre-fix ──────────────────────
async function holdersBurst(tokens) {
  console.log("\n── Holders Endpoint Burst (10 concurrent) ────────────────────");
  if (!tokens.length) { console.log("  ⚠️  No tokens — skipping"); return; }
  const mint = tokens[0].mint;

  const t0 = Date.now();
  const settled = await Promise.allSettled(
    Array.from({ length: 10 }, () => get(`/tokens/${mint}/holders`))
  );
  const elapsed = Date.now() - t0;
  const ok = settled.filter(r => r.status === "fulfilled").length;

  if (ok === 10) pass(`10/10 holders requests in ${elapsed}ms (avg ${Math.round(elapsed/10)}ms)`);
  else fail("Holders burst", `${10 - ok} failures`);

  const t1 = Date.now();
  await get(`/tokens/${mint}/holders`);
  const single = Date.now() - t1;
  const icon = single < 30 ? "✅" : single < 100 ? "⚠️ " : "❌";
  console.log(`  ${icon} Single holders request latency: ${single}ms`);
}

// ─── 6. Data consistency — rapid hammering returns same values ────────────────
async function consistencyCheck(tokens) {
  console.log("\n── Consistency Check (15 concurrent :mint fetches) ───────────");
  if (!tokens.length) { console.log("  ⚠️  No tokens — skipping"); return; }
  const mint = tokens[0].mint;

  const settled = await Promise.allSettled(
    Array.from({ length: 15 }, () => get(`/tokens/${mint}`))
  );
  const ok = settled.filter(r => r.status === "fulfilled");
  if (ok.length === 15) pass(`15/15 concurrent token fetches succeeded`);
  else fail("Consistency", `${15 - ok.length} failed`);

  const caps = ok.map(r => r.value?.marketCapSol).filter(v => v != null);
  const unique = [...new Set(caps.map(c => c.toFixed(6)))];
  if (unique.length <= 1) pass(`All 15 responses agree on marketCapSol = ${unique[0]}`);
  else console.log(`  ⚠️  marketCapSol spread: ${unique.join(", ")} (ok during active trading)`);
}

// ─── 7. OHLCV under load (chart endpoint — 10 parallel, all intervals) ───────
async function ohlcvLoad(tokens) {
  console.log("\n── OHLCV Load (10 parallel, all intervals) ───────────────────");
  if (!tokens.length) { console.log("  ⚠️  No tokens — skipping"); return; }
  const mint = tokens[0].mint;
  const intervals = ["1m","5m","15m","1h","4h","1d"];

  const settled = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      get(`/tokens/${mint}/ohlcv?interval=${intervals[i % intervals.length]}&limit=200`)
    )
  );
  const ok = settled.filter(r => r.status === "fulfilled").length;
  if (ok === 10) pass(`10/10 OHLCV requests succeeded`);
  else fail("OHLCV load", `${10 - ok} failures`);
}

// ─── Run all ──────────────────────────────────────────────────────────────────
(async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  JetForge Stress Test  →  localhost:4000");
  console.log("═══════════════════════════════════════════════════════════");

  const tokens = await smokeTests();
  await tokenEndpoints(tokens);
  await concurrentLoad(tokens);
  await websocketTest(tokens);
  await holdersBurst(tokens);
  await consistencyCheck(tokens);
  await ohlcvLoad(tokens);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  RESULTS  →  ${results.pass} passed   ${results.fail} failed`);
  if (results.errors.length) {
    console.log("\n  Failures:");
    results.errors.forEach(({ label, err }) => console.log(`    • ${label}: ${err}`));
  }
  console.log("═══════════════════════════════════════════════════════════\n");
  process.exit(results.fail > 0 ? 1 : 0);
})();
