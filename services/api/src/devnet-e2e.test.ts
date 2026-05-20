import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { createDexPool, getRaydiumPoolAccounts } from "./migration-adapters.js";

const { AnchorProvider, BN, Program } = anchor;
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const POOL_BOOTSTRAP_TOKEN_AMOUNT = BigInt(process.env.MIGRATION_BOOTSTRAP_TOKEN_AMOUNT ?? "1000000");
const POOL_BOOTSTRAP_SOL_LAMPORTS = BigInt(process.env.MIGRATION_BOOTSTRAP_SOL_LAMPORTS ?? "1000000");

type NodeWallet = {
  payer: Keypair;
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
};

function readKeypair(path: string) {
  const secret = JSON.parse(fs.readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function lamportsToSol(lamports: number | bigint): number {
  const value = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return value / 1_000_000_000;
}

function createNodeWallet(payer: Keypair): NodeWallet {
  return {
    payer,
    publicKey: payer.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T) {
      if ("partialSign" in transaction && typeof transaction.partialSign === "function") {
        transaction.partialSign(payer);
      }
      return transaction;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]) {
      return Promise.all(transactions.map((transaction) => this.signTransaction(transaction)));
    }
  };
}

function getLaunchPda(mint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("launch"), mint.toBytes()], programId)[0];
}

function getMigrationStatusPda(mint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("migration"), mint.toBytes()], programId)[0];
}

function getLiquidityLockPda(mint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("lp-lock"), mint.toBytes()], programId)[0];
}

function getMigrationEscrowPda(mint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("migration-escrow"), mint.toBytes()],
    programId
  )[0];
}

function getMigrationSolVaultPda(mint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("migration-sol"), mint.toBytes()],
    programId
  )[0];
}

function getTraderPositionPda(launch: PublicKey, trader: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("position"), launch.toBytes(), trader.toBytes()],
    programId
  )[0];
}

function normalizeMigrationState(state: unknown) {
  if (typeof state === "string") {
    return state.toLowerCase();
  }

  if (state && typeof state === "object") {
    if ("active" in state) return "active";
    if ("pending" in state) return "pending";
    if ("migrating" in state) return "migrating";
    if ("migrated" in state) return "migrated";
    if ("failed" in state) return "failed";
  }

  return "unknown";
}

function normalizeIdlForAnchorAccounts(idl: Idl): Idl {
  const cloned = JSON.parse(JSON.stringify(idl)) as Idl;
  if (!("accounts" in cloned) || !Array.isArray((cloned as any).accounts)) {
    return cloned;
  }

  const typeDefs = ("types" in cloned && Array.isArray((cloned as any).types) ? (cloned as any).types : []) as Array<{
    name: string;
    type: unknown;
  }>;
  const knownTypeNames = new Set(typeDefs.map((entry) => entry.name));

  for (const account of (cloned as any).accounts as Array<{ name: string }>) {
    if (!account?.name || knownTypeNames.has(account.name)) {
      continue;
    }
    const fallbackTypeName = `${account.name}Data`;
    const fallbackType = typeDefs.find((entry) => entry.name === fallbackTypeName);
    if (!fallbackType) {
      continue;
    }

    typeDefs.push({
      name: account.name,
      type: fallbackType.type
    });
    knownTypeNames.add(account.name);
  }

  (cloned as any).types = typeDefs;
  return cloned;
}

async function waitForSlotDelta(connection: Connection, delta: number) {
  const start = await connection.getSlot("confirmed");
  const target = start + delta;
  for (let i = 0; i < 120; i += 1) {
    const current = await connection.getSlot("confirmed");
    if (current >= target) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${delta} slots to pass`);
}

async function fundWallet(
  connection: Connection,
  from: Keypair,
  to: PublicKey,
  lamports: number
) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: from.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight
  }).add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports
    })
  );
  await sendAndConfirmTransaction(connection, transaction, [from], {
    commitment: "confirmed"
  });
}

test(
  "devnet integration: launch -> buy -> sell -> migrate -> finalize with strict validation",
  { timeout: 12 * 60 * 1000 },
  async (t) => {
    if (process.env.RUN_DEVNET_E2E !== "true") {
      t.skip("Set RUN_DEVNET_E2E=true to run live devnet integration flow.");
      return;
    }

    const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!rpcUrl || !rpcUrl.includes("devnet")) {
      assert.fail("SOLANA_RPC_URL/NEXT_PUBLIC_SOLANA_RPC_URL must target devnet for release-gated E2E.");
    }

    const keypairPath = process.env.SOLANA_KEYPAIR_PATH;
    if (!keypairPath) {
      assert.fail("SOLANA_KEYPAIR_PATH is required for release-gated devnet integration test.");
    }

    const idlPath = fileURLToPath(new URL("../../../apps/web/lib/idl/launchpad.json", import.meta.url));
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as Idl;
    const normalizedIdl = normalizeIdlForAnchorAccounts(idl);
    const programId = new PublicKey(process.env.NEXT_PUBLIC_LAUNCHPAD_PROGRAM_ID ?? idl.address);
    const connection = new Connection(rpcUrl, "confirmed");

    const creator = readKeypair(keypairPath);
    const treasury = Keypair.generate();
    const trader = Keypair.generate();

    const requiredMinLamports = 4_000_000_000;
    const skipAirdrop = process.env.SKIP_AIRDROP === "true";
    const creatorBalance = await connection.getBalance(creator.publicKey, "confirmed");
    console.info(
      `[devnet-e2e] creator starting balance: ${lamportsToSol(creatorBalance).toFixed(6)} SOL (min required: ${lamportsToSol(requiredMinLamports).toFixed(6)} SOL)`
    );

    if (creatorBalance < requiredMinLamports) {
      if (skipAirdrop) {
        assert.fail(
          `SKIP_AIRDROP=true but creator wallet balance is insufficient. Current: ${lamportsToSol(creatorBalance).toFixed(6)} SOL, required minimum: ${lamportsToSol(requiredMinLamports).toFixed(6)} SOL.`
        );
      }

      try {
        const sig = await connection.requestAirdrop(creator.publicKey, 5_000_000_000);
        const latest = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction(
          {
            signature: sig,
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight
          },
          "confirmed"
        );
        const postAirdropBalance = await connection.getBalance(creator.publicKey, "confirmed");
        console.info(
          `[devnet-e2e] faucet used. balance after airdrop: ${lamportsToSol(postAirdropBalance).toFixed(6)} SOL`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const nestedMessage =
          typeof error === "object" && error !== null && "cause" in error
            ? String((error as { cause?: unknown }).cause ?? "")
            : "";
        const combined = `${message} ${nestedMessage}`;

        if (
          combined.includes("429") ||
          combined.toLowerCase().includes("too many requests") ||
          combined.toLowerCase().includes("airdrop limit") ||
          combined.toLowerCase().includes("faucet")
        ) {
          assert.fail(
            `Devnet faucet rate limited (429). This is an environment/funding issue, not a protocol failure. Current balance: ${lamportsToSol(creatorBalance).toFixed(6)} SOL, required minimum: ${lamportsToSol(requiredMinLamports).toFixed(6)} SOL. Fund wallet manually or retry later.`
          );
        }
        if (combined.toLowerCase().includes("fetch failed")) {
          assert.fail(
            `Devnet faucet/network request failed while funding the test wallet. This is an environment issue, not a protocol failure. Current balance: ${lamportsToSol(creatorBalance).toFixed(6)} SOL, required minimum: ${lamportsToSol(requiredMinLamports).toFixed(6)} SOL.`
          );
        }
        throw error;
      }
    } else {
      console.info("[devnet-e2e] faucet skipped: creator wallet already has sufficient balance.");
    }

    await fundWallet(connection, creator, treasury.publicKey, 1_000_000_000);
    await fundWallet(connection, creator, trader.publicKey, 2_000_000_000);

    const creatorProvider = new AnchorProvider(
      connection,
      createNodeWallet(creator) as never,
      AnchorProvider.defaultOptions()
    );
    const treasuryProvider = new AnchorProvider(
      connection,
      createNodeWallet(treasury) as never,
      AnchorProvider.defaultOptions()
    );
    const traderProvider = new AnchorProvider(
      connection,
      createNodeWallet(trader) as never,
      AnchorProvider.defaultOptions()
    );

    const creatorProgram = new Program(normalizedIdl, creatorProvider);
    const treasuryProgram = new Program(normalizedIdl, treasuryProvider);
    const traderProgram = new Program(normalizedIdl, traderProvider);

    const mint = Keypair.generate();
    const launchState = getLaunchPda(mint.publicKey, programId);
    const migrationStatus = getMigrationStatusPda(mint.publicKey, programId);
    const liquidityLock = getLiquidityLockPda(mint.publicKey, programId);
    const migrationEscrow = getMigrationEscrowPda(mint.publicKey, programId);
    const migrationSolVault = getMigrationSolVaultPda(mint.publicKey, programId);
    const mintRent = await getMinimumBalanceForRentExemptMint(connection);

    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: creator.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: mintRent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID
      }),
      createInitializeMint2Instruction(mint.publicKey, 6, launchState, null, TOKEN_PROGRAM_ID)
    );
    await sendAndConfirmTransaction(connection, createMintTx, [creator, mint], {
      commitment: "confirmed"
    });

    await creatorProgram.methods
      .initializeLaunch({
        mint: mint.publicKey,
        name: "JetForge E2E",
        symbol: "JF2E",
        uri: "https://jetforge.io/token/jf2e",
        config: {
          basePriceLamports: new BN(30),
          slopeLamports: new BN(260),
          graduationReserveSol: new BN(10),
          antiBot: {
            maxBuyLamportsFirstWindow: new BN(3_000_000_000),
            walletCooldownSlots: new BN(5),
            maxWalletBps: 500
          }
        }
      })
      .accounts({
        creator: creator.publicKey,
        treasury: treasury.publicKey,
        launchState,
        migrationStatus,
        migrationEscrow,
        migrationSolVault,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const treasuryPosition = getTraderPositionPda(launchState, treasury.publicKey, programId);
    const treasuryTokenAccount = getAssociatedTokenAddressSync(mint.publicKey, treasury.publicKey);
    await treasuryProgram.methods
      .buy(new BN(50_000_000), new BN(1), new BN(60_000_000))
      .accounts({
        buyer: treasury.publicKey,
        launchState,
        treasury: treasury.publicKey,
        creator: creator.publicKey,
        mint: mint.publicKey,
        migrationStatus,
        buyerPosition: treasuryPosition,
        buyerTokenAccount: treasuryTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const traderPosition = getTraderPositionPda(launchState, trader.publicKey, programId);
    const traderTokenAccount = getAssociatedTokenAddressSync(mint.publicKey, trader.publicKey);

    await traderProgram.methods
      .buy(new BN(400_000_000), new BN(1), new BN(420_000_000))
      .accounts({
        buyer: trader.publicKey,
        launchState,
        treasury: treasury.publicKey,
        creator: creator.publicKey,
        mint: mint.publicKey,
        migrationStatus,
        buyerPosition: traderPosition,
        buyerTokenAccount: traderTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    await waitForSlotDelta(connection, 6);
    const traderPositionAfterBuy = await (traderProgram.account as any).traderPosition.fetch(traderPosition);
    const sellAmount = new BN(
      Math.max(1, Math.floor(Number(traderPositionAfterBuy.tokenBalance.toString()) / 10))
    );
    await traderProgram.methods
      .sell(sellAmount, new BN(0))
      .accounts({
        seller: trader.publicKey,
        launchState,
        treasury: treasury.publicKey,
        creator: creator.publicKey,
        mint: mint.publicKey,
        sellerPosition: traderPosition,
        sellerTokenAccount: traderTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .rpc();

    for (let i = 0; i < 8; i += 1) {
      const state = await (traderProgram.account as any).launchState.fetch(launchState);
      if (normalizeMigrationState(state.migrationState) === "pending") {
        break;
      }

      await waitForSlotDelta(connection, 6);
      try {
        await traderProgram.methods
          .buy(new BN(400_000_000), new BN(1), new BN(430_000_000))
          .accounts({
            buyer: trader.publicKey,
            launchState,
            treasury: treasury.publicKey,
            creator: creator.publicKey,
            mint: mint.publicKey,
            migrationStatus,
            buyerPosition: traderPosition,
            buyerTokenAccount: traderTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId
          })
          .rpc();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("TradingPausedForMigration")) {
          break;
        }
        throw error;
      }
    }

    const pendingState = await (treasuryProgram.account as any).launchState.fetch(launchState);
    assert.equal(normalizeMigrationState(pendingState.migrationState), "pending");

    const escrowLaunchTokenVault = getAssociatedTokenAddressSync(mint.publicKey, migrationEscrow, true);
    const escrowWsolVault = getAssociatedTokenAddressSync(WSOL_MINT, migrationEscrow, true);
    const ensureEscrowAtaInstructions = [];
    if (!(await connection.getAccountInfo(escrowLaunchTokenVault, "confirmed"))) {
      ensureEscrowAtaInstructions.push(
        createAssociatedTokenAccountInstruction(
          treasury.publicKey,
          escrowLaunchTokenVault,
          migrationEscrow,
          mint.publicKey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    if (!(await connection.getAccountInfo(escrowWsolVault, "confirmed"))) {
      ensureEscrowAtaInstructions.push(
        createAssociatedTokenAccountInstruction(
          treasury.publicKey,
          escrowWsolVault,
          migrationEscrow,
          WSOL_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    if (ensureEscrowAtaInstructions.length > 0) {
      const ensureEscrowAtaTx = new Transaction().add(...ensureEscrowAtaInstructions);
      await sendAndConfirmTransaction(connection, ensureEscrowAtaTx, [treasury], {
        commitment: "confirmed"
      });
    }

    await treasuryProgram.methods
      .migrate({
        executionCostLamports: new BN(100_000_000),
        dex: { raydium: {} }
      })
      .accounts({
        launchState,
        treasury: treasury.publicKey,
        creatorWallet: creator.publicKey,
        mint: mint.publicKey,
        migrationStatus,
        migrationEscrow,
        migrationSolVault,
        escrowLaunchTokenVault,
        wsolMint: WSOL_MINT,
        escrowWsolVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    let migration = await (treasuryProgram.account as any).migrationStatus.fetch(migrationStatus);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (normalizeMigrationState(migration.state) === "migrating") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      migration = await (treasuryProgram.account as any).migrationStatus.fetch(migrationStatus);
    }
    assert.equal(normalizeMigrationState(migration.state), "migrating");
    const preparedTokens = BigInt(migration.preparedLiquidityTokens.toString());
    const preparedLamports = BigInt(migration.preparedLiquidityLamports.toString());
    assert.ok(preparedTokens > 0n);
    assert.ok(preparedLamports > 0n);

    const poolResult = await createDexPool({
      connection,
      owner: treasury,
      dex: "raydium",
      mint: mint.publicKey,
      tokenAmount: POOL_BOOTSTRAP_TOKEN_AMOUNT,
      solAmountLamports: POOL_BOOTSTRAP_SOL_LAMPORTS
    });
    const poolAccounts = await getRaydiumPoolAccounts({
      connection,
      pool: poolResult.pool
    });
    const launchVaultAddress = poolAccounts.mintA.equals(mint.publicKey)
      ? poolAccounts.vaultA
      : poolAccounts.vaultB;
    const wsolVaultAddress = poolAccounts.mintA.equals(WSOL_MINT)
      ? poolAccounts.vaultA
      : poolAccounts.vaultB;

    const treasuryLpTokenAccount = getAssociatedTokenAddressSync(
      poolResult.lpMint,
      treasury.publicKey,
      false,
      poolAccounts.lpTokenProgramId
    );
    const lpBalance = await connection.getTokenAccountBalance(treasuryLpTokenAccount, "confirmed");
    const lpAmount = BigInt(lpBalance.value.amount);
    assert.ok(lpAmount > 0n);

    const lockedLpTokenVault = getAssociatedTokenAddressSync(
      poolResult.lpMint,
      liquidityLock,
      true,
      poolAccounts.lpTokenProgramId
    );
    const escrowLpTokenVault = getAssociatedTokenAddressSync(
      poolResult.lpMint,
      migrationEscrow,
      true,
      poolAccounts.lpTokenProgramId
    );
    console.log(
      `[devnet-e2e] pool=${poolResult.pool.toBase58()} sdkLpMint=${poolResult.lpMint.toBase58()} decodedLpMint=${poolAccounts.lpMint.toBase58()} lpTokenProgram=${poolAccounts.lpTokenProgramId.toBase58()} treasuryLpAta=${treasuryLpTokenAccount.toBase58()} lockedLpAta=${lockedLpTokenVault.toBase58()}`
    );
    const lockLiquidityBuilder = treasuryProgram.methods
      .lockLiquidity(poolResult.pool, new BN(lpAmount.toString()))
      .accounts({
        launchState,
        treasury: treasury.publicKey,
        migrationStatus,
        liquidityLock,
        lpMint: poolResult.lpMint,
        treasuryLpTokenAccount,
        lockedLpTokenVault,
        lpTokenProgram: poolAccounts.lpTokenProgramId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      });
    try {
      await lockLiquidityBuilder.simulate();
    } catch (error) {
      const simulationLogs =
        error && typeof error === "object" && "logs" in error ? (error as { logs?: unknown }).logs : undefined;
      console.log("[devnet-e2e] lockLiquidity simulation logs:", simulationLogs);
      throw error;
    }
    await lockLiquidityBuilder.rpc();
    let lockState: any | null = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        lockState = await (treasuryProgram.account as any).liquidityLock.fetch(liquidityLock);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    assert.ok(lockState, "Liquidity lock account was not initialized on-chain");
    assert.ok(BigInt(lockState.lockedAmount.toString()) > 0n);
    assert.ok(Number(lockState.unlockAt.toString()) > Number(lockState.lockedAt.toString()));
    const authorityAddress = poolAccounts.authority;
    const observationAddress = poolAccounts.observationId;

    await assert.rejects(async () => {
      await treasuryProgram.methods
        .finalizeMigration({
          dex: { raydium: {} },
          pool: poolResult.pool,
          lpMint: poolResult.lpMint
        })
        .remainingAccounts([
          { pubkey: poolResult.pool, isWritable: true, isSigner: false },
          { pubkey: poolResult.lpMint, isWritable: true, isSigner: false },
          { pubkey: poolAccounts.mintA, isWritable: false, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: false, isSigner: false },
          { pubkey: poolAccounts.dexProgramId, isWritable: false, isSigner: false },
          {
            pubkey: poolAccounts.vaultA,
            isWritable: true,
            isSigner: false
          },
          {
            pubkey: poolAccounts.vaultB,
            isWritable: true,
            isSigner: false
          },
          { pubkey: authorityAddress, isWritable: false, isSigner: false },
          { pubkey: Keypair.generate().publicKey, isWritable: false, isSigner: false }
        ])
        .accounts({
          launchState,
          treasury: treasury.publicKey,
          mint: mint.publicKey,
          migrationStatus,
          liquidityLock,
          migrationEscrow,
          migrationSolVault,
          escrowLaunchTokenVault,
          wsolMint: WSOL_MINT,
          escrowWsolVault,
          escrowLpTokenVault,
          lockedLpTokenVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .rpc();
    });

    await assert.rejects(async () => {
      await treasuryProgram.methods
        .finalizeMigration({
          dex: { raydium: {} },
          pool: poolResult.pool,
          lpMint: poolResult.lpMint
        })
        .remainingAccounts([
          { pubkey: poolResult.pool, isWritable: true, isSigner: false },
          { pubkey: poolResult.lpMint, isWritable: true, isSigner: false },
          { pubkey: poolAccounts.mintA, isWritable: false, isSigner: false },
          { pubkey: poolAccounts.mintB, isWritable: false, isSigner: false },
          { pubkey: poolAccounts.dexProgramId, isWritable: false, isSigner: false },
          {
            pubkey: poolAccounts.vaultA,
            isWritable: true,
            isSigner: false
          },
          {
            pubkey: poolAccounts.vaultB,
            isWritable: true,
            isSigner: false
          }
          ,
          { pubkey: authorityAddress, isWritable: false, isSigner: false },
          { pubkey: observationAddress, isWritable: false, isSigner: false }
        ])
        .accounts({
          launchState,
          treasury: treasury.publicKey,
          mint: mint.publicKey,
          migrationStatus,
          liquidityLock,
          migrationEscrow,
          migrationSolVault,
          escrowLaunchTokenVault,
          wsolMint: WSOL_MINT,
          escrowWsolVault,
          escrowLpTokenVault,
          lockedLpTokenVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .rpc();
    });
    const preLaunchVaultBalance = BigInt((await connection.getTokenAccountBalance(launchVaultAddress, "confirmed")).value.amount);
    const preWsolVaultBalance = BigInt((await connection.getTokenAccountBalance(wsolVaultAddress, "confirmed")).value.amount);
    const preEscrowLaunchBalance = BigInt(
      (await connection.getTokenAccountBalance(escrowLaunchTokenVault, "confirmed")).value.amount
    );
    const preEscrowWsolBalance = BigInt(
      (await connection.getTokenAccountBalance(escrowWsolVault, "confirmed")).value.amount
    );

    const finalizeBuilder = treasuryProgram.methods
      .finalizeMigration({
        dex: { raydium: {} },
        pool: poolResult.pool,
        lpMint: poolResult.lpMint
      })
      .remainingAccounts([
        { pubkey: poolResult.pool, isWritable: true, isSigner: false },
        { pubkey: poolResult.lpMint, isWritable: true, isSigner: false },
        { pubkey: poolAccounts.mintA, isWritable: false, isSigner: false },
        { pubkey: poolAccounts.mintB, isWritable: false, isSigner: false },
        { pubkey: poolAccounts.dexProgramId, isWritable: false, isSigner: false },
        {
          pubkey: poolAccounts.vaultA,
          isWritable: true,
          isSigner: false
        },
        {
          pubkey: poolAccounts.vaultB,
          isWritable: true,
          isSigner: false
        },
        { pubkey: authorityAddress, isWritable: false, isSigner: false },
        { pubkey: observationAddress, isWritable: true, isSigner: false }
      ])
      .accounts({
        launchState,
        treasury: treasury.publicKey,
        mint: mint.publicKey,
        migrationStatus,
        liquidityLock,
        migrationEscrow,
        migrationSolVault,
        escrowLaunchTokenVault,
        wsolMint: WSOL_MINT,
        escrowWsolVault,
        escrowLpTokenVault,
        lockedLpTokenVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      });
    try {
      await finalizeBuilder.simulate();
    } catch (error) {
      const simulationLogs =
        error && typeof error === "object" && "logs" in error ? (error as { logs?: unknown }).logs : undefined;
      console.log("[devnet-e2e] finalizeMigration simulation logs:", simulationLogs);
      console.dir(error, { depth: 6 });
      throw error;
    }
    await finalizeBuilder.rpc();
    const postLaunchVaultBalance = BigInt((await connection.getTokenAccountBalance(launchVaultAddress, "confirmed")).value.amount);
    const postWsolVaultBalance = BigInt((await connection.getTokenAccountBalance(wsolVaultAddress, "confirmed")).value.amount);
    const postEscrowLaunchBalance = BigInt(
      (await connection.getTokenAccountBalance(escrowLaunchTokenVault, "confirmed")).value.amount
    );
    const postEscrowWsolBalance = BigInt(
      (await connection.getTokenAccountBalance(escrowWsolVault, "confirmed")).value.amount
    );

    const finalState = await (treasuryProgram.account as any).launchState.fetch(launchState);
    const finalMigration = await (treasuryProgram.account as any).migrationStatus.fetch(migrationStatus);
    const finalEscrow = await (treasuryProgram.account as any).migrationEscrow.fetch(migrationEscrow);
    assert.equal(normalizeMigrationState(finalState.migrationState), "migrated");
    assert.equal(normalizeMigrationState(finalMigration.state), "migrated");
    assert.equal(finalMigration.pool.toBase58(), poolResult.pool.toBase58());
    assert.equal(finalMigration.lpMint.toBase58(), poolResult.lpMint.toBase58());
    assert.ok(BigInt(finalMigration.lpLockedAmount.toString()) > 0n);
    assert.ok(Number(finalMigration.lpUnlockAt.toString()) > Number(finalMigration.lpLockedAt.toString()));
    assert.equal(BigInt(finalState.reserveLamports.toString()), 0n);
    assert.ok(BigInt(finalState.migrationCreatorRewardLamports.toString()) > 0n);
    assert.ok(BigInt(finalState.migrationTreasuryRewardLamports.toString()) > 0n);
    assert.equal(postLaunchVaultBalance - preLaunchVaultBalance, preparedTokens);
    assert.equal(postWsolVaultBalance - preWsolVaultBalance, preparedLamports);
    assert.equal(preEscrowLaunchBalance - postEscrowLaunchBalance, preparedTokens);
    assert.equal(preEscrowWsolBalance - postEscrowWsolBalance, preparedLamports);
    assert.equal(BigInt(finalEscrow.preparedLiquidityTokens.toString()), 0n);
    assert.equal(BigInt(finalEscrow.preparedLiquidityLamports.toString()), 0n);
    assert.equal(Boolean(finalEscrow.settled), true);
  }
);
