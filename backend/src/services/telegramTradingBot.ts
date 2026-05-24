/**
 * JetForge Telegram Trading Bot
 * Commands: /start /wallet /buy /sell /markets /positions /price /withdraw
 *           /alert /stoploss /tp /alerts /cancelalert /settings /help
 *
 * Architecture:
 *  - Each user gets a bot-managed Solana wallet (keypair encrypted in DB)
 *  - User deposits SOL → bot trades on their behalf → user withdraws profits
 *  - Private keys encrypted with AES-256-GCM using TELEGRAM_ENCRYPTION_KEY env var
 *  - Price alerts, stop-loss, take-profit run as a 30-second background loop
 */

import TelegramBot from "node-telegram-bot-api";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { prisma } from "../index";
import * as crypto from "crypto";
import bs58 from "bs58";

// ─── Config ──────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ENC_KEY   = Buffer.from(process.env.TELEGRAM_ENCRYPTION_KEY || "", "hex");
const API_BASE  = process.env.SITE_URL
  ? `${process.env.SITE_URL}/api`
  : "https://jetforge.io/api";

const PROGRAM_ID   = new PublicKey("7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk");
const TREASURY     = new PublicKey("13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW");
const RPC_URL      = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const TOKEN_DECIMALS = 6;
const FEE_BPS        = BigInt(100);
const BPS_DENOM      = BigInt(10000);
const GRAD_THRESHOLD = BigInt("85000000000");

const connection = new Connection(RPC_URL, "confirmed");

// ─── Encryption ──────────────────────────────────────────────────────────────

function encryptKey(privateKeyBase58: string): string {
  const iv       = crypto.randomBytes(16);
  const cipher   = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKeyBase58, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decryptKey(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    ENC_KEY,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") +
         decipher.final("utf8");
}

// ─── PDAs ────────────────────────────────────────────────────────────────────

function getBondingCurvePDA(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()], PROGRAM_ID
  )[0];
}
function getBuybackVaultPDA(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_vault"), mint.toBuffer()], PROGRAM_ID
  )[0];
}
function getCreatorVaultPDA(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), mint.toBuffer()], PROGRAM_ID
  )[0];
}

// ─── Bonding Curve ───────────────────────────────────────────────────────────

interface CurveState {
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
  complete: boolean;
}

function deserializeCurve(data: Buffer): CurveState {
  let o = 8;
  o += 32 + 32; // mint + creator
  const virtualSolReserves   = data.readBigUInt64LE(o); o += 8;
  const virtualTokenReserves = data.readBigUInt64LE(o); o += 8;
  const realSolReserves      = data.readBigUInt64LE(o); o += 8;
  const realTokenReserves    = data.readBigUInt64LE(o); o += 8;
  o += 8; // totalSupply
  const complete = data[o] === 1;
  return { virtualSolReserves, virtualTokenReserves, realSolReserves, realTokenReserves, complete };
}

function calcBuy(curve: CurveState, solLamports: bigint) {
  const fee           = (solLamports * FEE_BPS) / BPS_DENOM;
  const solAfterFee   = solLamports - fee;
  const k             = curve.virtualSolReserves * curve.virtualTokenReserves;
  const tokensOut     = curve.virtualTokenReserves - k / (curve.virtualSolReserves + solAfterFee);
  const priceImpact   = Number(tokensOut * BigInt(100) / curve.virtualTokenReserves);
  return { tokensOut, fee, solAfterFee, priceImpact };
}

function calcSell(curve: CurveState, tokenAmount: bigint) {
  const k              = curve.virtualSolReserves * curve.virtualTokenReserves;
  const solBeforeFee   = curve.virtualSolReserves - k / (curve.virtualTokenReserves + tokenAmount);
  const fee            = (solBeforeFee * FEE_BPS) / BPS_DENOM;
  const solAfterFee    = solBeforeFee - fee;
  return { solOut: solAfterFee, fee, solBeforeFee };
}

function getPrice(curve: CurveState): number {
  return (Number(curve.virtualSolReserves) / LAMPORTS_PER_SOL) /
         (Number(curve.virtualTokenReserves) / 10 ** TOKEN_DECIMALS);
}

// ─── Anchor discriminators ───────────────────────────────────────────────────

function disc(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest()
  ).subarray(0, 8);
}
const BUY_DISC  = disc("buy");
const SELL_DISC = disc("sell");

// ─── Trade Execution ─────────────────────────────────────────────────────────

async function executeBuy(
  wallet: Keypair,
  mint: PublicKey,
  solLamports: bigint,
  slippageBps: number
): Promise<{ sig: string; tokensOut: bigint; fee: bigint }> {
  const curvePDA    = getBondingCurvePDA(mint);
  const buybackPDA  = getBuybackVaultPDA(mint);
  const creatorPDA  = getCreatorVaultPDA(mint);
  const vaultATA    = getAssociatedTokenAddressSync(mint, curvePDA, true);
  const walletATA   = getAssociatedTokenAddressSync(mint, wallet.publicKey);

  const acc = await connection.getAccountInfo(curvePDA);
  if (!acc) throw new Error("Token not found on-chain");
  const curve = deserializeCurve(Buffer.from(acc.data));
  if (curve.complete) throw new Error("Token has graduated to Raydium");

  const { tokensOut, fee } = calcBuy(curve, solLamports);
  const minOut = (tokensOut * BigInt(10000 - slippageBps)) / BigInt(10000);

  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 })
  );

  const ataInfo = await connection.getAccountInfo(walletATA);
  if (!ataInfo) {
    tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, walletATA, wallet.publicKey, mint));
  }

  const data = Buffer.alloc(24);
  BUY_DISC.copy(data, 0);
  data.writeBigUInt64LE(solLamports, 8);
  data.writeBigUInt64LE(minOut, 16);

  tx.add(new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
      { pubkey: mint,             isSigner: false, isWritable: false },
      { pubkey: curvePDA,         isSigner: false, isWritable: true  },
      { pubkey: vaultATA,         isSigner: false, isWritable: true  },
      { pubkey: walletATA,        isSigner: false, isWritable: true  },
      { pubkey: TREASURY,         isSigner: false, isWritable: true  },
      { pubkey: buybackPDA,       isSigner: false, isWritable: true  },
      { pubkey: creatorPDA,       isSigner: false, isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,             isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,  isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,      isSigner: false, isWritable: false },
    ],
    data,
  }));

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet], {
    commitment: "confirmed", maxRetries: 3,
  });
  return { sig, tokensOut, fee };
}

async function executeSell(
  wallet: Keypair,
  mint: PublicKey,
  tokenAmount: bigint,
  slippageBps: number
): Promise<{ sig: string; solOut: bigint; fee: bigint }> {
  const curvePDA   = getBondingCurvePDA(mint);
  const buybackPDA = getBuybackVaultPDA(mint);
  const creatorPDA = getCreatorVaultPDA(mint);
  const vaultATA   = getAssociatedTokenAddressSync(mint, curvePDA, true);
  const walletATA  = getAssociatedTokenAddressSync(mint, wallet.publicKey);

  const acc = await connection.getAccountInfo(curvePDA);
  if (!acc) throw new Error("Token not found on-chain");
  const curve = deserializeCurve(Buffer.from(acc.data));
  if (curve.complete) throw new Error("Token has graduated to Raydium");

  const { solOut, fee } = calcSell(curve, tokenAmount);
  const minSol = (solOut * BigInt(10000 - slippageBps)) / BigInt(10000);

  const data = Buffer.alloc(24);
  SELL_DISC.copy(data, 0);
  data.writeBigUInt64LE(tokenAmount, 8);
  data.writeBigUInt64LE(minSol, 16);

  const tx = new Transaction();
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10000 }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 })
  );
  tx.add(new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
      { pubkey: mint,             isSigner: false, isWritable: true  },
      { pubkey: curvePDA,         isSigner: false, isWritable: true  },
      { pubkey: vaultATA,         isSigner: false, isWritable: true  },
      { pubkey: walletATA,        isSigner: false, isWritable: true  },
      { pubkey: TREASURY,         isSigner: false, isWritable: true  },
      { pubkey: buybackPDA,       isSigner: false, isWritable: true  },
      { pubkey: creatorPDA,       isSigner: false, isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,             isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,  isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,      isSigner: false, isWritable: false },
    ],
    data,
  }));

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet], {
    commitment: "confirmed", maxRetries: 3,
  });
  return { sig, solOut, fee };
}

// ─── User Wallet Helpers ─────────────────────────────────────────────────────

async function getOrCreateUser(telegramId: string, username?: string, firstName?: string) {
  let user = await (prisma as any).telegramUser.findUnique({ where: { telegramId } });
  if (!user) {
    const kp = Keypair.generate();
    const privateKeyBase58 = bs58.encode(kp.secretKey);
    user = await (prisma as any).telegramUser.create({
      data: {
        telegramId,
        username: username || null,
        firstName: firstName || null,
        encryptedKey: encryptKey(privateKeyBase58),
        walletAddress: kp.publicKey.toBase58(),
      },
    });
  }
  return user;
}

function getUserKeypair(user: any): Keypair {
  const privateKeyBase58 = decryptKey(user.encryptedKey);
  return Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const SOL  = (n: bigint | number) => (Number(n) / LAMPORTS_PER_SOL).toFixed(4);
const TOK  = (n: bigint | number) => (Number(n) / 10 ** TOKEN_DECIMALS).toLocaleString("en-US", { maximumFractionDigits: 2 });
const ADDR = (s: string) => `${s.slice(0, 4)}...${s.slice(-4)}`;
const LINK = (mint: string) => `https://jetforge.io/token/${mint}`;
const EXPLORER = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${RPC_URL.includes("devnet") ? "devnet" : "mainnet"}`;
const bar = (real: bigint, max = GRAD_THRESHOLD, len = 12): string => {
  const pct  = Math.min(Number(real) / Number(max), 1);
  const fill = Math.round(pct * len);
  return "█".repeat(fill) + "░".repeat(len - fill) + ` ${(pct * 100).toFixed(1)}%`;
};

// ─── Alert Checker (background loop) ─────────────────────────────────────────

async function checkAlerts(bot: TelegramBot) {
  const alerts = await (prisma as any).botAlert.findMany({
    where: { isActive: true, triggered: false },
  });
  if (alerts.length === 0) return;

  // Batch: one RPC call per unique mint
  const mintSet: string[] = [...new Set<string>(alerts.map((a: any) => String(a.mint)))];
  const priceMap = new Map<string, number>();

  for (const mintStr of mintSet) {
    try {
      const curvePDA = getBondingCurvePDA(new PublicKey(mintStr));
      const acc = await connection.getAccountInfo(curvePDA);
      if (acc?.data) {
        priceMap.set(mintStr, getPrice(deserializeCurve(Buffer.from(acc.data))));
      }
    } catch {}
  }

  for (const alert of alerts) {
    const currentPrice = priceMap.get(alert.mint);
    if (currentPrice === undefined) continue;

    let triggered = false;
    if (alert.alertType === "price_above" && currentPrice >= alert.triggerPrice) triggered = true;
    if (alert.alertType === "price_below" && currentPrice <= alert.triggerPrice) triggered = true;
    if (alert.alertType === "stop_loss"   && currentPrice <= alert.triggerPrice) triggered = true;
    if (alert.alertType === "take_profit" && currentPrice >= alert.triggerPrice) triggered = true;
    if (!triggered) continue;

    // Mark first to prevent double-fire
    await (prisma as any).botAlert.update({
      where: { id: alert.id },
      data: { triggered: true, isActive: false },
    });

    const chatId = parseInt(alert.chatId);

    if (alert.alertType === "price_above" || alert.alertType === "price_below") {
      const icon = alert.alertType === "price_above" ? "📈" : "📉";
      try {
        await bot.sendMessage(chatId,
          `${icon} <b>Price Alert!</b>\n\n` +
          `Token: <b>${alert.symbol}</b>\n` +
          `${alert.alertType === "price_above" ? "Price rose above" : "Price fell below"} <b>${alert.triggerPrice.toFixed(8)} SOL</b>\n` +
          `Current: <b>${currentPrice.toFixed(8)} SOL</b>\n\n` +
          `<a href="${LINK(alert.mint)}">View on JetForge →</a>`,
          {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[
                { text: "🟢 Buy",  callback_data: `buy_select:${alert.mint}:${alert.symbol}` },
                { text: "🔴 Sell", callback_data: "show_sell" },
              ]],
            },
          }
        );
      } catch {}

    } else if (alert.alertType === "stop_loss" || alert.alertType === "take_profit") {
      const icon  = alert.alertType === "stop_loss" ? "🛑" : "🎯";
      const label = alert.alertType === "stop_loss" ? "Stop Loss" : "Take Profit";

      if (!alert.tokenAmount) continue;

      try {
        const user = await (prisma as any).telegramUser.findUnique({ where: { telegramId: alert.telegramId } });
        if (!user) continue;

        const kp      = getUserKeypair(user);
        const mintPk  = new PublicKey(alert.mint);
        const walletATA = getAssociatedTokenAddressSync(mintPk, kp.publicKey);
        const ataInfo = await connection.getTokenAccountBalance(walletATA).catch(() => null);
        const currentBalance = BigInt(ataInfo?.value.amount || "0");

        if (currentBalance === BigInt(0)) {
          await bot.sendMessage(chatId,
            `${icon} <b>${label} triggered</b> — ${alert.symbol}\n` +
            `Balance is 0, skipping auto-sell.`,
            { parse_mode: "HTML" }
          );
          continue;
        }

        const sellAmount = currentBalance < BigInt(alert.tokenAmount)
          ? currentBalance
          : BigInt(alert.tokenAmount);

        await bot.sendMessage(chatId,
          `${icon} <b>${label} triggered!</b>\n` +
          `Selling ${TOK(sellAmount)} ${alert.symbol}...`,
          { parse_mode: "HTML" }
        );

        const { sig, solOut, fee } = await executeSell(kp, mintPk, sellAmount, user.slippageBps);

        await bot.sendMessage(chatId,
          `${icon} <b>${label} Executed!</b>\n\n` +
          `Token: <b>${alert.symbol}</b>\n` +
          `Trigger: ${alert.triggerPrice.toFixed(8)} SOL\n` +
          `Sold: <b>${TOK(sellAmount)} tokens</b>\n` +
          `Received: <b>${SOL(solOut)} SOL</b>\n` +
          `Fee: ${SOL(fee)} SOL\n\n` +
          `TX: <a href="${EXPLORER(sig)}">${sig.slice(0, 20)}...</a>`,
          { parse_mode: "HTML", disable_web_page_preview: true }
        );
      } catch (e: any) {
        try {
          await bot.sendMessage(chatId,
            `⚠️ <b>${label} triggered</b> for ${alert.symbol} but auto-sell failed:\n` +
            `${e.message}\n\nPlease sell manually: /sell`,
            { parse_mode: "HTML" }
          );
        } catch {}
      }
    }
  }
}

async function startAlertChecker(bot: TelegramBot) {
  console.log("[trading-bot] Alert checker started (30s interval)");
  // Stagger first check by 10 seconds so bot is fully ready
  await new Promise(res => setTimeout(res, 10_000));
  while (true) {
    try { await checkAlerts(bot); } catch (e: any) {
      console.error("[trading-bot] Alert checker error:", e.message);
    }
    await new Promise(res => setTimeout(res, 30_000));
  }
}

// ─── Bot ─────────────────────────────────────────────────────────────────────

export function startTradingBot() {
  if (!BOT_TOKEN) {
    console.warn("[trading-bot] TELEGRAM_BOT_TOKEN not set — skipping");
    return;
  }
  if (ENC_KEY.length !== 32) {
    console.warn("[trading-bot] TELEGRAM_ENCRYPTION_KEY must be 32 bytes hex — skipping");
    return;
  }

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log("[trading-bot] Started polling ✓");

  // ── /start ────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const tid    = String(msg.from!.id);
    try {
      const user = await getOrCreateUser(tid, msg.from!.username, msg.from!.first_name);
      const sol  = await connection.getBalance(new PublicKey(user.walletAddress));
      const name = msg.from!.first_name || "trader";

      await bot.sendMessage(chatId,
        `🚀 <b>Welcome to JetForge Trading Bot${user.createdAt === user.updatedAt ? ", " + name : " back, " + name}!</b>\n\n` +
        `Your trading wallet:\n` +
        `<code>${user.walletAddress}</code>\n\n` +
        `💰 Balance: <b>${SOL(sol)} SOL</b>\n\n` +
        `Deposit SOL to your wallet above to start trading.\n\n` +
        `<b>Commands:</b>\n` +
        `/markets — browse tokens\n` +
        `/buy — buy a token\n` +
        `/sell — sell your positions\n` +
        `/positions — view holdings\n` +
        `/alert — set a price alert\n` +
        `/stoploss — auto-sell stop loss\n` +
        `/tp — auto-sell take profit\n` +
        `/alerts — view active alerts\n` +
        `/wallet — wallet info\n` +
        `/withdraw — withdraw SOL\n` +
        `/settings — slippage &amp; prefs\n` +
        `/help — full help`,
        { parse_mode: "HTML" }
      );
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  });

  // ── /wallet ───────────────────────────────────────────────────────────────
  bot.onText(/\/wallet/, async (msg) => {
    const chatId = msg.chat.id;
    const tid    = String(msg.from!.id);
    try {
      const user     = await getOrCreateUser(tid, msg.from!.username, msg.from!.first_name);
      const walletPk = new PublicKey(user.walletAddress);
      const sol      = await connection.getBalance(walletPk);
      const tokAccs  = await connection.getParsedTokenAccountsByOwner(walletPk, { programId: TOKEN_PROGRAM_ID });
      const holdings = tokAccs.value.filter(a => Number(a.account.data.parsed.info.tokenAmount.uiAmount) > 0);

      let msg2 = `💼 <b>Your Wallet</b>\n\n` +
        `<code>${user.walletAddress}</code>\n\n` +
        `💰 <b>SOL Balance:</b> ${SOL(sol)} SOL\n`;

      if (holdings.length > 0) {
        msg2 += `\n🪙 <b>Token Holdings:</b>\n`;
        for (const h of holdings.slice(0, 10)) {
          const info = h.account.data.parsed.info;
          msg2 += `• <code>${ADDR(info.mint)}</code> — ${Number(info.tokenAmount.uiAmount).toLocaleString()} tokens\n`;
        }
      } else {
        msg2 += `\nNo token holdings yet.\n`;
      }

      msg2 += `\n<i>Deposit SOL to the address above to start trading.</i>`;

      await bot.sendMessage(chatId, msg2, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "🛒 Buy Tokens", callback_data: "show_markets" },
            { text: "📊 My Positions", callback_data: "show_positions" },
          ]],
        },
      });
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  });

  // ── /markets ──────────────────────────────────────────────────────────────
  bot.onText(/\/markets/, async (msg) => {
    await showMarkets(bot, msg.chat.id, String(msg.from!.id), msg.from!.username, msg.from!.first_name);
  });

  async function showMarkets(bot: TelegramBot, chatId: number, tid: string, username?: string, firstName?: string) {
    try {
      const res  = await fetch(`${API_BASE}/tokens?sort=trending&limit=8&page=1`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const tokens: any[] = ((data.tokens as any[]) ?? []).filter((t: any) => !t.graduated).slice(0, 8);

      if (tokens.length === 0) {
        await bot.sendMessage(chatId, "No active markets right now. Try again later.");
        return;
      }

      const mints    = tokens.map((t: any) => new PublicKey(t.mint as string));
      const pdas     = mints.map(getBondingCurvePDA);
      const accounts = await connection.getMultipleAccountsInfo(pdas);

      let text = `🏪 <b>JetForge Markets</b> — Top Trending\n\n`;
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      for (let i = 0; i < tokens.length; i++) {
        const t: any = tokens[i];
        const acc  = accounts[i];
        let priceStr = "N/A";
        let progStr  = "";
        if (acc?.data) {
          const curve = deserializeCurve(Buffer.from(acc.data));
          priceStr = getPrice(curve).toFixed(8);
          progStr  = bar(curve.realSolReserves);
        }
        text += `${i + 1}. <b>${t.name}</b> <code>$${t.symbol}</code>\n`;
        text += `   💲 ${priceStr} SOL  ${progStr}\n\n`;

        keyboard.push([
          { text: `🟢 Buy ${t.symbol}`, callback_data: `buy_select:${t.mint}:${t.symbol}` },
          { text: `📈 Price`, callback_data: `price:${t.mint}:${t.symbol}` },
        ]);
      }

      keyboard.push([{ text: "🔄 Refresh", callback_data: "show_markets" }]);

      await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error fetching markets: ${e.message}`);
    }
  }

  // ── /buy <mint> <sol> ─────────────────────────────────────────────────────
  bot.onText(/\/buy(?:\s+(\S+))?(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const tid    = String(msg.from!.id);
    const mint   = match?.[1];
    const amount = match?.[2];

    if (!mint) {
      await showMarkets(bot, chatId, tid, msg.from!.username, msg.from!.first_name);
      return;
    }
    if (!amount) {
      await showBuyAmounts(bot, chatId, mint, "Token");
      return;
    }
    await executeBuyFlow(bot, chatId, tid, mint, amount);
  });

  async function showBuyAmounts(bot: TelegramBot, chatId: number, mint: string, symbol: string) {
    await bot.sendMessage(chatId,
      `🛒 <b>Buy ${symbol}</b>\n<code>${mint}</code>\n\nSelect amount:`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "0.1 SOL",  callback_data: `buy_confirm:${mint}:0.1` },
              { text: "0.5 SOL",  callback_data: `buy_confirm:${mint}:0.5` },
              { text: "1 SOL",    callback_data: `buy_confirm:${mint}:1` },
            ],
            [
              { text: "2 SOL",    callback_data: `buy_confirm:${mint}:2` },
              { text: "5 SOL",    callback_data: `buy_confirm:${mint}:5` },
              { text: "✏️ Custom", callback_data: `buy_custom:${mint}` },
            ],
            [{ text: "❌ Cancel", callback_data: "cancel" }],
          ],
        },
      }
    );
  }

  async function executeBuyFlow(bot: TelegramBot, chatId: number, tid: string, mint: string, solStr: string) {
    const solAmount = parseFloat(solStr);
    if (isNaN(solAmount) || solAmount <= 0) {
      await bot.sendMessage(chatId, "❌ Invalid SOL amount. Example: /buy ABC...XYZ 0.5");
      return;
    }
    try {
      const user     = await getOrCreateUser(tid);
      const balance  = await connection.getBalance(new PublicKey(user.walletAddress));
      const lamports = BigInt(Math.round(solAmount * LAMPORTS_PER_SOL));

      if (Number(lamports) > balance) {
        await bot.sendMessage(chatId,
          `❌ Insufficient balance!\nNeeded: ${solAmount} SOL\nAvailable: ${SOL(balance)} SOL\n\n` +
          `Deposit to: <code>${user.walletAddress}</code>`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const curvePDA = getBondingCurvePDA(new PublicKey(mint));
      const acc      = await connection.getAccountInfo(curvePDA);
      if (!acc) { await bot.sendMessage(chatId, "❌ Token not found on-chain."); return; }
      const curve    = deserializeCurve(Buffer.from(acc.data));
      const quote    = calcBuy(curve, lamports);
      const minOut   = (quote.tokensOut * BigInt(10000 - user.slippageBps)) / BigInt(10000);

      await bot.sendMessage(chatId,
        `🛒 <b>Buy Confirmation</b>\n\n` +
        `Token: <code>${mint}</code>\n\n` +
        `You pay:     <b>${solAmount} SOL</b>\n` +
        `You receive: <b>~${TOK(quote.tokensOut)} tokens</b>\n` +
        `Min output:  ${TOK(minOut)} tokens\n` +
        `Fee:         ${SOL(quote.fee)} SOL (1%)\n` +
        `Slippage:    ${user.slippageBps / 100}%`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Confirm Buy", callback_data: `buy_exec:${mint}:${solAmount}` },
              { text: "❌ Cancel",      callback_data: "cancel" },
            ]],
          },
        }
      );
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  }

  // ── /sell ─────────────────────────────────────────────────────────────────
  bot.onText(/\/sell(?:\s+(\S+))?(?:\s+(\S+))?/, async (msg) => {
    const chatId = msg.chat.id;
    const tid    = String(msg.from!.id);
    await showPositions(bot, chatId, tid, msg.from!.username, msg.from!.first_name, true);
  });

  // ── /positions ────────────────────────────────────────────────────────────
  bot.onText(/\/positions/, async (msg) => {
    const chatId = msg.chat.id;
    const tid    = String(msg.from!.id);
    await showPositions(bot, chatId, tid, msg.from!.username, msg.from!.first_name, false);
  });

  async function showPositions(
    bot: TelegramBot, chatId: number, tid: string,
    username?: string, firstName?: string, sellMode = false
  ) {
    try {
      const user     = await getOrCreateUser(tid, username, firstName);
      const walletPk = new PublicKey(user.walletAddress);
      const tokAccs  = await connection.getParsedTokenAccountsByOwner(walletPk, { programId: TOKEN_PROGRAM_ID });
      const holdings = tokAccs.value
        .filter(a => Number(a.account.data.parsed.info.tokenAmount.amount) > 0)
        .slice(0, 8);

      if (holdings.length === 0) {
        await bot.sendMessage(chatId,
          `📊 <b>Your Positions</b>\n\nNo token holdings yet.\n\nUse /markets to buy tokens!`,
          { parse_mode: "HTML" }
        );
        return;
      }

      let text = `📊 <b>Your Positions</b>\n\n`;
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      for (const h of holdings) {
        const info  = h.account.data.parsed.info;
        const mint  = info.mint as string;
        const amt   = info.tokenAmount.amount as string;
        const uiAmt = Number(info.tokenAmount.uiAmount);

        let priceStr = "";
        try {
          const curvePDA = getBondingCurvePDA(new PublicKey(mint));
          const acc = await connection.getAccountInfo(curvePDA);
          if (acc?.data) {
            const curve = deserializeCurve(Buffer.from(acc.data));
            const price = getPrice(curve);
            const valueSol = uiAmt * price;
            priceStr = ` ≈ ${valueSol.toFixed(4)} SOL`;
          }
        } catch {}

        text += `• <code>${ADDR(mint)}</code>\n`;
        text += `  ${uiAmt.toLocaleString()} tokens${priceStr}\n\n`;

        if (sellMode) {
          keyboard.push([
            { text: `Sell 25% ${ADDR(mint)}`, callback_data: `sell_pct:${mint}:25:${amt}` },
            { text: `50%`,                    callback_data: `sell_pct:${mint}:50:${amt}` },
            { text: `100%`,                   callback_data: `sell_pct:${mint}:100:${amt}` },
          ]);
        }
      }

      if (!sellMode) {
        keyboard.push([{ text: "🔴 Sell Tokens", callback_data: "show_sell" }]);
      }
      keyboard.push([{ text: "🔄 Refresh", callback_data: "show_positions" }]);

      await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  }

  // ── /price <mint> ─────────────────────────────────────────────────────────
  bot.onText(/\/price(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const mint   = match?.[1];
    if (!mint) {
      await bot.sendMessage(chatId, "Usage: /price <token_mint_address>");
      return;
    }
    await showPrice(bot, chatId, mint, "Token");
  });

  async function showPrice(bot: TelegramBot, chatId: number, mint: string, symbol: string) {
    try {
      const curvePDA = getBondingCurvePDA(new PublicKey(mint));
      const acc = await connection.getAccountInfo(curvePDA);
      if (!acc) {
        await bot.sendMessage(chatId, "❌ Token not found or not launched on JetForge.");
        return;
      }
      const curve  = deserializeCurve(Buffer.from(acc.data));
      const price  = getPrice(curve);
      const prog   = bar(curve.realSolReserves);

      const buy01  = calcBuy(curve, BigInt(100_000_000));
      const buy1   = calcBuy(curve, BigInt(1_000_000_000));
      const mcap   = price * 1_000_000_000;

      await bot.sendMessage(chatId,
        `📈 <b>${symbol}</b> Price\n` +
        `<code>${mint}</code>\n\n` +
        `💲 <b>${price.toFixed(8)} SOL</b> per token\n` +
        `📊 Market Cap: ~${mcap.toFixed(2)} SOL\n\n` +
        `Bonding curve: ${prog}\n` +
        `${(Number(curve.realSolReserves) / LAMPORTS_PER_SOL).toFixed(2)} / 85 SOL raised\n\n` +
        `<b>Buy quotes:</b>\n` +
        `• 0.1 SOL → ${TOK(buy01.tokensOut)} tokens\n` +
        `• 1 SOL   → ${TOK(buy1.tokensOut)} tokens\n\n` +
        `${curve.complete ? "⚠️ <b>GRADUATED</b> — trade on Raydium\n\n" : ""}` +
        `<a href="${LINK(mint)}">View on JetForge →</a>`,
        {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[
              { text: "🟢 Buy 0.1 SOL", callback_data: `buy_confirm:${mint}:0.1` },
              { text: "🟢 Buy 0.5 SOL", callback_data: `buy_confirm:${mint}:0.5` },
            ]],
          },
        }
      );
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  }

  // ── /alert <mint> <above|below> <price> ───────────────────────────────────
  bot.onText(/\/alert(?:\s+(\S+))?(?:\s+(\S+))?(?:\s+(\S+))?/, async (msg, match) => {
    const chatId   = msg.chat.id;
    const tid      = String(msg.from!.id);
    const mint     = match?.[1];
    const dir      = match?.[2]?.toLowerCase();
    const priceStr = match?.[3];

    if (!mint || !dir || !priceStr || (dir !== "above" && dir !== "below")) {
      await bot.sendMessage(chatId,
        `🔔 <b>Price Alert</b>\n\n` +
        `Usage: /alert &lt;mint&gt; &lt;above|below&gt; &lt;price_in_SOL&gt;\n\n` +
        `Example:\n` +
        `/alert ABC...XYZ above 0.001\n` +
        `/alert ABC...XYZ below 0.0005\n\n` +
        `See your alerts: /alerts`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const triggerPrice = parseFloat(priceStr);
    if (isNaN(triggerPrice) || triggerPrice <= 0) {
      await bot.sendMessage(chatId, "❌ Invalid price. Must be a positive number in SOL.");
      return;
    }

    try {
      new PublicKey(mint);
    } catch {
      await bot.sendMessage(chatId, "❌ Invalid mint address.");
      return;
    }

    try {
      const acc = await connection.getAccountInfo(getBondingCurvePDA(new PublicKey(mint)));
      if (!acc) { await bot.sendMessage(chatId, "❌ Token not found on JetForge."); return; }
      const curve = deserializeCurve(Buffer.from(acc.data));
      const currentPrice = getPrice(curve);

      const token = await (prisma as any).token.findUnique({ where: { mint }, select: { symbol: true } });
      const symbol = token?.symbol || ADDR(mint);

      const alert = await (prisma as any).botAlert.create({
        data: {
          telegramId: tid,
          chatId: String(chatId),
          mint,
          symbol,
          alertType: dir === "above" ? "price_above" : "price_below",
          triggerPrice,
          isActive: true,
          triggered: false,
        },
      });

      await bot.sendMessage(chatId,
        `🔔 <b>Alert Set!</b>\n\n` +
        `Token: <b>${symbol}</b>\n` +
        `Alert when price goes <b>${dir}</b>: <b>${triggerPrice} SOL</b>\n` +
        `Current price: ${currentPrice.toFixed(8)} SOL\n\n` +
        `Alert ID: <b>#${alert.id}</b>\n` +
        `Use /cancelalert ${alert.id} to remove`,
        { parse_mode: "HTML" }
      );
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  });

  // ── /stoploss <mint> <percent> ────────────────────────────────────────────
  bot.onText(/\/stoploss(?:\s+(\S+))?(?:\s+(\S+))?/, async (msg, match) => {
    const chatId  = msg.chat.id;
    const tid     = String(msg.from!.id);
    const mint    = match?.[1];
    const pctStr  = match?.[2];

    if (!mint || !pctStr) {
      await bot.sendMessage(chatId,
        `🛑 <b>Stop Loss</b>\n\n` +
        `Usage: /stoploss &lt;mint&gt; &lt;percent&gt;\n\n` +
        `Example: /stoploss ABC...XYZ 20\n` +
        `(Auto-sells your tokens if price drops 20%)\n\n` +
        `You must hold the token before setting a stop loss.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const pct = parseFloat(pctStr);
    if (isNaN(pct) || pct <= 0 || pct >= 100) {
      await bot.sendMessage(chatId, "❌ Percent must be between 1 and 99.");
      return;
    }

    try {
      const user   = await getOrCreateUser(tid, msg.from!.username, msg.from!.first_name);
      const mintPk = new PublicKey(mint);

      const acc = await connection.getAccountInfo(getBondingCurvePDA(mintPk));
      if (!acc) { await bot.sendMessage(chatId, "❌ Token not found on JetForge."); return; }
      const curve        = deserializeCurve(Buffer.from(acc.data));
      const currentPrice = getPrice(curve);
      const triggerPrice = currentPrice * (1 - pct / 100);

      const walletATA  = getAssociatedTokenAddressSync(mintPk, new PublicKey(user.walletAddress));
      const ataInfo    = await connection.getTokenAccountBalance(walletATA).catch(() => null);
      const tokenBalance = ataInfo?.value.amount || "0";

      if (tokenBalance === "0") {
        await bot.sendMessage(chatId,
          `❌ You don't hold any of this token.\nBuy it first with /buy, then set a stop loss.`
        );
        return;
      }

      const token  = await (prisma as any).token.findUnique({ where: { mint }, select: { symbol: true } });
      const symbol = token?.symbol || ADDR(mint);

      const alert = await (prisma as any).botAlert.create({
        data: {
          telegramId: tid,
          chatId: String(chatId),
          mint,
          symbol,
          alertType: "stop_loss",
          triggerPrice,
          tokenAmount: tokenBalance,
          isActive: true,
          triggered: false,
        },
      });

      await bot.sendMessage(chatId,
        `🛑 <b>Stop Loss Set!</b>\n\n` +
        `Token: <b>${symbol}</b>\n` +
        `Current price: ${currentPrice.toFixed(8)} SOL\n` +
        `Trigger at: <b>${triggerPrice.toFixed(8)} SOL</b> (-${pct}%)\n` +
        `Will auto-sell: <b>${TOK(BigInt(tokenBalance))} tokens</b>\n\n` +
        `Alert ID: <b>#${alert.id}</b>\n` +
        `Use /cancelalert ${alert.id} to remove`,
        { parse_mode: "HTML" }
      );
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  });

  // ── /tp <mint> <percent> ──────────────────────────────────────────────────
  bot.onText(/\/tp(?:\s+(\S+))?(?:\s+(\S+))?/, async (msg, match) => {
    const chatId  = msg.chat.id;
    const tid     = String(msg.from!.id);
    const mint    = match?.[1];
    const pctStr  = match?.[2];

    if (!mint || !pctStr) {
      await bot.sendMessage(chatId,
        `🎯 <b>Take Profit</b>\n\n` +
        `Usage: /tp &lt;mint&gt; &lt;percent&gt;\n\n` +
        `Example: /tp ABC...XYZ 50\n` +
        `(Auto-sells your tokens if price rises 50%)\n\n` +
        `You must hold the token before setting take profit.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const pct = parseFloat(pctStr);
    if (isNaN(pct) || pct <= 0) {
      await bot.sendMessage(chatId, "❌ Percent must be > 0.");
      return;
    }

    try {
      const user   = await getOrCreateUser(tid, msg.from!.username, msg.from!.first_name);
      const mintPk = new PublicKey(mint);

      const acc = await connection.getAccountInfo(getBondingCurvePDA(mintPk));
      if (!acc) { await bot.sendMessage(chatId, "❌ Token not found on JetForge."); return; }
      const curve        = deserializeCurve(Buffer.from(acc.data));
      const currentPrice = getPrice(curve);
      const triggerPrice = currentPrice * (1 + pct / 100);

      const walletATA  = getAssociatedTokenAddressSync(mintPk, new PublicKey(user.walletAddress));
      const ataInfo    = await connection.getTokenAccountBalance(walletATA).catch(() => null);
      const tokenBalance = ataInfo?.value.amount || "0";

      if (tokenBalance === "0") {
        await bot.sendMessage(chatId,
          `❌ You don't hold any of this token.\nBuy it first with /buy, then set a take profit.`
        );
        return;
      }

      const token  = await (prisma as any).token.findUnique({ where: { mint }, select: { symbol: true } });
      const symbol = token?.symbol || ADDR(mint);

      const alert = await (prisma as any).botAlert.create({
        data: {
          telegramId: tid,
          chatId: String(chatId),
          mint,
          symbol,
          alertType: "take_profit",
          triggerPrice,
          tokenAmount: tokenBalance,
          isActive: true,
          triggered: false,
        },
      });

      await bot.sendMessage(chatId,
        `🎯 <b>Take Profit Set!</b>\n\n` +
        `Token: <b>${symbol}</b>\n` +
        `Current price: ${currentPrice.toFixed(8)} SOL\n` +
        `Trigger at: <b>${triggerPrice.toFixed(8)} SOL</b> (+${pct}%)\n` +
        `Will auto-sell: <b>${TOK(BigInt(tokenBalance))} tokens</b>\n\n` +
        `Alert ID: <b>#${alert.id}</b>\n` +
        `Use /cancelalert ${alert.id} to remove`,
        { parse_mode: "HTML" }
      );
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  });

  // ── /alerts ───────────────────────────────────────────────────────────────
  bot.onText(/\/alerts/, async (msg) => {
    const chatId = msg.chat.id;
    const tid    = String(msg.from!.id);
    try {
      const alerts = await (prisma as any).botAlert.findMany({
        where: { telegramId: tid, isActive: true, triggered: false },
        orderBy: { createdAt: "desc" },
      });

      if (alerts.length === 0) {
        await bot.sendMessage(chatId,
          `📭 <b>No Active Alerts</b>\n\n` +
          `Set alerts with:\n` +
          `/alert — price notification\n` +
          `/stoploss — auto-sell stop loss\n` +
          `/tp — auto-sell take profit`,
          { parse_mode: "HTML" }
        );
        return;
      }

      let text = `🔔 <b>Your Active Alerts (${alerts.length})</b>\n\n`;
      const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

      for (const a of alerts) {
        const icons: Record<string, string> = {
          price_above: "📈", price_below: "📉", stop_loss: "🛑", take_profit: "🎯",
        };
        const labels: Record<string, string> = {
          price_above: "Above", price_below: "Below",
          stop_loss: "Stop Loss", take_profit: "Take Profit",
        };
        const icon  = icons[a.alertType]  || "🔔";
        const label = labels[a.alertType] || a.alertType;

        text += `${icon} <b>#${a.id}</b> — ${a.symbol} — ${label}\n`;
        text += `   Trigger: <b>${a.triggerPrice.toFixed(8)} SOL</b>`;
        if (a.tokenAmount) {
          text += ` | Sell: ${TOK(BigInt(a.tokenAmount))} tokens`;
        }
        text += "\n\n";

        keyboard.push([{
          text: `❌ Cancel #${a.id} (${a.symbol} ${label})`,
          callback_data: `cancel_alert:${a.id}`,
        }]);
      }

      await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  });

  // ── /cancelalert <id> ─────────────────────────────────────────────────────
  bot.onText(/\/cancelalert(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const tid    = String(msg.from!.id);
    const idStr  = match?.[1];

    if (!idStr) {
      await bot.sendMessage(chatId, "Usage: /cancelalert <alert_id>\nSee your alerts with /alerts");
      return;
    }

    try {
      const id    = parseInt(idStr);
      const alert = await (prisma as any).botAlert.findFirst({
        where: { id, telegramId: tid, isActive: true },
      });

      if (!alert) {
        await bot.sendMessage(chatId, `❌ Alert #${id} not found or already cancelled.`);
        return;
      }

      await (prisma as any).botAlert.update({ where: { id }, data: { isActive: false } });
      await bot.sendMessage(chatId, `✅ Alert <b>#${id}</b> (${alert.symbol}) cancelled.`, { parse_mode: "HTML" });
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  });

  // ── /withdraw <address> <amount> ──────────────────────────────────────────
  bot.onText(/\/withdraw(?:\s+(\S+))?(?:\s+(\S+))?/, async (msg, match) => {
    const chatId  = msg.chat.id;
    const tid     = String(msg.from!.id);
    const toAddr  = match?.[1];
    const solAmt  = match?.[2];

    if (!toAddr || !solAmt) {
      await bot.sendMessage(chatId,
        `Usage: /withdraw <destination_address> <sol_amount>\n` +
        `Example: /withdraw 9xDef...1234 0.5`
      );
      return;
    }

    try {
      const user    = await getOrCreateUser(tid, msg.from!.username, msg.from!.first_name);
      const kp      = getUserKeypair(user);
      const toPk    = new PublicKey(toAddr);
      const lamports = BigInt(Math.round(parseFloat(solAmt) * LAMPORTS_PER_SOL));
      const balance  = await connection.getBalance(kp.publicKey);

      if (Number(lamports) >= balance) {
        await bot.sendMessage(chatId,
          `❌ Insufficient balance.\n` +
          `Available: ${SOL(balance)} SOL\n` +
          `Requested: ${solAmt} SOL\n` +
          `(Keep some SOL for tx fees)`
        );
        return;
      }

      await bot.sendMessage(chatId, `⏳ Sending ${solAmt} SOL...`);

      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: toPk, lamports })
      );
      const sig = await sendAndConfirmTransaction(connection, tx, [kp], { commitment: "confirmed" });

      await bot.sendMessage(chatId,
        `✅ <b>Withdrawal Sent!</b>\n\n` +
        `Amount: <b>${solAmt} SOL</b>\n` +
        `To: <code>${toAddr}</code>\n` +
        `TX: <a href="${EXPLORER(sig)}">${sig.slice(0, 20)}...</a>`,
        { parse_mode: "HTML", disable_web_page_preview: true }
      );
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Withdrawal failed: ${e.message}`);
    }
  });

  // ── /settings ─────────────────────────────────────────────────────────────
  bot.onText(/\/settings/, async (msg) => {
    const chatId = msg.chat.id;
    const tid    = String(msg.from!.id);
    try {
      const user = await getOrCreateUser(tid, msg.from!.username, msg.from!.first_name);
      await bot.sendMessage(chatId,
        `⚙️ <b>Settings</b>\n\nCurrent slippage: <b>${user.slippageBps / 100}%</b>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: user.slippageBps === 100  ? "✅ 1%"  : "1%",  callback_data: "set_slip:100"  },
              { text: user.slippageBps === 300  ? "✅ 3%"  : "3%",  callback_data: "set_slip:300"  },
              { text: user.slippageBps === 500  ? "✅ 5%"  : "5%",  callback_data: "set_slip:500"  },
              { text: user.slippageBps === 1000 ? "✅ 10%" : "10%", callback_data: "set_slip:1000" },
            ]],
          },
        }
      );
    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  });

  // ── /help ─────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
      `🚀 <b>JetForge Trading Bot — Commands</b>\n\n` +
      `<b>💼 Wallet</b>\n` +
      `/start — welcome &amp; create wallet\n` +
      `/wallet — view balance &amp; holdings\n` +
      `/withdraw &lt;address&gt; &lt;sol&gt; — send SOL out\n\n` +
      `<b>📈 Trading</b>\n` +
      `/markets — browse active tokens\n` +
      `/buy &lt;mint&gt; &lt;sol&gt; — buy a token\n` +
      `/sell — sell your positions\n` +
      `/positions — view all holdings\n` +
      `/price &lt;mint&gt; — get token price &amp; quote\n\n` +
      `<b>🔔 Alerts &amp; Auto-Sell</b>\n` +
      `/alert &lt;mint&gt; &lt;above|below&gt; &lt;price&gt; — price notification\n` +
      `/stoploss &lt;mint&gt; &lt;%&gt; — auto-sell if price drops X%\n` +
      `/tp &lt;mint&gt; &lt;%&gt; — auto-sell if price rises X%\n` +
      `/alerts — list all active alerts\n` +
      `/cancelalert &lt;id&gt; — cancel an alert\n\n` +
      `<b>⚙️ Settings</b>\n` +
      `/settings — configure slippage\n\n` +
      `<b>📖 Examples</b>\n` +
      `/buy ABC...XYZ 0.5 — buy with 0.5 SOL\n` +
      `/stoploss ABC...XYZ 20 — sell if -20%\n` +
      `/tp ABC...XYZ 100 — sell if +100% (2x)\n` +
      `/alert ABC...XYZ above 0.001 — notify at price\n\n` +
      `<b>Network:</b> Solana ${RPC_URL.includes("devnet") ? "Devnet 🧪" : "Mainnet 🔴"}\n` +
      `<b>Fees:</b> 1% per trade\n` +
      `<b>Alerts:</b> Checked every 30 seconds\n\n` +
      `<a href="https://jetforge.io">jetforge.io</a>`,
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
  });

  // ── Inline keyboard callbacks ─────────────────────────────────────────────
  bot.on("callback_query", async (query) => {
    const chatId = query.message!.chat.id;
    const tid    = String(query.from.id);
    const data   = query.data || "";

    await bot.answerCallbackQuery(query.id);

    try {
      if (data === "show_markets") {
        await showMarkets(bot, chatId, tid, query.from.username, query.from.first_name);
        return;
      }

      if (data === "show_positions") {
        await showPositions(bot, chatId, tid, query.from.username, query.from.first_name, false);
        return;
      }

      if (data === "show_sell") {
        await showPositions(bot, chatId, tid, query.from.username, query.from.first_name, true);
        return;
      }

      if (data === "cancel") {
        await bot.sendMessage(chatId, "Cancelled.");
        return;
      }

      // set_slip:<bps>
      if (data.startsWith("set_slip:")) {
        const bps = parseInt(data.split(":")[1]);
        await (prisma as any).telegramUser.update({
          where: { telegramId: tid },
          data: { slippageBps: bps },
        });
        await bot.sendMessage(chatId, `✅ Slippage set to <b>${bps / 100}%</b>`, { parse_mode: "HTML" });
        return;
      }

      // price:<mint>:<symbol>
      if (data.startsWith("price:")) {
        const [, mint, symbol] = data.split(":");
        await showPrice(bot, chatId, mint, symbol || "Token");
        return;
      }

      // buy_select:<mint>:<symbol>
      if (data.startsWith("buy_select:")) {
        const [, mint, symbol] = data.split(":");
        await showBuyAmounts(bot, chatId, mint, symbol || "Token");
        return;
      }

      // buy_custom:<mint>
      if (data.startsWith("buy_custom:")) {
        const [, mint] = data.split(":");
        await bot.sendMessage(chatId,
          `✏️ Enter custom SOL amount:\n<code>${mint}</code>\n\n` +
          `Reply with: /buy ${mint} &lt;amount&gt;\nExample: /buy ${mint} 0.25`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // buy_confirm:<mint>:<sol>
      if (data.startsWith("buy_confirm:")) {
        const parts     = data.split(":");
        const mint      = parts[1];
        const solAmount = parseFloat(parts[2]);

        const user     = await getOrCreateUser(tid, query.from.username, query.from.first_name);
        const balance  = await connection.getBalance(new PublicKey(user.walletAddress));
        const lamports = BigInt(Math.round(solAmount * LAMPORTS_PER_SOL));

        if (Number(lamports) > balance) {
          await bot.sendMessage(chatId,
            `❌ Insufficient balance!\nNeeded: ${solAmount} SOL\nAvailable: ${SOL(balance)} SOL\n\n` +
            `Deposit to: <code>${user.walletAddress}</code>`,
            { parse_mode: "HTML" }
          );
          return;
        }

        const curvePDA = getBondingCurvePDA(new PublicKey(mint));
        const acc      = await connection.getAccountInfo(curvePDA);
        if (!acc) { await bot.sendMessage(chatId, "❌ Token not found on-chain."); return; }
        const curve    = deserializeCurve(Buffer.from(acc.data));
        const quote    = calcBuy(curve, lamports);
        const minOut   = (quote.tokensOut * BigInt(10000 - user.slippageBps)) / BigInt(10000);

        await bot.sendMessage(chatId,
          `🛒 <b>Buy Confirmation</b>\n\n` +
          `Token: <code>${mint}</code>\n\n` +
          `You pay:     <b>${solAmount} SOL</b>\n` +
          `You receive: <b>~${TOK(quote.tokensOut)} tokens</b>\n` +
          `Min output:  ${TOK(minOut)} tokens\n` +
          `Fee:         ${SOL(quote.fee)} SOL (1%)\n` +
          `Slippage:    ${user.slippageBps / 100}%\n\n` +
          `<a href="${LINK(mint)}">View Token →</a>`,
          {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Confirm Buy", callback_data: `buy_exec:${mint}:${solAmount}` },
                { text: "❌ Cancel",      callback_data: "cancel" },
              ]],
            },
          }
        );
        return;
      }

      // buy_exec:<mint>:<sol>
      if (data.startsWith("buy_exec:")) {
        const parts     = data.split(":");
        const mint      = parts[1];
        const solAmount = parseFloat(parts[2]);
        const lamports  = BigInt(Math.round(solAmount * LAMPORTS_PER_SOL));

        const user = await getOrCreateUser(tid, query.from.username, query.from.first_name);
        const kp   = getUserKeypair(user);

        const waitMsg = await bot.sendMessage(chatId, `⏳ Buying... please wait`);
        const { sig, tokensOut, fee } = await executeBuy(kp, new PublicKey(mint), lamports, user.slippageBps);

        await bot.editMessageText(
          `✅ <b>Buy Executed!</b>\n\n` +
          `Spent:    <b>${solAmount} SOL</b>\n` +
          `Received: <b>${TOK(tokensOut)} tokens</b>\n` +
          `Fee paid: ${SOL(fee)} SOL\n\n` +
          `TX: <a href="${EXPLORER(sig)}">${sig.slice(0, 20)}...</a>\n` +
          `<a href="${LINK(mint)}">View Token →</a>`,
          {
            chat_id: chatId, message_id: waitMsg.message_id,
            parse_mode: "HTML", disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[
                { text: "📊 Positions", callback_data: "show_positions" },
                { text: "🛒 Buy More",  callback_data: `buy_select:${mint}:Token` },
              ]],
            },
          }
        );
        return;
      }

      // sell_pct:<mint>:<pct>:<totalAmount>
      if (data.startsWith("sell_pct:")) {
        const [, mint, pctStr, totalStr] = data.split(":");
        const pct        = parseInt(pctStr);
        const total      = BigInt(totalStr);
        const sellAmount = (total * BigInt(pct)) / BigInt(100);

        const user     = await getOrCreateUser(tid, query.from.username, query.from.first_name);
        const curvePDA = getBondingCurvePDA(new PublicKey(mint));
        const acc      = await connection.getAccountInfo(curvePDA);
        if (!acc) { await bot.sendMessage(chatId, "❌ Token not found on-chain."); return; }
        const curve    = deserializeCurve(Buffer.from(acc.data));
        const quote    = calcSell(curve, sellAmount);
        const minSol   = (quote.solOut * BigInt(10000 - user.slippageBps)) / BigInt(10000);

        await bot.sendMessage(chatId,
          `🔴 <b>Sell Confirmation</b>\n\n` +
          `Token: <code>${mint}</code>\n\n` +
          `You sell:    <b>${TOK(sellAmount)} tokens (${pct}%)</b>\n` +
          `You receive: <b>~${SOL(quote.solOut)} SOL</b>\n` +
          `Min output:  ${SOL(minSol)} SOL\n` +
          `Fee:         ${SOL(quote.fee)} SOL (1%)\n` +
          `Slippage:    ${user.slippageBps / 100}%`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Confirm Sell", callback_data: `sell_exec:${mint}:${sellAmount.toString()}` },
                { text: "❌ Cancel",       callback_data: "cancel" },
              ]],
            },
          }
        );
        return;
      }

      // sell_exec:<mint>:<amount>
      if (data.startsWith("sell_exec:")) {
        const [, mint, amountStr] = data.split(":");
        const tokenAmount = BigInt(amountStr);

        const user = await getOrCreateUser(tid, query.from.username, query.from.first_name);
        const kp   = getUserKeypair(user);

        const waitMsg = await bot.sendMessage(chatId, `⏳ Selling... please wait`);
        const { sig, solOut, fee } = await executeSell(kp, new PublicKey(mint), tokenAmount, user.slippageBps);

        await bot.editMessageText(
          `✅ <b>Sell Executed!</b>\n\n` +
          `Sold:     <b>${TOK(tokenAmount)} tokens</b>\n` +
          `Received: <b>${SOL(solOut)} SOL</b>\n` +
          `Fee paid: ${SOL(fee)} SOL\n\n` +
          `TX: <a href="${EXPLORER(sig)}">${sig.slice(0, 20)}...</a>`,
          {
            chat_id: chatId, message_id: waitMsg.message_id,
            parse_mode: "HTML", disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [[
                { text: "💼 Wallet",    callback_data: "show_positions" },
                { text: "🛒 Buy Back", callback_data: `buy_select:${mint}:Token` },
              ]],
            },
          }
        );
        return;
      }

      // cancel_alert:<id>
      if (data.startsWith("cancel_alert:")) {
        const id    = parseInt(data.split(":")[1]);
        const alert = await (prisma as any).botAlert.findFirst({
          where: { id, telegramId: tid, isActive: true },
        });
        if (!alert) { await bot.sendMessage(chatId, `❌ Alert #${id} not found.`); return; }
        await (prisma as any).botAlert.update({ where: { id }, data: { isActive: false } });
        await bot.sendMessage(chatId,
          `✅ Alert <b>#${id}</b> (${alert.symbol}) cancelled.`,
          { parse_mode: "HTML" }
        );
        return;
      }

    } catch (e: any) {
      await bot.sendMessage(chatId, `❌ Trade failed: ${e.message}`);
    }
  });

  // ── Error handler ─────────────────────────────────────────────────────────
  bot.on("polling_error", (err) => {
    console.error("[trading-bot] polling error:", err.message);
  });

  // ── Start background alert checker ────────────────────────────────────────
  startAlertChecker(bot).catch(e => console.error("[trading-bot] Alert checker crashed:", e.message));

  return bot;
}
