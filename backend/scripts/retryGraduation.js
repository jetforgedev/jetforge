/**
 * retryGraduation.js — fully self-contained, no dist imports
 *
 * Recovers a token whose on-chain graduate instruction never ran
 * (DB shows isGraduated=true but real_sol_reserves > 0 on-chain).
 *
 * Usage (from /var/www/jetforge/backend):
 *   node scripts/retryGraduation.js <MINT_ADDRESS>
 */

require("dotenv").config();

const {
  Connection, Keypair, PublicKey, Transaction,
  TransactionInstruction, SystemProgram, sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} = require("@solana/spl-token");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PROGRAM_ID    = new PublicKey(process.env.PROGRAM_ID    || "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk");
const TREASURY_ADDR = new PublicKey(process.env.TREASURY_ADDRESS || "13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW");
const RPC_URL       = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

// Anchor discriminator: sha256("global:graduate")[0..8]
const GRADUATE_DISCRIMINATOR = Buffer.from([45, 235, 225, 181, 17, 218, 64, 130]);

function getTreasuryKeypair() {
  const raw = process.env.TREASURY_PRIVATE_KEY;
  if (!raw) throw new Error("TREASURY_PRIVATE_KEY not set in .env");
  let cleaned = raw.trim().replace(/^"|"$/g, "");
  if (!cleaned.startsWith("[")) cleaned = `[${cleaned}]`;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(cleaned)));
}

function getPDA(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

async function fetchCreatorFromChain(connection, bondingCurvePDA) {
  const info = await connection.getAccountInfo(bondingCurvePDA);
  if (!info || info.data.length < 72) return null;
  return new PublicKey(info.data.slice(40, 72));
}

async function main() {
  const mintStr = process.argv[2];
  if (!mintStr) {
    console.error("Usage: node scripts/retryGraduation.js <MINT_ADDRESS>");
    process.exit(1);
  }

  console.log(`\n=== Retry graduation for ${mintStr.slice(0, 8)}… ===\n`);

  const connection      = new Connection(RPC_URL, "confirmed");
  const mint            = new PublicKey(mintStr);
  const [bondingCurve, bcBump] = getPDA([Buffer.from("bonding_curve"), mint.toBuffer()]);
  const [reserveVault]         = getPDA([Buffer.from("reserve_vault"),  mint.toBuffer()]);

  // ── 1. Read on-chain state ────────────────────────────────────────────────
  const bcInfo = await connection.getAccountInfo(bondingCurve);
  if (!bcInfo) { console.error("Bonding curve not found on-chain."); process.exit(1); }

  const realSolReserves   = bcInfo.data.readBigUInt64LE(88);
  const realTokenReserves = bcInfo.data.readBigUInt64LE(96);
  const complete          = bcInfo.data[112] === 1;

  console.log(`  complete          = ${complete}`);
  console.log(`  real_sol_reserves = ${realSolReserves} (${Number(realSolReserves) / 1e9} SOL)`);
  console.log(`  real_tok_reserves = ${realTokenReserves} (${Number(realTokenReserves) / 1e6} tokens)`);

  if (!complete) { console.error("Curve not complete — cannot graduate."); process.exit(1); }

  if (realSolReserves === 0n) {
    console.log("\nGraduate already ran on-chain (realSol=0).");
    const row = await prisma.token.findUnique({ where: { mint: mintStr }, select: { raydiumPoolId: true } });
    console.log(row?.raydiumPoolId ? `Pool stored: ${row.raydiumPoolId}` : "Pool not yet stored — check pm2 logs");
    await prisma.$disconnect();
    return;
  }

  // ── 2. Build & send graduate instruction ─────────────────────────────────
  const treasuryKeypair = getTreasuryKeypair();
  const tokenVault      = (await PublicKey.findProgramAddressSync(
    [TREASURY_ADDR.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  ))[0]; // ATA formula — we use getOrCreate below to be safe

  const creator = await fetchCreatorFromChain(connection, bondingCurve);
  if (!creator) { console.error("Could not fetch creator from chain."); process.exit(1); }
  console.log(`\n  creator = ${creator.toBase58().slice(0, 8)}…`);

  // Ensure treasury token ATA exists
  const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection, treasuryKeypair, mint, TREASURY_ADDR
  );
  console.log(`  treasury token ATA = ${treasuryTokenAccount.address.toBase58().slice(0, 8)}…`);

  // Ephemeral payer (avoids lamport conservation conflict when caller == treasury)
  const callerKeypair = Keypair.generate();
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasuryKeypair.publicKey,
      toPubkey: callerKeypair.publicKey,
      lamports: 10_000_000, // 0.01 SOL for fees
    })
  );
  await sendAndConfirmTransaction(connection, fundTx, [treasuryKeypair], { commitment: "confirmed" });
  console.log(`  ephemeral caller = ${callerKeypair.publicKey.toBase58().slice(0, 8)}…`);

  // Token vault ATA of bonding curve
  const bondingCurveTokenVault = (PublicKey.findProgramAddressSync(
    [bondingCurve.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  ))[0];

  const keys = [
    { pubkey: callerKeypair.publicKey,              isSigner: true,  isWritable: true  },
    { pubkey: mint,                                 isSigner: false, isWritable: true  },
    { pubkey: bondingCurve,                         isSigner: false, isWritable: true  },
    { pubkey: bondingCurveTokenVault,               isSigner: false, isWritable: true  },
    { pubkey: reserveVault,                         isSigner: false, isWritable: true  },
    { pubkey: TREASURY_ADDR,                        isSigner: false, isWritable: true  },
    { pubkey: treasuryTokenAccount.address,         isSigner: false, isWritable: true  },
    { pubkey: creator,                              isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID,                     isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,          isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId,              isSigner: false, isWritable: false },
  ];

  const graduateTx = new Transaction().add(
    new TransactionInstruction({ programId: PROGRAM_ID, keys, data: GRADUATE_DISCRIMINATOR })
  );

  console.log("\nSending graduate instruction...");
  const sig = await sendAndConfirmTransaction(connection, graduateTx, [callerKeypair], {
    commitment: "confirmed",
    skipPreflight: true,
  });
  console.log(`✅ Graduate tx confirmed: ${sig}`);

  // ── 3. Read post-graduation amounts for pool creation ─────────────────────
  // The GraduationEvent carries liquiditySol and liquidityTokens.
  // Compute them from what we read before (90% of realSolReserves, all reserve tokens).
  const GRADUATION_TREASURY_BPS = 500n;
  const GRADUATION_CREATOR_BPS  = 500n;
  const BPS_DENOMINATOR         = 10_000n;
  const treasuryCut  = realSolReserves * GRADUATION_TREASURY_BPS / BPS_DENOMINATOR;
  const creatorBonus = realSolReserves * GRADUATION_CREATOR_BPS  / BPS_DENOMINATOR;
  const liquiditySol = realSolReserves - treasuryCut - creatorBonus;
  const liquidityTokens = realTokenReserves;

  console.log(`\n  liquiditySol    = ${liquiditySol} (${Number(liquiditySol) / 1e9} SOL)`);
  console.log(`  liquidityTokens = ${liquidityTokens} (${Number(liquidityTokens) / 1e6} tokens)`);

  // ── 4. Create Raydium pool ─────────────────────────────────────────────────
  console.log("\nCreating Raydium pool...");
  const { Raydium, TxVersion, DEVNET_PROGRAM_ID, MAINNET_PROGRAM_ID } = require("@raydium-io/raydium-sdk-v2");
  const BN = require("bn.js");
  const { createTransferInstruction } = require("@solana/spl-token");

  const isDevnet    = RPC_URL.includes("devnet");
  const cluster     = isDevnet ? "devnet" : "mainnet";
  const CLUSTER_PID = isDevnet ? DEVNET_PROGRAM_ID : MAINNET_PROGRAM_ID;
  const WSOL_MINT   = "So11111111111111111111111111111111111111112";
  const TOKEN_PROG  = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const INCINERATOR = new PublicKey("1nc1nerator11111111111111111111111111111111");

  const raydium = await Raydium.load({
    connection, owner: treasuryKeypair, cluster, disableFeatureCheck: true, blockhashCommitment: "finalized",
  });

  // Ensure WSOL ATA exists
  await getOrCreateAssociatedTokenAccount(connection, treasuryKeypair, new PublicKey(WSOL_MINT), treasuryKeypair.publicKey);
  console.log("  WSOL ATA ensured");

  const ammConfigs = await raydium.api.getCpmmConfigs();
  if (!ammConfigs?.length) throw new Error("No CPMM configs from Raydium on " + cluster);
  const feeConfig = ammConfigs[0];
  console.log(`  fee config: createFee=${Number(feeConfig.createPoolFee) / 1e9} SOL`);

  const wsolPub  = new PublicKey(WSOL_MINT);
  const wsolFirst = Buffer.compare(wsolPub.toBuffer(), mint.toBuffer()) < 0;
  const mintA = { address: wsolFirst ? WSOL_MINT : mintStr, decimals: wsolFirst ? 9 : 6, programId: TOKEN_PROG };
  const mintB = { address: wsolFirst ? mintStr : WSOL_MINT, decimals: wsolFirst ? 6 : 9, programId: TOKEN_PROG };
  const mintAAmount = new BN(wsolFirst ? liquiditySol.toString() : liquidityTokens.toString());
  const mintBAmount = new BN(wsolFirst ? liquidityTokens.toString() : liquiditySol.toString());

  const { execute, extInfo } = await raydium.cpmm.createPool({
    programId: CLUSTER_PID.CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: CLUSTER_PID.CREATE_CPMM_POOL_FEE_ACC,
    mintA, mintB, mintAAmount, mintBAmount,
    startTime: new BN(0), feeConfig,
    associatedOnly: false, ownerInfo: { useSOLBalance: true }, txVersion: TxVersion.LEGACY,
  });

  const poolId  = extInfo.address.poolId.toBase58();
  const lpMint  = extInfo.address.lpMint;
  console.log(`  expected Pool ID: ${poolId}`);

  try {
    const { txId } = await Promise.race([
      execute({ sendAndConfirm: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("execute() timed out")), 120_000)),
    ]);
    console.log(`✅ Pool created! Tx: ${Array.isArray(txId) ? txId[0] : txId}`);
  } catch (execErr) {
    console.warn(`  execute() threw — verifying pool on-chain: ${execErr.message?.slice(0, 80)}`);
    const info = await connection.getAccountInfo(new PublicKey(poolId)).catch(() => null);
    if (!info) throw execErr;
    console.log("  Pool confirmed on-chain despite execute() error — proceeding");
  }

  // Burn LP tokens → incinerator
  try {
    const { getOrCreateAssociatedTokenAccount: gtaa, createTransferInstruction: cti } = require("@solana/spl-token");
    const lpMintPub = new PublicKey(lpMint);
    const treasuryLpAta = await gtaa(connection, treasuryKeypair, lpMintPub, treasuryKeypair.publicKey);
    if (treasuryLpAta.amount > 0n) {
      const incLpAta = await gtaa(connection, treasuryKeypair, lpMintPub, INCINERATOR, true, "confirmed", undefined, TOKEN_PROGRAM_ID);
      const burnTx = new Transaction().add(
        cti(treasuryLpAta.address, incLpAta.address, treasuryKeypair.publicKey, treasuryLpAta.amount, [], TOKEN_PROGRAM_ID)
      );
      await sendAndConfirmTransaction(connection, burnTx, [treasuryKeypair]);
      console.log("  LP tokens burned (sent to incinerator)");
    }
  } catch (e) { console.warn("  LP burn failed (non-fatal):", e.message); }

  // ── 5. Store pool ID in DB ─────────────────────────────────────────────────
  await prisma.token.update({ where: { mint: mintStr }, data: { raydiumPoolId: poolId } });
  console.log(`\n✅ Pool ID stored in DB: ${poolId}`);
  console.log(`   Trade: https://devnet.raydium.io/swap/?inputMint=sol&outputMint=${mintStr}`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error("\nFatal:", e.message || e);
  await prisma.$disconnect();
  process.exit(1);
});
