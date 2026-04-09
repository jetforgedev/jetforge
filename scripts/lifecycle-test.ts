/**
 * Lifecycle rehearsal script for devnet.
 * Exercises: create_token → buy #1 → execute_buyback →
 *            buy until graduation → graduate → withdraw_creator_fees
 *
 * Targets the currently deployed devnet program (7rXDkm…) with real constants:
 *   GRADUATION_THRESHOLD = 0.5 SOL  (devnet test value)
 *   BUYBACK_THRESHOLD    = 0.1 SOL
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import BN from "bn.js";
import * as fs from "fs";
import idlFile from "../target/idl/token_launch.json";

// Use the currently-deployed devnet program (70/30 tokenomics, 0.5 SOL graduation threshold)
const DEPLOYED_PROGRAM_ID          = "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk";

// The built IDL is stale — it's missing `metadata` and `token_metadata_program` from
// create_token. Patch them in before constructing the anchor.Program client.
function patchIdl(raw: any, programId: string): any {
  const patched = JSON.parse(JSON.stringify(raw));
  patched.address = programId;

  // create_token: IDL missing `metadata` (pos 7) and `token_metadata_program` (pos 10)
  const createTokenIx = patched.instructions.find((i: any) => i.name === "create_token");
  if (createTokenIx) {
    createTokenIx.accounts.splice(7, 0,
      { name: "metadata",               writable: true }
    );
    createTokenIx.accounts.splice(10, 0,
      { name: "token_metadata_program" }
    );
  }

  // graduate: IDL has mint as read-only but new code requires mut (for burn CPI).
  // Also missing `treasury_token_account` (pos 6, between treasury and creator).
  const graduateIx = patched.instructions.find((i: any) => i.name === "graduate");
  if (graduateIx) {
    const mintAcc = graduateIx.accounts.find((a: any) => a.name === "mint");
    if (mintAcc) mintAcc.writable = true;
    graduateIx.accounts.splice(6, 0,
      { name: "treasury_token_account", writable: true }
    );
  }

  return patched;
}
const idl = patchIdl(idlFile, DEPLOYED_PROGRAM_ID);

const PROGRAM_ID                    = new PublicKey(DEPLOYED_PROGRAM_ID);
const TOKEN_METADATA_PROGRAM_ID     = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const TREASURY                      = new PublicKey("13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW");
const FEE_BPS                       = 100;
const BPS_DENOM                     = 10_000;
// Match bonding_curve.rs constants exactly
const GRADUATION_THRESHOLD_LAMPORTS = 500_000_000;    // 0.5 SOL
const BUYBACK_THRESHOLD_LAMPORTS    = 100_000_000;    // 0.1 SOL

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
  await fund(conn, creator.publicKey, walletKp, Math.floor(0.03 * LAMPORTS_PER_SOL));
  await fund(conn, buyer.publicKey,   walletKp, Math.floor(0.8 * LAMPORTS_PER_SOL));

  // PDAs
  const [bcPDA]         = PublicKey.findProgramAddressSync([Buffer.from("bonding_curve"), mint.publicKey.toBuffer()], PROGRAM_ID);
  const [reserveVault]  = PublicKey.findProgramAddressSync([Buffer.from("reserve_vault"),  mint.publicKey.toBuffer()], PROGRAM_ID);
  const [metadataPDA]   = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );
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
      metadata: metadataPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
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

  // ── STEP 3: sell half of buyer's tokens ────────────────────────────────
  const buyerAtaInfo  = await getAccount(conn, buyerATA);
  const tokensHeld    = buyerAtaInfo.amount;
  const tokensToSell  = tokensHeld / 2n;   // sell 50% of what buyer received

  let sellTx = "";
  let solFromSell = 0;
  try {
    // minSolOut = 0 (no slippage guard for test)
    sellTx = await program.methods
      .sell(new BN(tokensToSell.toString()), new BN(0))
      .accounts({
        seller:           buyer.publicKey,
        mint:             mint.publicKey,
        bondingCurve:     bcPDA,
        tokenVault,
        sellerTokenAccount: buyerATA,
        treasury:         TREASURY,
        buybackVault,
        creatorVault,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const cSell    = await program.account.bondingCurveState.fetch(bcPDA);
    const ataAfter = await getAccount(conn, buyerATA);
    log("3. sell (50% of tokens)", sellTx, "✅ sell succeeded", {
      tokensSold:          tokensToSell.toString(),
      tokensRemaining:     ataAfter.amount.toString(),
      realSolAfterSell:    cSell.realSolReserves.toString(),
      realTokenAfterSell:  cSell.realTokenReserves.toString(),
    });
  } catch (e: any) {
    log("3. sell (50% of tokens)", undefined, `FAILED: ${e.message?.slice(0, 200)}`);
  }

  // ── STEP 5: execute_buyback ─────────────────────────────────────────────
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

    log("5. execute_buyback", buybackTx, "✅ buyback triggered — SOL in, tokens burned", {
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
    log("5. execute_buyback", undefined,
      c1After.complete
        ? "SKIPPED — already graduated"
        : `SKIPPED — vault (${bbBeforeExecute}) < threshold (${BUYBACK_THRESHOLD_LAMPORTS})`
    );
  }

  // ── STEP 6: buy until graduation ────────────────────────────────────────
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
    log("6. buy-loop (for graduation)", gradBuyTxs.at(-1), undefined, {
      realSolReserves: cNow.realSolReserves.toString(),
      complete:        cNow.complete,
      totalTrades:     cNow.totalTrades.toString(),
    });
  } else {
    log("6. buy-loop (graduation)", undefined, "SKIPPED — already graduated from buyback or prior buys");
  }

  // ── STEP 7: graduate ────────────────────────────────────────────────────
  cNow = await program.account.bondingCurveState.fetch(bcPDA);
  let graduateTx = "";

  if (cNow.complete) {
    const bcBalBefore = await conn.getBalance(bcPDA);
    const tBalBefore  = await conn.getBalance(TREASURY);
    const cBalBefore  = await conn.getBalance(creator.publicKey);

    try {
      // Create treasury ATA for the token if needed — graduate.rs requires it to exist
      const treasuryTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        conn, walletKp, mint.publicKey, TREASURY
      );
      const treasuryTokenAccount = treasuryTokenAccountInfo.address;

      graduateTx = await program.methods.graduate().accounts({
        caller:               walletKp.publicKey,
        mint:                 mint.publicKey,
        bondingCurve:         bcPDA,
        tokenVault,
        reserveVault,
        treasury:             TREASURY,
        treasuryTokenAccount,
        creator:              creator.publicKey,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          SystemProgram.programId,
      }).signers([walletKp]).rpc();

      const bcBalAfter = await conn.getBalance(bcPDA);
      const tBalAfter  = await conn.getBalance(TREASURY);
      const cBalAfter  = await conn.getBalance(creator.publicKey);

      log("7. graduate", graduateTx, "✅ graduation executed", {
        bcSOLDrained:     ((bcBalBefore - bcBalAfter) / 1e9).toFixed(6),
        treasuryReceived: ((tBalAfter - tBalBefore) / 1e9).toFixed(6),
        creatorReceived:  ((cBalAfter - cBalBefore) / 1e9).toFixed(6),
      });
    } catch (e: any) {
      log("7. graduate", undefined, `FAILED: ${e.message?.slice(0, 200)}`);
    }
  } else {
    log("7. graduate", undefined, `NOT REACHED — realSol=${cNow.realSolReserves.toString()} complete=${cNow.complete}`);
  }

  // ── STEP 8: creator fee withdrawal ─────────────────────────────────────
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
    log("8. withdraw_creator_fees", withdrawTx, "✅ creator fees withdrawn", {
      creatorVaultBefore: cvBal,
      creatorVaultAfter:  cvBalAfter,
      creatorReceived:    ((crBalAfter - crBal) / 1e9).toFixed(6) + " SOL",
    });
  } catch (e: any) {
    log("8. withdraw_creator_fees", undefined, `FAILED: ${e.message?.slice(0, 200)}`);
  }

  // ── STEP 9: final on-chain state ─────────────────────────────────────────
  const finalCurve = await program.account.bondingCurveState.fetch(bcPDA);
  const endBal     = await conn.getBalance(walletKp.publicKey);
  log("9. final on-chain state", undefined, undefined, {
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
