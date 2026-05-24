/**
 * JetForge Public REST API v1
 * Mounted at /api/v1/
 *
 * Endpoints:
 *   GET  /api/v1/markets                  — list all active tokens with on-chain state
 *   GET  /api/v1/quote                    — get a trade quote (no tx sent)
 *   POST /api/v1/trade/prepare            — returns base64 unsigned transaction
 *   GET  /api/v1/wallet/:address          — wallet SOL + token positions
 *
 * /trade/prepare returns an UNSIGNED transaction.
 * The caller signs it with their own wallet and broadcasts it.
 * JetForge never touches private keys.
 */

import { Router, Request, Response } from "express";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
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
import { config } from "../config";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROGRAM_ID  = new PublicKey(config.solana.programId);
const TREASURY    = new PublicKey(config.solana.treasuryAddress);
const FEE_BPS     = BigInt(100);
const BPS_DENOM   = BigInt(10000);
const TOKEN_DEC   = 6;

const connection  = new Connection(config.solana.rpcUrl, "confirmed");

// ─── Anchor discriminators ────────────────────────────────────────────────────

function disc(name: string): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(`global:${name}`).digest()
  ).subarray(0, 8);
}
const BUY_DISC  = disc("buy");
const SELL_DISC = disc("sell");

// ─── PDAs ────────────────────────────────────────────────────────────────────

function bondingCurvePDA(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()], PROGRAM_ID
  )[0];
}
function buybackVaultPDA(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_vault"), mint.toBuffer()], PROGRAM_ID
  )[0];
}
function creatorVaultPDA(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), mint.toBuffer()], PROGRAM_ID
  )[0];
}

// ─── Curve state ─────────────────────────────────────────────────────────────

interface CurveState {
  mint: string;
  creator: string;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
  complete: boolean;
}

function parseCurve(data: Buffer): CurveState {
  let o = 8;
  const mint    = new PublicKey(data.subarray(o, o+32)).toBase58(); o+=32;
  const creator = new PublicKey(data.subarray(o, o+32)).toBase58(); o+=32;
  const virtualSolReserves   = data.readBigUInt64LE(o); o+=8;
  const virtualTokenReserves = data.readBigUInt64LE(o); o+=8;
  const realSolReserves      = data.readBigUInt64LE(o); o+=8;
  const realTokenReserves    = data.readBigUInt64LE(o); o+=8;
  o+=8; // totalSupply
  const complete = data[o] === 1;
  return { mint, creator, virtualSolReserves, virtualTokenReserves,
           realSolReserves, realTokenReserves, complete };
}

// ─── Math ────────────────────────────────────────────────────────────────────

function quoteBuy(curve: CurveState, solLamports: bigint) {
  const fee         = (solLamports * FEE_BPS) / BPS_DENOM;
  const solNet      = solLamports - fee;
  const k           = curve.virtualSolReserves * curve.virtualTokenReserves;
  const newVSol     = curve.virtualSolReserves + solNet;
  const tokensOut   = curve.virtualTokenReserves - k / newVSol;
  const priceAfter  = Number(newVSol) / Number(curve.virtualTokenReserves - tokensOut);
  const priceBefore = Number(curve.virtualSolReserves) / Number(curve.virtualTokenReserves);
  const priceImpact = Math.abs((priceAfter - priceBefore) / priceBefore) * 100;
  return { tokensOut, fee, priceImpact };
}

function quoteSell(curve: CurveState, tokenAmount: bigint) {
  const k             = curve.virtualSolReserves * curve.virtualTokenReserves;
  const newVToken     = curve.virtualTokenReserves + tokenAmount;
  const solBefore     = curve.virtualSolReserves - k / newVToken;
  const fee           = (solBefore * FEE_BPS) / BPS_DENOM;
  const solOut        = solBefore - fee;
  const priceBefore   = Number(curve.virtualSolReserves) / Number(curve.virtualTokenReserves);
  const priceAfter    = Number(k / newVToken) / Number(newVToken);
  const priceImpact   = Math.abs((priceAfter - priceBefore) / priceBefore) * 100;
  return { solOut, fee, priceImpact };
}

function curvePrice(curve: CurveState): number {
  return (Number(curve.virtualSolReserves) / LAMPORTS_PER_SOL) /
         (Number(curve.virtualTokenReserves) / 10**TOKEN_DEC);
}

// ─── Router ──────────────────────────────────────────────────────────────────

export function createPublicApiRouter(): Router {
  const router = Router();

  // ── GET /markets ──────────────────────────────────────────────────────────
  /**
   * List all active (non-graduated) JetForge markets with live on-chain state.
   * Query params: limit (default 50), sort (trending|new|graduating)
   *
   * Response:
   *   { markets: Market[], count: number, network: string }
   */
  router.get("/markets", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const sort  = (req.query.sort as string) || "new";

      const tokens = await (prisma as any).token.findMany({
        where: { isGraduated: false },
        orderBy: sort === "new"
          ? { createdAt: "desc" }
          : sort === "graduating"
          ? { realSolReserves: "desc" }
          : { volume24h: "desc" },
        take: limit,
        select: {
          mint: true, name: true, symbol: true, imageUrl: true,
          creator: true, isGraduated: true,
          createdAt: true,
        },
      });

      // Batch fetch bonding curves
      const mints   = tokens.map((t: any) => new PublicKey(t.mint));
      const pdas    = mints.map(bondingCurvePDA);
      const accounts = await connection.getMultipleAccountsInfo(pdas);

      const markets = tokens.map((t: any, i: number) => {
        const acc  = accounts[i];
        let curve: CurveState | null = null;
        try { if (acc?.data) curve = parseCurve(Buffer.from(acc.data)); } catch {}

        const GRAD = BigInt("85000000000");
        const price    = curve ? curvePrice(curve) : 0;
        const progress = curve ? Math.min(100, Number(curve.realSolReserves * BigInt(100) / GRAD)) : 0;

        return {
          marketId:            t.mint,
          name:                t.name,
          baseSymbol:          t.symbol,
          quoteSymbol:         "SOL",
          baseMint:            t.mint,
          bondingCurveAddress: pdas[i].toBase58(),
          creator:             t.creator,
          decimals:            TOKEN_DEC,
          price,
          priceSOL:            price,
          virtualSolReserves:  curve?.virtualSolReserves.toString() ?? "0",
          virtualTokenReserves:curve?.virtualTokenReserves.toString() ?? "0",
          realSolReserves:     curve?.realSolReserves.toString() ?? "0",
          realTokenReserves:   curve?.realTokenReserves.toString() ?? "0",
          graduated:           t.isGraduated,
          progress,
          imageUrl:            t.imageUrl ?? null,
          createdAt:           t.createdAt,
        };
      });

      res.json({ markets, count: markets.length, network: config.solana.rpcUrl.includes("devnet") ? "devnet" : "mainnet" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /quote ────────────────────────────────────────────────────────────
  /**
   * Get a trade quote from on-chain bonding curve state.
   * Query params: mint, side (buy|sell), amount (lamports for buy, token units for sell), slippageBps (default 300)
   *
   * Response:
   *   { quote: QuoteResult }
   */
  router.get("/quote", async (req: Request, res: Response) => {
    try {
      const { mint: mintStr, side, amount, slippageBps: slipStr } = req.query as Record<string, string>;

      if (!mintStr || !side || !amount) {
        return res.status(400).json({ error: "Required params: mint, side (buy|sell), amount" });
      }
      if (side !== "buy" && side !== "sell") {
        return res.status(400).json({ error: "side must be 'buy' or 'sell'" });
      }

      const mint       = new PublicKey(mintStr);
      const amountBig  = BigInt(amount);
      const slipBps    = parseInt(slipStr || "300");
      const curvePDA   = bondingCurvePDA(mint);

      const acc = await connection.getAccountInfo(curvePDA);
      if (!acc) return res.status(404).json({ error: "Token not found on JetForge" });

      const curve = parseCurve(Buffer.from(acc.data));
      if (curve.complete) return res.status(400).json({ error: "Token has graduated — trade on Raydium" });

      const price = curvePrice(curve);
      let outputAmount: bigint;
      let fee: bigint;
      let priceImpact: number;

      if (side === "buy") {
        const q      = quoteBuy(curve, amountBig);
        outputAmount = q.tokensOut;
        fee          = q.fee;
        priceImpact  = q.priceImpact;
      } else {
        const q      = quoteSell(curve, amountBig);
        outputAmount = q.solOut;
        fee          = q.fee;
        priceImpact  = q.priceImpact;
      }

      const minOutput = (outputAmount * BigInt(10000 - slipBps)) / BigInt(10000);

      res.json({
        quote: {
          marketId:             mintStr,
          bondingCurveAddress:  curvePDA.toBase58(),
          side,
          inputAmount:          amountBig.toString(),
          inputAmountHuman:     side === "buy"
            ? (Number(amountBig) / LAMPORTS_PER_SOL).toFixed(6) + " SOL"
            : (Number(amountBig) / 10**TOKEN_DEC).toFixed(2) + " tokens",
          outputAmount:         outputAmount.toString(),
          outputAmountHuman:    side === "buy"
            ? (Number(outputAmount) / 10**TOKEN_DEC).toFixed(2) + " tokens"
            : (Number(outputAmount) / LAMPORTS_PER_SOL).toFixed(6) + " SOL",
          price,
          priceImpactPct:       parseFloat(priceImpact.toFixed(3)),
          estimatedFeeLamports: fee.toString(),
          minimumOutput:        minOutput.toString(),
          slippageBps:          slipBps,
          curveState: {
            virtualSolReserves:  curve.virtualSolReserves.toString(),
            virtualTokenReserves:curve.virtualTokenReserves.toString(),
            realSolReserves:     curve.realSolReserves.toString(),
            realTokenReserves:   curve.realTokenReserves.toString(),
          },
        },
      });
    } catch (e: any) {
      if (e.message?.includes("Invalid public key")) {
        return res.status(400).json({ error: "Invalid mint address" });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /trade/prepare ───────────────────────────────────────────────────
  /**
   * Build and return an unsigned transaction.
   * The caller signs it with their wallet and broadcasts it.
   * JetForge NEVER receives or touches private keys.
   *
   * Body: { mint, side, amount, walletPublicKey, slippageBps? }
   * Response: { transaction: "<base64>", message, quote }
   *
   * To execute:
   *   const tx = Transaction.from(Buffer.from(response.transaction, "base64"));
   *   tx.feePayer = wallet.publicKey;
   *   tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
   *   const signed = await wallet.signTransaction(tx);
   *   const sig = await connection.sendRawTransaction(signed.serialize());
   */
  router.post("/trade/prepare", async (req: Request, res: Response) => {
    try {
      const { mint: mintStr, side, amount, walletPublicKey, slippageBps: slipRaw } = req.body;

      if (!mintStr || !side || !amount || !walletPublicKey) {
        return res.status(400).json({
          error: "Required body fields: mint, side (buy|sell), amount, walletPublicKey",
        });
      }
      if (side !== "buy" && side !== "sell") {
        return res.status(400).json({ error: "side must be 'buy' or 'sell'" });
      }

      const mint        = new PublicKey(mintStr);
      const walletPk    = new PublicKey(walletPublicKey);
      const amountBig   = BigInt(amount.toString());
      const slipBps     = parseInt(slipRaw?.toString() || "300");

      const curvePDA    = bondingCurvePDA(mint);
      const buybackPDA  = buybackVaultPDA(mint);
      const creatorPDA  = creatorVaultPDA(mint);
      const vaultATA    = getAssociatedTokenAddressSync(mint, curvePDA, true);
      const walletATA   = getAssociatedTokenAddressSync(mint, walletPk);

      const acc = await connection.getAccountInfo(curvePDA);
      if (!acc) return res.status(404).json({ error: "Token not found on JetForge" });

      const curve = parseCurve(Buffer.from(acc.data));
      if (curve.complete) return res.status(400).json({ error: "Token has graduated — trade on Raydium" });

      // Calculate quote
      let outputAmount: bigint;
      let fee: bigint;
      let minOut: bigint;

      if (side === "buy") {
        const q  = quoteBuy(curve, amountBig);
        outputAmount = q.tokensOut;
        fee          = q.fee;
        minOut       = (q.tokensOut * BigInt(10000 - slipBps)) / BigInt(10000);
      } else {
        const q  = quoteSell(curve, amountBig);
        outputAmount = q.solOut;
        fee          = q.fee;
        minOut       = (q.solOut * BigInt(10000 - slipBps)) / BigInt(10000);
      }

      // Build transaction
      const tx = new Transaction();
      tx.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10000 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 })
      );

      // Create wallet ATA if needed (only for buy)
      if (side === "buy") {
        const ataInfo = await connection.getAccountInfo(walletATA);
        if (!ataInfo) {
          tx.add(createAssociatedTokenAccountInstruction(walletPk, walletATA, walletPk, mint));
        }
      }

      const data = Buffer.alloc(24);
      if (side === "buy") {
        BUY_DISC.copy(data, 0);
        data.writeBigUInt64LE(amountBig, 8);
        data.writeBigUInt64LE(minOut, 16);
      } else {
        SELL_DISC.copy(data, 0);
        data.writeBigUInt64LE(amountBig, 8);
        data.writeBigUInt64LE(minOut, 16);
      }

      const keys = side === "buy" ? [
        { pubkey: walletPk,    isSigner: true,  isWritable: true  },
        { pubkey: mint,        isSigner: false, isWritable: false },
        { pubkey: curvePDA,    isSigner: false, isWritable: true  },
        { pubkey: vaultATA,    isSigner: false, isWritable: true  },
        { pubkey: walletATA,   isSigner: false, isWritable: true  },
        { pubkey: TREASURY,    isSigner: false, isWritable: true  },
        { pubkey: buybackPDA,  isSigner: false, isWritable: true  },
        { pubkey: creatorPDA,  isSigner: false, isWritable: true  },
        { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
      ] : [
        { pubkey: walletPk,    isSigner: true,  isWritable: true  },
        { pubkey: mint,        isSigner: false, isWritable: true  },
        { pubkey: curvePDA,    isSigner: false, isWritable: true  },
        { pubkey: vaultATA,    isSigner: false, isWritable: true  },
        { pubkey: walletATA,   isSigner: false, isWritable: true  },
        { pubkey: TREASURY,    isSigner: false, isWritable: true  },
        { pubkey: buybackPDA,  isSigner: false, isWritable: true  },
        { pubkey: creatorPDA,  isSigner: false, isWritable: true  },
        { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
      ];

      tx.add(new TransactionInstruction({ programId: PROGRAM_ID, keys, data }));

      // Set fee payer and blockhash
      tx.feePayer = walletPk;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const base64Tx   = serialized.toString("base64");

      res.json({
        transaction: base64Tx,
        message:     `Sign and broadcast this transaction to ${side} on JetForge`,
        quote: {
          marketId:        mintStr,
          side,
          inputAmount:     amountBig.toString(),
          outputAmount:    outputAmount.toString(),
          fee:             fee.toString(),
          minimumOutput:   minOut.toString(),
          slippageBps:     slipBps,
          blockhash,
          lastValidBlockHeight,
        },
        instructions: {
          description: "Sign with your wallet and sendRawTransaction",
          code: [
            "const tx = Transaction.from(Buffer.from(response.transaction, 'base64'));",
            "const signed = await wallet.signTransaction(tx);",
            "const sig = await connection.sendRawTransaction(signed.serialize());",
            "await connection.confirmTransaction(sig, 'confirmed');",
          ],
        },
      });
    } catch (e: any) {
      if (e.message?.includes("Invalid public key")) {
        return res.status(400).json({ error: "Invalid mint or wallet address" });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /wallet/:address ──────────────────────────────────────────────────
  /**
   * Get SOL balance and all SPL token positions for a wallet.
   * Query param: mints (comma-separated, optional filter)
   *
   * Response: { wallet, solBalance, solBalanceSOL, tokens: [...] }
   */
  router.get("/wallet/:address", async (req: Request, res: Response) => {
    try {
      const walletPk = new PublicKey(req.params.address);
      const filterMints = req.query.mints
        ? (req.query.mints as string).split(",").map(s => s.trim())
        : null;

      const [solBalance, tokenAccounts] = await Promise.all([
        connection.getBalance(walletPk),
        connection.getParsedTokenAccountsByOwner(walletPk, { programId: TOKEN_PROGRAM_ID }),
      ]);

      const tokens = tokenAccounts.value
        .filter(a => {
          const info = a.account.data.parsed.info;
          if (Number(info.tokenAmount.amount) === 0) return false;
          if (filterMints) return filterMints.includes(info.mint as string);
          return true;
        })
        .map(a => {
          const info = a.account.data.parsed.info;
          return {
            mint:       info.mint as string,
            balance:    info.tokenAmount.amount as string,
            balanceUi:  info.tokenAmount.uiAmount as number ?? 0,
            decimals:   info.tokenAmount.decimals as number,
            ataAddress: a.pubkey.toBase58(),
          };
        });

      res.json({
        wallet:        req.params.address,
        solBalance:    solBalance.toString(),
        solBalanceSOL: solBalance / LAMPORTS_PER_SOL,
        tokenCount:    tokens.length,
        tokens,
      });
    } catch (e: any) {
      if (e.message?.includes("Invalid public key")) {
        return res.status(400).json({ error: "Invalid wallet address" });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /health ───────────────────────────────────────────────────────────
  router.get("/health", async (_req: Request, res: Response) => {
    const slot = await connection.getSlot().catch(() => 0);
    res.json({
      status:    "ok",
      version:   "1.0.0",
      network:   config.solana.rpcUrl.includes("devnet") ? "devnet" : "mainnet",
      programId: config.solana.programId,
      slot,
      docs:      "https://jetforge.io/docs/api",
    });
  });

  return router;
}
