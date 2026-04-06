/**
 * Devnet Rehearsal Script
 * Creates a token, buys, and sells on the deployed program.
 * Program: EFHQqg1qrv18pxgob5uuy4nRZ3XpUwBmUHzqpFUUK6MV
 * Wallet:  D:/.solana-config/id.json  (also the treasury)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import BN from "bn.js";

// Load IDL
const idlPath = path.join(__dirname, "../target/idl/token_launch.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

// Load wallet
const walletPath = "D:/.solana-config/id.json";
const walletKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
);

// Constants matching bonding_curve.rs
const TREASURY_PUBKEY = new PublicKey(
  "13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW"
);
const FEE_BPS = 100;
const BPS_DENOM = 10_000;

function tokensOut(vSol: BN, vTok: BN, solAfterFee: BN): BN {
  const k = vSol.mul(vTok);
  return vTok.sub(k.div(vSol.add(solAfterFee)));
}

function solOut(vSol: BN, vTok: BN, tokIn: BN): BN {
  const k = vSol.mul(vTok);
  return vSol.sub(k.div(vTok.add(tokIn)));
}

async function main() {
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = new anchor.Program(idl as any, provider) as any;

  console.log("=== DEVNET REHEARSAL ===");
  console.log("Wallet:", walletKeypair.publicKey.toBase58());
  console.log("Program:", program.programId.toBase58());

  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  // Generate fresh keypairs for this rehearsal
  const mint = Keypair.generate();
  const creator = Keypair.generate();
  const buyer = Keypair.generate();

  console.log("\nMint:", mint.publicKey.toBase58());
  console.log("Creator:", creator.publicKey.toBase58());
  console.log("Buyer:", buyer.publicKey.toBase58());

  // Fund creator and buyer from our wallet
  console.log("\n--- Funding creator and buyer ---");
  const fundCreatorTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletKeypair.publicKey,
      toPubkey: creator.publicKey,
      lamports: Math.floor(0.05 * LAMPORTS_PER_SOL),
    })
  );
  const fundBuyerTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletKeypair.publicKey,
      toPubkey: buyer.publicKey,
      lamports: Math.floor(0.5 * LAMPORTS_PER_SOL),
    })
  );

  const fundCreatorSig = await sendAndConfirmTransaction(
    connection,
    fundCreatorTx,
    [walletKeypair]
  );
  console.log("Fund creator tx:", fundCreatorSig);

  const fundBuyerSig = await sendAndConfirmTransaction(
    connection,
    fundBuyerTx,
    [walletKeypair]
  );
  console.log("Fund buyer tx:", fundBuyerSig);

  // Derive PDAs
  const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.publicKey.toBuffer()],
    program.programId
  );
  const tokenVault = await getAssociatedTokenAddress(
    mint.publicKey,
    bondingCurvePDA,
    true
  );
  const [reserveVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("reserve_vault"), mint.publicKey.toBuffer()],
    program.programId
  );
  const [buybackVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_vault"), mint.publicKey.toBuffer()],
    program.programId
  );
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), mint.publicKey.toBuffer()],
    program.programId
  );

  console.log("\nbondingCurvePDA:", bondingCurvePDA.toBase58());
  console.log("tokenVault:", tokenVault.toBase58());
  console.log("creatorVault:", creatorVault.toBase58());

  // ── STEP 1: create_token ────────────────────────────────────────────────────
  console.log("\n--- STEP 1: create_token ---");
  const createTx = await program.methods
    .createToken(
      "Rehearsal Token",
      "REHRS",
      "https://rehearsal.example.com/meta.json"
    )
    .accounts({
      creator: creator.publicKey,
      mint: mint.publicKey,
      bondingCurve: bondingCurvePDA,
      tokenVault,
      reserveVault,
      buybackVault,
      creatorVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([creator, mint])
    .rpc();

  console.log("create_token tx:", createTx);

  const curve = await program.account.bondingCurveState.fetch(bondingCurvePDA);
  console.log("virtualSolReserves:", curve.virtualSolReserves.toString());
  console.log("virtualTokenReserves:", curve.virtualTokenReserves.toString());
  console.log("realSolReserves:", curve.realSolReserves.toString());
  console.log("complete:", curve.complete);

  // ── STEP 2: buy ─────────────────────────────────────────────────────────────
  console.log("\n--- STEP 2: buy ---");
  const solIn = new BN(Math.floor(0.2 * LAMPORTS_PER_SOL));
  const fee = solIn.muln(FEE_BPS).divn(BPS_DENOM);
  const solAfterFee = solIn.sub(fee);

  const curveBeforeBuy = await program.account.bondingCurveState.fetch(bondingCurvePDA);
  const expectedTok = tokensOut(
    curveBeforeBuy.virtualSolReserves,
    curveBeforeBuy.virtualTokenReserves,
    solAfterFee
  );
  const minTok = expectedTok.muln(95).divn(100); // 5% slippage

  const buyerATA = await getAssociatedTokenAddress(
    mint.publicKey,
    buyer.publicKey
  );

  const buyTx = await program.methods
    .buy(solIn, minTok)
    .accounts({
      buyer: buyer.publicKey,
      mint: mint.publicKey,
      bondingCurve: bondingCurvePDA,
      tokenVault,
      buyerTokenAccount: buyerATA,
      treasury: TREASURY_PUBKEY,
      buybackVault,
      creatorVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([buyer])
    .rpc();

  console.log("buy tx:", buyTx);

  const buyerAtaInfo = await getAccount(connection, buyerATA);
  const tokensReceived = new BN(buyerAtaInfo.amount.toString());
  console.log("Tokens received:", tokensReceived.toString());

  const curveAfterBuy = await program.account.bondingCurveState.fetch(bondingCurvePDA);
  console.log("realSolReserves after buy:", curveAfterBuy.realSolReserves.toString());
  console.log("totalTrades after buy:", curveAfterBuy.totalTrades.toString());

  // ── STEP 3: sell ────────────────────────────────────────────────────────────
  console.log("\n--- STEP 3: sell ---");
  const tokSell = tokensReceived.divn(2); // Sell half

  const curveBeforeSell = await program.account.bondingCurveState.fetch(bondingCurvePDA);
  const grossSol = solOut(
    curveBeforeSell.virtualSolReserves,
    curveBeforeSell.virtualTokenReserves,
    tokSell
  );
  const sellFee = grossSol.muln(FEE_BPS).divn(BPS_DENOM);
  const minSol = grossSol.sub(sellFee).muln(95).divn(100);

  const buyerBalBefore = await connection.getBalance(buyer.publicKey);

  const sellTx = await program.methods
    .sell(tokSell, minSol)
    .accounts({
      seller: buyer.publicKey,
      mint: mint.publicKey,
      bondingCurve: bondingCurvePDA,
      tokenVault,
      sellerTokenAccount: buyerATA,
      treasury: TREASURY_PUBKEY,
      buybackVault,
      creatorVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([buyer])
    .rpc();

  console.log("sell tx:", sellTx);

  const buyerBalAfter = await connection.getBalance(buyer.publicKey);
  console.log(
    "Buyer SOL change:",
    (buyerBalAfter - buyerBalBefore) / LAMPORTS_PER_SOL,
    "SOL"
  );

  const curveAfterSell = await program.account.bondingCurveState.fetch(bondingCurvePDA);
  console.log("realSolReserves after sell:", curveAfterSell.realSolReserves.toString());
  console.log("totalTrades after sell:", curveAfterSell.totalTrades.toString());

  // ── STEP 4: withdraw_creator_fees ────────────────────────────────────────────
  console.log("\n--- STEP 4: withdraw_creator_fees ---");
  const cvBalance = await connection.getBalance(creatorVault);
  console.log("creatorVault balance before:", cvBalance, "lamports");

  const withdrawTx = await program.methods
    .withdrawCreatorFees()
    .accounts({
      creator: creator.publicKey,
      mint: mint.publicKey,
      bondingCurve: bondingCurvePDA,
      creatorVault,
      systemProgram: SystemProgram.programId,
    })
    .signers([creator])
    .rpc();

  console.log("withdraw_creator_fees tx:", withdrawTx);

  const cvBalanceAfter = await connection.getBalance(creatorVault);
  console.log("creatorVault balance after:", cvBalanceAfter, "lamports");

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log("\n=== REHEARSAL SUMMARY ===");
  console.log("Mint:", mint.publicKey.toBase58());
  console.log("bondingCurvePDA:", bondingCurvePDA.toBase58());
  console.log("create_token tx:", createTx);
  console.log("buy tx:", buyTx);
  console.log("sell tx:", sellTx);
  console.log("withdraw_creator_fees tx:", withdrawTx);
  console.log("\nAll steps completed successfully!");

  // Output mint for Phase 7
  const outputPath = path.join(__dirname, "rehearsal-output.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        mint: mint.publicKey.toBase58(),
        bondingCurvePDA: bondingCurvePDA.toBase58(),
        creator: creator.publicKey.toBase58(),
        buyer: buyer.publicKey.toBase58(),
        txs: {
          createToken: createTx,
          buy: buyTx,
          sell: sellTx,
          withdrawCreatorFees: withdrawTx,
        },
      },
      null,
      2
    )
  );
  console.log("\nOutput written to:", outputPath);
}

main().catch((err) => {
  console.error("REHEARSAL FAILED:", err);
  process.exit(1);
});
