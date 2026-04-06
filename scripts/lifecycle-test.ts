/**
 * ⚠️  TEST-ONLY lifecycle rehearsal script for devnet.
 * Exercises: create_token → buy #1 → execute_buyback →
 *            buy until graduation → graduate
 *
 * TEST thresholds in effect (patch in bonding_curve.rs):
 *   GRADUATION_THRESHOLD = 1 SOL     (prod: 85 SOL)
 *   BUYBACK_THRESHOLD    = 0.0005 SOL (prod: 0.5 SOL)
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import BN from "bn.js";
import * as fs from "fs";
import idl from "../target/idl/token_launch.json";

const PROGRAM_ID                    = new PublicKey("EFHQqg1qrv18pxgob5uuy4nRZ3XpUwBmUHzqpFUUK6MV");
const TREASURY                      = new PublicKey("13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW");
const FEE_BPS                       = 100;
const BPS_DENOM                     = 10_000;
// ⚠️  TEST-ONLY — must match bonding_curve.rs TEST values
const GRADUATION_THRESHOLD_LAMPORTS = 1_000_000_000;   // 1 SOL
const BUYBACK_THRESHOLD_LAMPORTS    = 500_000;          // 0.0005 SOL

interface Step { step: string; tx?: string; note?: string; data?: any }
const steps: Step[] = [];
function log(step: string, tx?: string, note?: string, data?: any) {
  steps.push({ step, tx, note, data });
  console.log(`\n${"─".repeat(70)}`);
  console.log(`▶  ${step}`);
  if (tx)   console.log(`   tx: ${tx}`);
  if (note) console.log(`   ${note}`);
  if (data) console.log(JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));
}

async function fund(conn: anchor.web3.Connection, to: PublicKey, payer: Keypair, lamports: number) {
  const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: to, lamports }));
  await sendAndConfirmTransaction(conn, tx, [payer]);
}

function tokensOut(vSol: BN, vTok: BN, solAfterFee: BN): BN {
  const k = vSol.mul(vTok);
  return vTok.sub(k.div(vSol.add(solAfterFee)));
}

async function main() {
  const walletKp = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync("D:/.solana-config/id.json", "utf8")))
  );
  const conn     = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  const wallet   = new anchor.Wallet(walletKp);
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program  = new anchor.Program(idl as any, provider) as any;

  const startBal = await conn.getBalance(walletKp.publicKey);
  console.log(`\n${"═".repeat(70)}`);
  console.log(`LIFECYCLE TEST  devnet`);
  console.log(`Wallet: ${walletKp.publicKey.toBase58()}`);
  console.log(`Balance: ${(startBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Thresholds: GRADUATION=${GRADUATION_THRESHOLD_LAMPORTS/1e9} SOL | BUYBACK=${BUYBACK_THRESHOLD_LAMPORTS/1e9} SOL`);
  console.log(`${"═".repeat(70)}\n`);

  // Keypairs
  const mint    = Keypair.generate();
  const creator = Keypair.generate();
  const buyer   = Keypair.generate();
  await fund(conn, creator.publicKey, walletKp, Math.floor(0.05 * LAMPORTS_PER_SOL));
  await fund(conn, buyer.publicKey,   walletKp, Math.floor(2.0 * LAMPORTS_PER_SOL));

  // PDAs
  const [bcPDA]         = PublicKey.findProgramAddressSync([Buffer.from("bonding_curve"), mint.publicKey.toBuffer()], PROGRAM_ID);
  const [reserveVault]  = PublicKey.findProgramAddressSync([Buffer.from("reserve_vault"),  mint.publicKey.toBuffer()], PROGRAM_ID);
  const [buybackVault]  = PublicKey.findProgramAddressSync([Buffer.from("buyback_vault"),  mint.publicKey.toBuffer()], PROGRAM_ID);
  const [creatorVault]  = PublicKey.findProgramAddressSync([Buffer.from("creator_vault"),  mint.publicKey.toBuffer()], PROGRAM_ID);
  const tokenVault      = await getAssociatedTokenAddress(mint.publicKey, bcPDA, true);
  const buyerATA        = await getAssociatedTokenAddress(mint.publicKey, buyer.publicKey);

  // ── STEP 1: create_token ────────────────────────────────────────────────
  const createTx = await program.methods
    .createToken("LifecycleTest", "LCTEST", "https://example.com/test.json")
    .accounts({
      creator: creator.publicKey, mint: mint.publicKey,
      bondingCurve: bcPDA, tokenVault, reserveVault,
      buybackVault, creatorVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([creator, mint])
    .rpc();

  const c0 = await program.account.bondingCurveState.fetch(bcPDA);
  log("1. create_token", createTx, `mint=${mint.publicKey.toBase58()}`, {
    realSolReserves: c0.realSolReserves.toString(),
    realTokenReserves: c0.realTokenReserves.toString(),
    complete: c0.complete,
  });

  // ── STEP 2: buy #1 (fill buyback vault) ────────────────────────────────
  // 0.4 SOL buy → 1% fee → 20% buyback = 800k lamports → threshold 500k → triggers
  const buy1Sol = new BN(Math.floor(0.4 * LAMPORTS_PER_SOL));
  const buy1Fee = buy1Sol.muln(FEE_BPS).divn(BPS_DENOM);
  const c1      = await program.account.bondingCurveState.fetch(bcPDA);
  const minTok1 = tokensOut(c1.virtualSolReserves, c1.virtualTokenReserves, buy1Sol.sub(buy1Fee)).muln(90).divn(100);

  const buy1Tx = await program.methods.buy(buy1Sol, minTok1).accounts({
    buyer: buyer.publicKey, mint: mint.publicKey,
    bondingCurve: bcPDA, tokenVault, buyerTokenAccount: buyerATA,
    treasury: TREASURY, buybackVault, creatorVault,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).signers([buyer]).rpc();

  const c1After   = await program.account.bondingCurveState.fetch(bcPDA);
  const bb1Lamps  = await conn.getBalance(buybackVault);
  const tokBefore = await getAccount(conn, tokenVault);
  log("2. buy #1 (0.4 SOL — fills buyback vault)", buy1Tx, undefined, {
    realSolReserves:     c1After.realSolReserves.toString(),
    totalTrades:         c1After.totalTrades.toString(),
    complete:            c1After.complete,
    buybackVaultLamports: bb1Lamps,
    buybackVaultSOL:     (bb1Lamps / 1e9).toFixed(6),
    thresholdMet:        bb1Lamps >= BUYBACK_THRESHOLD_LAMPORTS,
  });

  // ── STEP 3: execute_buyback ─────────────────────────────────────────────
  let buybackTx = "";
  const bbBeforeExecute = await conn.getBalance(buybackVault);
  if (!c1After.complete && bbBeforeExecute >= BUYBACK_THRESHOLD_LAMPORTS) {
    const supplyBefore = tokBefore.amount;

    buybackTx = await program.methods.executeBuyback().accounts({
      payer:        buyer.publicKey,
      mint:         mint.publicKey,
      bondingCurve: bcPDA,
      tokenVault,
      buybackVault,
      tokenProgram:           TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram:          SystemProgram.programId,
    }).signers([buyer]).rpc();

    const tokAfter   = await getAccount(conn, tokenVault);
    const cAfterBB   = await program.account.bondingCurveState.fetch(bcPDA);
    const bbAfterLam = await conn.getBalance(buybackVault);
    const burned     = supplyBefore - tokAfter.amount;

    log("3. execute_buyback", buybackTx, "✅ buyback triggered — SOL in, tokens burned", {
      buybackVaultBefore:  bbBeforeExecute,
      buybackVaultAfter:   bbAfterLam,
      solUsedForBuyback:   ((bbBeforeExecute - bbAfterLam) / 1e9).toFixed(6),
      tokensBurned:        burned.toString(),
      tokenVaultBefore:    supplyBefore.toString(),
      tokenVaultAfter:     tokAfter.amount.toString(),
      realSolAfterBuyback: cAfterBB.realSolReserves.toString(),
      virtualSolAfter:     cAfterBB.virtualSolReserves.toString(),
      completedByBuyback:  cAfterBB.complete,
    });
  } else {
    log("3. execute_buyback", undefined,
      c1After.complete
        ? "SKIPPED — already graduated"
        : `SKIPPED — vault (${bbBeforeExecute}) < threshold (${BUYBACK_THRESHOLD_LAMPORTS})`
    );
  }

  // ── STEP 4: buy until graduation ────────────────────────────────────────
  const gradBuyTxs: string[] = [];
  let cNow = await program.account.bondingCurveState.fetch(bcPDA);
  let round = 0;

  if (!cNow.complete) {
    console.log(`\n── Buying to push realSolReserves to ${GRADUATION_THRESHOLD_LAMPORTS/1e9} SOL ──`);
    while (!cNow.complete && round < 15) {
      const needed = GRADUATION_THRESHOLD_LAMPORTS - cNow.realSolReserves.toNumber();
      if (needed <= 0) break;
      const solIn  = new BN(Math.min(needed + 15_000_000, Math.floor(0.5 * LAMPORTS_PER_SOL)));
      const minTok = new BN(0);
      try {
        const tx = await program.methods.buy(solIn, minTok).accounts({
          buyer: buyer.publicKey, mint: mint.publicKey,
          bondingCurve: bcPDA, tokenVault, buyerTokenAccount: buyerATA,
          treasury: TREASURY, buybackVault, creatorVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).signers([buyer]).rpc();
        gradBuyTxs.push(tx);
        cNow = await program.account.bondingCurveState.fetch(bcPDA);
        console.log(`  grad-buy #${++round}: realSol=${(cNow.realSolReserves.toNumber()/1e9).toFixed(4)} SOL | complete=${cNow.complete}`);
      } catch (e: any) {
        console.log(`  grad-buy error: ${e.message?.slice(0, 120)}`); break;
      }
    }
    log("4. buy-loop (for graduation)", gradBuyTxs.at(-1), undefined, {
      realSolReserves: cNow.realSolReserves.toString(),
      complete:        cNow.complete,
      totalTrades:     cNow.totalTrades.toString(),
    });
  } else {
    log("4. buy-loop (graduation)", undefined, "SKIPPED — already graduated from buyback or prior buys");
  }

  // ── STEP 5: graduate ────────────────────────────────────────────────────
  cNow = await program.account.bondingCurveState.fetch(bcPDA);
  let graduateTx = "";

  if (cNow.complete) {
    const bcBalBefore = await conn.getBalance(bcPDA);
    const tBalBefore  = await conn.getBalance(TREASURY);
    const cBalBefore  = await conn.getBalance(creator.publicKey);

    try {
      graduateTx = await program.methods.graduate().accounts({
        caller:       walletKp.publicKey,
        mint:         mint.publicKey,
        bondingCurve: bcPDA,
        tokenVault,
        reserveVault,
        treasury:     TREASURY,
        creator:      creator.publicKey,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          SystemProgram.programId,
      }).signers([walletKp]).rpc();

      const bcBalAfter = await conn.getBalance(bcPDA);
      const tBalAfter  = await conn.getBalance(TREASURY);
      const cBalAfter  = await conn.getBalance(creator.publicKey);

      log("5. graduate", graduateTx, "✅ graduation executed", {
        bcSOLDrained:     ((bcBalBefore - bcBalAfter) / 1e9).toFixed(6),
        treasuryReceived: ((tBalAfter - tBalBefore) / 1e9).toFixed(6),
        creatorReceived:  ((cBalAfter - cBalBefore) / 1e9).toFixed(6),
      });
    } catch (e: any) {
      log("5. graduate", undefined, `FAILED: ${e.message?.slice(0, 200)}`);
    }
  } else {
    log("5. graduate", undefined, `NOT REACHED — realSol=${cNow.realSolReserves.toString()} complete=${cNow.complete}`);
  }

  // ── STEP 6: creator fee withdrawal ─────────────────────────────────────
  let withdrawTx = "";
  const cvBal = await conn.getBalance(creatorVault);
  const crBal = await conn.getBalance(creator.publicKey);
  try {
    withdrawTx = await program.methods.withdrawCreatorFees().accounts({
      creator:      creator.publicKey,
      mint:         mint.publicKey,
      bondingCurve: bcPDA,
      creatorVault,
      systemProgram: SystemProgram.programId,
    }).signers([creator]).rpc();

    const cvBalAfter = await conn.getBalance(creatorVault);
    const crBalAfter = await conn.getBalance(creator.publicKey);
    log("6. withdraw_creator_fees", withdrawTx, "✅ creator fees withdrawn", {
      creatorVaultBefore: cvBal,
      creatorVaultAfter:  cvBalAfter,
      creatorReceived:    ((crBalAfter - crBal) / 1e9).toFixed(6) + " SOL",
    });
  } catch (e: any) {
    log("6. withdraw_creator_fees", undefined, `FAILED: ${e.message?.slice(0, 200)}`);
  }

  // ── STEP 7: final on-chain state ─────────────────────────────────────────
  const finalCurve = await program.account.bondingCurveState.fetch(bcPDA);
  const endBal     = await conn.getBalance(walletKp.publicKey);
  log("7. final on-chain state", undefined, undefined, {
    mint:                 mint.publicKey.toBase58(),
    bondingCurvePDA:      bcPDA.toBase58(),
    virtualSolReserves:   finalCurve.virtualSolReserves.toString(),
    virtualTokenReserves: finalCurve.virtualTokenReserves.toString(),
    realSolReserves:      finalCurve.realSolReserves.toString(),
    realTokenReserves:    finalCurve.realTokenReserves.toString(),
    complete:             finalCurve.complete,
    totalTrades:          finalCurve.totalTrades.toString(),
    totalVolumeSol:       finalCurve.totalVolumeSol.toString(),
    walletSOLSpent:       ((startBal - endBal) / 1e9).toFixed(4),
  });

  const output = { timestamp: new Date().toISOString(), mint: mint.publicKey.toBase58(), bondingCurvePDA: bcPDA.toBase58(), thresholds: { GRADUATION_THRESHOLD_LAMPORTS, BUYBACK_THRESHOLD_LAMPORTS }, steps };
  fs.writeFileSync("D:/token dex/scripts/lifecycle-output.json", JSON.stringify(output, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));
  console.log(`\n${"═".repeat(70)}\nResults → scripts/lifecycle-output.json\n${"═".repeat(70)}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
