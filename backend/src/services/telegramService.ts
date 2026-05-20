// Telegram notification service for JetForge
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from env
// All functions are safe to call even if env vars are not set (silent no-op)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const BIG_TRADE_THRESHOLD_SOL = parseFloat(process.env.TELEGRAM_ALERT_THRESHOLD_SOL || '1');
const BASE_URL = 'https://jetforge.io';

function isConfigured(): boolean {
  return !!(BOT_TOKEN && CHAT_ID);
}

async function sendMessage(text: string, disablePreview = true): Promise<void> {
  if (!isConfigured()) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: disablePreview,
        disable_notification: false,
      }),
    });
  } catch (err) {
    // Never throw — Telegram outage should never crash the indexer
    console.warn('[telegram] send failed:', (err as Error).message?.slice(0, 80));
  }
}

function progressBar(current: number, target: number, length = 10): string {
  const pct = Math.min(current / target, 1);
  const filled = Math.round(pct * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled) + ` ${(pct * 100).toFixed(1)}%`;
}

function shortWallet(wallet: string): string {
  return wallet.slice(0, 4) + '...' + wallet.slice(-4);
}

// -- New token launched ----------------------------------------------------
export async function notifyNewToken(params: {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  imageUrl?: string;
}): Promise<void> {
  const { mint, name, symbol, creator } = params;
  const url = `${BASE_URL}/token/${mint}`;

  const msg =
    `\u{1F680} <b>New Token Launched!</b>\n\n` +
    `<b>${name}</b> (<code>$${symbol}</code>)\n` +
    `Creator: <code>${shortWallet(creator)}</code>\n\n` +
    `${progressBar(0, 85)} of 85 SOL\n\n` +
    `<a href="${url}">Trade on JetForge →</a>`;

  await sendMessage(msg);
}

// -- Big buy alert ---------------------------------------------------------
export async function notifyBigBuy(params: {
  mint: string;
  name: string;
  symbol: string;
  buyer: string;
  solAmount: bigint;
  tokenAmount: bigint;
  newPriceSol: number;
  reserveSol: number;
}): Promise<void> {
  const { mint, name, symbol, buyer, solAmount, newPriceSol, reserveSol } = params;
  const sol = Number(solAmount) / 1e9;

  if (sol < BIG_TRADE_THRESHOLD_SOL) return;

  const url = `${BASE_URL}/token/${mint}`;
  const progress = progressBar(reserveSol, 85);

  const msg =
    `\u{1F7E2} <b>Big Buy!</b> ${name} (<code>$${symbol}</code>)\n\n` +
    `\u{1F4B0} <b>${sol.toFixed(3)} SOL</b> bought\n` +
    `\u{1F464} Buyer: <code>${shortWallet(buyer)}</code>\n` +
    `\u{1F4C8} Price: ${newPriceSol.toFixed(8)} SOL\n\n` +
    `Bonding curve: ${progress}\n` +
    `${reserveSol.toFixed(2)} / 85 SOL\n\n` +
    `<a href="${url}">Trade →</a>`;

  await sendMessage(msg);
}

// -- Big sell alert --------------------------------------------------------
export async function notifyBigSell(params: {
  mint: string;
  name: string;
  symbol: string;
  seller: string;
  solAmount: bigint;
  newPriceSol: number;
  reserveSol: number;
}): Promise<void> {
  const { mint, name, symbol, seller, solAmount, newPriceSol, reserveSol } = params;
  const sol = Number(solAmount) / 1e9;

  if (sol < BIG_TRADE_THRESHOLD_SOL) return;

  const url = `${BASE_URL}/token/${mint}`;
  const progress = progressBar(reserveSol, 85);

  const msg =
    `\u{1F534} <b>Big Sell!</b> ${name} (<code>$${symbol}</code>)\n\n` +
    `\u{1F4B8} <b>${sol.toFixed(3)} SOL</b> sold\n` +
    `\u{1F464} Seller: <code>${shortWallet(seller)}</code>\n` +
    `\u{1F4C9} Price: ${newPriceSol.toFixed(8)} SOL\n\n` +
    `Bonding curve: ${progress}\n` +
    `${reserveSol.toFixed(2)} / 85 SOL\n\n` +
    `<a href="${url}">Trade →</a>`;

  await sendMessage(msg);
}

// -- Graduation alert ------------------------------------------------------
export async function notifyGraduation(params: {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  totalRaisedSol: number;
}): Promise<void> {
  const { mint, name, symbol, creator, totalRaisedSol } = params;
  const url = `${BASE_URL}/token/${mint}`;

  const msg =
    `\u{1F393} <b>TOKEN GRADUATED!</b> \u{1F389}\n\n` +
    `<b>${name}</b> (<code>$${symbol}</code>) has hit 85 SOL!\n\n` +
    `✅ Liquidity moved to Raydium DEX permanently\n` +
    `\u{1F4B0} Total raised: <b>${totalRaisedSol.toFixed(2)} SOL</b>\n` +
    `\u{1F464} Creator: <code>${shortWallet(creator)}</code>\n\n` +
    `$${symbol} is now trading on Raydium \u{1F680}\n\n` +
    `<a href="${url}">View on JetForge →</a>`;

  await sendMessage(msg);
}
