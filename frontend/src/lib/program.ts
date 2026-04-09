import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

// ─── RPC retry helper ─────────────────────────────────────────────────────────
async function getLatestBlockhashWithRetry(connection: Connection, retries = 3) {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await connection.getLatestBlockhash("confirmed");
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

// ─── Program constants ──────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk"
);

export const TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? "13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW"
);

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// ─── Minimal IDL ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IDL: any = {
  address: "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk",
  version: "0.1.0",
  name: "token_launch",
  instructions: [
    {
      name: "createToken",
      discriminator: [84, 52, 204, 228, 24, 140, 234, 75],
      accounts: [
        { name: "creator", writable: true, signer: true },
        { name: "mint", writable: true, signer: true },
        { name: "bondingCurve", writable: true },
        { name: "tokenVault", writable: true },
        { name: "reserveVault", writable: true },
        { name: "buybackVault", writable: true },
        { name: "creatorVault", writable: true },
        { name: "metadata", writable: true },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
        { name: "tokenMetadataProgram" },
        { name: "systemProgram" },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "uri", type: "string" },
      ],
    },
    {
      name: "buy",
      discriminator: [102, 6, 61, 18, 1, 218, 235, 234],
      accounts: [
        { name: "buyer", writable: true, signer: true },
        { name: "mint" },
        { name: "bondingCurve", writable: true },
        { name: "tokenVault", writable: true },
        { name: "buyerTokenAccount", writable: true },
        { name: "treasury", writable: true },
        { name: "buybackVault", writable: true },
        { name: "creatorVault", writable: true },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
        { name: "systemProgram" },
      ],
      args: [
        { name: "solAmount", type: "u64" },
        { name: "minTokensOut", type: "u64" },
      ],
    },
    {
      name: "sell",
      discriminator: [51, 230, 133, 164, 1, 127, 131, 173],
      accounts: [
        { name: "seller", writable: true, signer: true },
        { name: "mint", writable: true },
        { name: "bondingCurve", writable: true },
        { name: "tokenVault", writable: true },
        { name: "sellerTokenAccount", writable: true },
        { name: "treasury", writable: true },
        { name: "buybackVault", writable: true },
        { name: "creatorVault", writable: true },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
        { name: "systemProgram" },
      ],
      args: [
        { name: "tokenAmount", type: "u64" },
        { name: "minSolOut", type: "u64" },
      ],
    },
    {
      name: "executeBuyback",
      discriminator: [47, 32, 19, 100, 184, 96, 144, 49],
      accounts: [
        { name: "payer", writable: true, signer: true },
        { name: "mint", writable: true },
        { name: "bondingCurve", writable: true },
        { name: "tokenVault", writable: true },
        { name: "buybackVault", writable: true },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
        { name: "systemProgram" },
      ],
      args: [],
    },
    {
      name: "withdrawCreatorFees",
      discriminator: [8, 30, 213, 18, 121, 105, 129, 222],
      accounts: [
        { name: "creator", writable: true, signer: true },
        { name: "mint" },
        { name: "bondingCurve" },
        { name: "creatorVault", writable: true },
        { name: "systemProgram" },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "BondingCurveState",
      discriminator: [182, 185, 75, 193, 72, 40, 132, 153],
    },
  ],
  types: [
    {
      name: "BondingCurveState",
      type: {
        kind: "struct",
        fields: [
          { name: "mint", type: "pubkey" },
          { name: "creator", type: "pubkey" },
          { name: "virtualSolReserves", type: "u64" },
          { name: "virtualTokenReserves", type: "u64" },
          { name: "realSolReserves", type: "u64" },
          { name: "realTokenReserves", type: "u64" },
          { name: "tokenTotalSupply", type: "u64" },
          { name: "complete", type: "bool" },
          { name: "createdAt", type: "i64" },
          { name: "totalVolumeSol", type: "u64" },
          { name: "totalTrades", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  errors: [],
};

// ─── PDA helpers ─────────────────────────────────────────────────────────────

export function getBondingCurvePDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getReserveVaultPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reserve_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getBuybackVaultPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("buyback_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getCreatorVaultPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

export function getTokenVault(mint: PublicKey, bondingCurve: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, bondingCurve, true);
}

export function getBuyerTokenAccount(mint: PublicKey, buyer: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, buyer);
}

// ─── Anchor program factory ───────────────────────────────────────────────────

function getProgram(connection: Connection, wallet: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program(IDL, provider);
}

// ─── Transaction builders ─────────────────────────────────────────────────────

export interface BuyParams {
  connection: Connection;
  wallet: AnchorWallet;
  mintAddress: string;
  creatorAddress: string;
  solAmountLamports: BN;
  minTokensOut: BN;
}

export async function buildBuyTransaction(params: BuyParams): Promise<Transaction> {
  const { connection, wallet, mintAddress, solAmountLamports, minTokensOut } = params;

  const mint = new PublicKey(mintAddress);
  const [bondingCurve] = getBondingCurvePDA(mint);
  const tokenVault = getTokenVault(mint, bondingCurve);
  const buyerTokenAccount = getBuyerTokenAccount(mint, wallet.publicKey);
  const [buybackVault] = getBuybackVaultPDA(mint);
  const [creatorVault] = getCreatorVaultPDA(mint);

  const program = getProgram(connection, wallet);

  const ix = await program.methods
    .buy(solAmountLamports, minTokensOut)
    .accounts({
      buyer: wallet.publicKey,
      mint,
      bondingCurve,
      tokenVault,
      buyerTokenAccount,
      treasury: TREASURY,
      buybackVault,
      creatorVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry(connection);
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;
  return tx;
}

export interface SellParams {
  connection: Connection;
  wallet: AnchorWallet;
  mintAddress: string;
  creatorAddress: string;
  tokenAmountRaw: BN;
  minSolOut: BN;
}

export async function buildSellTransaction(params: SellParams): Promise<Transaction> {
  const { connection, wallet, mintAddress, tokenAmountRaw, minSolOut } = params;

  const mint = new PublicKey(mintAddress);
  const [bondingCurve] = getBondingCurvePDA(mint);
  const tokenVault = getTokenVault(mint, bondingCurve);
  const sellerTokenAccount = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  const [buybackVault] = getBuybackVaultPDA(mint);
  const [creatorVault] = getCreatorVaultPDA(mint);

  const program = getProgram(connection, wallet);

  const ix = await program.methods
    .sell(tokenAmountRaw, minSolOut)
    .accounts({
      seller: wallet.publicKey,
      mint,
      bondingCurve,
      tokenVault,
      sellerTokenAccount,
      treasury: TREASURY,
      buybackVault,
      creatorVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry(connection);
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;
  return tx;
}

export interface CreateTokenParams {
  connection: Connection;
  wallet: AnchorWallet;
  name: string;
  symbol: string;
  uri: string;
  mintKeypair?: Keypair; // optional pre-generated keypair (so mint address is known before tx)
}

export interface CreateTokenResult {
  transaction: Transaction;
  mintKeypair: Keypair;
}

export async function buildCreateTokenTransaction(
  params: CreateTokenParams
): Promise<CreateTokenResult> {
  const { connection, wallet, name, symbol, uri, mintKeypair: providedKeypair } = params;

  const mintKeypair = providedKeypair ?? Keypair.generate();
  const mint = mintKeypair.publicKey;
  const [bondingCurve] = getBondingCurvePDA(mint);
  const [reserveVault] = getReserveVaultPDA(mint);
  const [buybackVault] = getBuybackVaultPDA(mint);
  const [creatorVault] = getCreatorVaultPDA(mint);
  const tokenVault = getTokenVault(mint, bondingCurve);

  const program = getProgram(connection, wallet);

  const metadataPDA = getMetadataPDA(mint);

  const ix = await program.methods
    .createToken(name, symbol, uri)
    .accounts({
      creator: wallet.publicKey,
      mint,
      bondingCurve,
      tokenVault,
      reserveVault,
      buybackVault,
      creatorVault,
      metadata: metadataPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry(connection);
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;
  // Do NOT pre-sign with mintKeypair here — pass it via sendTransaction's signers option
  // so the wallet adapter applies it in the correct order (before Phantom signs).

  return { transaction: tx, mintKeypair };
}

export interface ExecuteBuybackParams {
  connection: Connection;
  wallet: AnchorWallet;
  mintAddress: string;
}

export async function buildExecuteBuybackTransaction(
  params: ExecuteBuybackParams
): Promise<Transaction> {
  const { connection, wallet, mintAddress } = params;
  const mint = new PublicKey(mintAddress);
  const [bondingCurve] = getBondingCurvePDA(mint);
  const tokenVault = getTokenVault(mint, bondingCurve);
  const [buybackVault] = getBuybackVaultPDA(mint);

  const program = getProgram(connection, wallet);

  const ix = await program.methods
    .executeBuyback()
    .accounts({
      payer: wallet.publicKey,
      mint,
      bondingCurve,
      tokenVault,
      buybackVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry(connection);
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;
  return tx;
}

export interface WithdrawCreatorFeesParams {
  connection: Connection;
  wallet: AnchorWallet;
  mintAddress: string;
}

export async function buildWithdrawCreatorFeesTransaction(
  params: WithdrawCreatorFeesParams
): Promise<Transaction> {
  const { connection, wallet, mintAddress } = params;
  const mint = new PublicKey(mintAddress);
  const [bondingCurve] = getBondingCurvePDA(mint);
  const [creatorVault] = getCreatorVaultPDA(mint);

  const program = getProgram(connection, wallet);

  const ix = await program.methods
    .withdrawCreatorFees()
    .accounts({
      creator: wallet.publicKey,
      mint,
      bondingCurve,
      creatorVault,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry(connection);
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = wallet.publicKey;
  return tx;
}
