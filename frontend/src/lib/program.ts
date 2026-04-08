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
  version: "0.1.0",
  name: "token_launch",
  instructions: [
    {
      name: "createToken",
      accounts: [
        { name: "creator", isMut: true, isSigner: true },
        { name: "mint", isMut: true, isSigner: true },
        { name: "bondingCurve", isMut: true, isSigner: false },
        { name: "tokenVault", isMut: true, isSigner: false },
        { name: "reserveVault", isMut: true, isSigner: false },
        { name: "buybackVault", isMut: true, isSigner: false },
        { name: "creatorVault", isMut: true, isSigner: false },
        { name: "metadata", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
        { name: "tokenMetadataProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "uri", type: "string" },
      ],
    },
    {
      name: "buy",
      accounts: [
        { name: "buyer", isMut: true, isSigner: true },
        { name: "mint", isMut: false, isSigner: false },
        { name: "bondingCurve", isMut: true, isSigner: false },
        { name: "tokenVault", isMut: true, isSigner: false },
        { name: "buyerTokenAccount", isMut: true, isSigner: false },
        { name: "treasury", isMut: true, isSigner: false },
        { name: "buybackVault", isMut: true, isSigner: false },
        { name: "creatorVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "solAmount", type: "u64" },
        { name: "minTokensOut", type: "u64" },
      ],
    },
    {
      name: "sell",
      accounts: [
        { name: "seller", isMut: true, isSigner: true },
        { name: "mint", isMut: true, isSigner: false },
        { name: "bondingCurve", isMut: true, isSigner: false },
        { name: "tokenVault", isMut: true, isSigner: false },
        { name: "sellerTokenAccount", isMut: true, isSigner: false },
        { name: "treasury", isMut: true, isSigner: false },
        { name: "buybackVault", isMut: true, isSigner: false },
        { name: "creatorVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "tokenAmount", type: "u64" },
        { name: "minSolOut", type: "u64" },
      ],
    },
    {
      name: "executeBuyback",
      accounts: [
        { name: "payer", isMut: true, isSigner: true },
        { name: "mint", isMut: true, isSigner: false },
        { name: "bondingCurve", isMut: true, isSigner: false },
        { name: "tokenVault", isMut: true, isSigner: false },
        { name: "buybackVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "withdrawCreatorFees",
      accounts: [
        { name: "creator", isMut: true, isSigner: true },
        { name: "mint", isMut: false, isSigner: false },
        { name: "bondingCurve", isMut: false, isSigner: false },
        { name: "creatorVault", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "BondingCurveState",
      type: {
        kind: "struct",
        fields: [
          { name: "mint", type: "publicKey" },
          { name: "creator", type: "publicKey" },
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
  return new Program(IDL, PROGRAM_ID, provider);
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
