/**
 * Graduate Keeper Service
 *
 * When a buy triggers graduation (BuyEvent.isGraduated = true), this service
 * automatically calls the on-chain `graduate` instruction using the treasury keypair.
 *
 * The `graduate` instruction:
 *  - Distributes SOL (5% treasury fee + 5% creator reward + 90% to treasury for DEX)
 *  - Transfers all unsold tokens to treasury's ATA
 *  - Emits GraduationEvent → triggers Raydium pool creation in raydiumService
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { config } from "../config";
// NOTE: circular import is intentional and safe — prisma is accessed only inside
// function bodies (never at module-init time), so by the time callGraduateInstruction
// runs, index.ts has fully executed and prisma is initialised on the exports object.
import { prisma } from "../index";

const PROGRAM_ID = new PublicKey(config.solana.programId);
const TREASURY_PUBKEY = new PublicKey(config.solana.treasuryAddress);

// Anchor instruction discriminator: sha256("global:graduate")[0..8]
const GRADUATE_DISCRIMINATOR = Buffer.from([45, 235, 225, 181, 17, 218, 64, 130]);

// Track in-flight graduations to avoid duplicate calls
const inFlight = new Set<string>();

function getTreasuryKeypair(): Keypair | null {
  const raw = process.env.TREASURY_PRIVATE_KEY;
  if (!raw || raw.trim() === "" || raw.trim() === '""') return null;
  try {
    let cleaned = raw.trim().replace(/^"|"$/g, "");
    // Accept both "[1,2,3]" and "1,2,3" formats
    if (!cleaned.startsWith("[")) cleaned = `[${cleaned}]`;
    const secretKey = Uint8Array.from(JSON.parse(cleaned));
    return Keypair.fromSecretKey(secretKey);
  } catch {
    console.error("[KEEPER] Failed to parse TREASURY_PRIVATE_KEY");
    return null;
  }
}

function getBondingCurvePDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

function getReserveVaultPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("reserve_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Fetch the creator address stored in the on-chain BondingCurveState.
 * Layout: 8 (discriminator) + 32 (mint) + 32 (creator) = creator at offset 40
 */
async function fetchCreatorFromChain(
  connection: Connection,
  bondingCurvePDA: PublicKey
): Promise<PublicKey | null> {
  try {
    const info = await connection.getAccountInfo(bondingCurvePDA);
    if (!info || info.data.length < 72) return null;
    return new PublicKey(info.data.slice(40, 72));
  } catch {
    return null;
  }
}

/**
 * Call the `graduate` instruction for a graduated token.
 * Safe to call multiple times — deduplicates in-flight calls.
 */
export async function callGraduateInstruction(mintStr: string): Promise<void> {
  // ── On-chain dedup: read real_sol_reserves directly from the bonding curve ──
  // DO NOT use the DB isGraduated flag here — the BuyEvent handler sets that flag
  // before the keeper runs, causing the keeper to skip and leave the on-chain
  // graduate instruction uncalled (the graduation SOL never distributed).
  // Instead, check real_sol_reserves: if already 0 the instruction already ran.
  try {
    const connection = new Connection(config.solana.rpcUrl, "confirmed");
    const mint = new PublicKey(mintStr);
    const bondingCurvePDA = getBondingCurvePDA(mint);
    const bcInfo = await connection.getAccountInfo(bondingCurvePDA);
    if (bcInfo && bcInfo.data.length >= 96) {
      // BondingCurveState layout: 8 disc + 32 mint + 32 creator + 8 vSol + 8 vTok + 8 realSol
      // real_sol_reserves is at byte offset 88
      const realSolReserves = bcInfo.data.readBigUInt64LE(88);
      if (realSolReserves === 0n) {
        console.log(`[KEEPER] ${mintStr.slice(0, 8)}… already graduated on-chain (realSol=0) — skipping`);
        return;
      }
    }
  } catch (chainErr: any) {
    // Fail open: if the on-chain check fails, proceed — the on-chain error is the final guard.
    console.warn(`[KEEPER] On-chain pre-check failed for ${mintStr.slice(0, 8)}…:`, chainErr?.message);
  }

  if (inFlight.has(mintStr)) {
    console.log(`[KEEPER] Graduate already in-flight for ${mintStr.slice(0, 8)}…`);
    return;
  }

  const treasuryKeypair = getTreasuryKeypair();
  if (!treasuryKeypair) {
    console.warn("[KEEPER] TREASURY_PRIVATE_KEY not configured — cannot auto-graduate");
    return;
  }

  inFlight.add(mintStr);

  try {
    const connection = new Connection(config.solana.rpcUrl, "confirmed");
    const mint = new PublicKey(mintStr);
    const bondingCurve = getBondingCurvePDA(mint);
    const tokenVault = getAssociatedTokenAddressSync(mint, bondingCurve, true);
    const reserveVault = getReserveVaultPDA(mint);
    const treasuryTokenAccount = getAssociatedTokenAddressSync(mint, TREASURY_PUBKEY, false);

    // Fetch creator from on-chain bonding curve state
    const creator = await fetchCreatorFromChain(connection, bondingCurve);
    if (!creator) {
      console.error(`[KEEPER] Could not fetch creator for ${mintStr.slice(0, 8)}…`);
      return;
    }

    console.log(`[KEEPER] Calling graduate for ${mintStr.slice(0, 8)}… creator=${creator.toBase58().slice(0, 8)}…`);

    // Create treasury ATA for the token if it doesn't exist yet
    // (graduate.rs requires it to already exist — no init_if_needed)
    console.log(`[KEEPER] Ensuring treasury token ATA exists…`);
    await getOrCreateAssociatedTokenAccount(
      connection,
      treasuryKeypair,   // payer
      mint,
      TREASURY_PUBKEY
    );

    // Use a fresh ephemeral keypair as the transaction fee payer / caller.
    // This is CRITICAL: if caller == treasury (same pubkey), Solana's lamport
    // conservation check double-counts the treasury's balance change and fails.
    // Fund it from treasury (do NOT use airdrop — it's rate-limited on devnet).
    const callerKeypair = Keypair.generate();
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: callerKeypair.publicKey,
        lamports: 10_000_000, // 0.01 SOL — enough for tx fees
      })
    );
    await sendAndConfirmTransaction(connection, fundTx, [treasuryKeypair], { commitment: "confirmed" });
    console.log(`[KEEPER] Ephemeral caller funded: ${callerKeypair.publicKey.toBase58().slice(0, 8)}…`);

    // Build the graduate instruction
    const keys = [
      { pubkey: callerKeypair.publicKey,    isSigner: true,  isWritable: true  }, // caller (ephemeral)
      { pubkey: mint,                       isSigner: false, isWritable: true  }, // mint (mut — required for burn CPI)
      { pubkey: bondingCurve,               isSigner: false, isWritable: true  }, // bonding_curve
      { pubkey: tokenVault,                 isSigner: false, isWritable: true  }, // token_vault
      { pubkey: reserveVault,               isSigner: false, isWritable: true  }, // reserve_vault
      { pubkey: TREASURY_PUBKEY,            isSigner: false, isWritable: true  }, // treasury
      { pubkey: treasuryTokenAccount,       isSigner: false, isWritable: true  }, // treasury_token_account
      { pubkey: creator,                    isSigner: false, isWritable: true  }, // creator
      { pubkey: TOKEN_PROGRAM_ID,           isSigner: false, isWritable: false }, // token_program
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,isSigner: false, isWritable: false }, // associated_token_program
      { pubkey: SystemProgram.programId,    isSigner: false, isWritable: false }, // system_program
    ];

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys,
      data: GRADUATE_DISCRIMINATOR,
    });

    const tx = new Transaction().add(instruction);
    const sig = await sendAndConfirmTransaction(connection, tx, [callerKeypair], {
      commitment: "confirmed",
      skipPreflight: true, // bypass simulation — check actual on-chain result
    });

    console.log(`[KEEPER] Graduate tx confirmed: ${sig}`);

    // Mark graduated in DB immediately so a concurrent or post-restart call
    // is blocked by the DB pre-check above. The indexer will also set this flag
    // when it processes the on-chain graduation event — both writes are idempotent.
    await prisma.token.update({
      where: { mint: mintStr },
      data: { isGraduated: true },
    }).catch((e: any) => {
      // Non-fatal: the indexer will update the flag when it processes the event
      console.warn(`[KEEPER] Could not mark ${mintStr.slice(0, 8)}… graduated in DB:`, e?.message);
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const logs: string[] = err?.logs ?? [];
    if (msg.includes("AlreadyGraduated") || msg.includes("already in use")) {
      console.log(`[KEEPER] Token ${mintStr.slice(0, 8)}… already graduated on-chain`);
    } else {
      console.error(`[KEEPER] Graduate instruction failed for ${mintStr.slice(0, 8)}…:`);
      console.error("  message:", msg);
      console.error("  logs:", JSON.stringify(logs, null, 2));
      console.error("  raw:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    }
  } finally {
    inFlight.delete(mintStr);
  }
}
