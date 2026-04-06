import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "TokenLaunchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
);

const TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
);

const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export function getConnection(): Connection {
  return new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com",
    { commitment: "confirmed" }
  );
}

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

export function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

export interface BondingCurveStateOnChain {
  mint: PublicKey;
  creator: PublicKey;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  tokenTotalSupply: BN;
  complete: boolean;
  createdAt: BN;
  totalVolumeSol: BN;
  totalTrades: BN;
  bump: number;
}

/**
 * Fetch bonding curve state from chain.
 * In production, use Anchor's program.account.bondingCurveState.fetch()
 * This is a placeholder that returns a mock for demo purposes.
 */
export async function getBondingCurveState(
  mint: string
): Promise<BondingCurveStateOnChain | null> {
  try {
    const connection = getConnection();
    const mintPubkey = new PublicKey(mint);
    const [pda] = getBondingCurvePDA(mintPubkey);

    const accountInfo = await connection.getAccountInfo(pda);
    if (!accountInfo) return null;

    // In production: use Anchor IDL to deserialize
    // const program = getProgram(wallet);
    // return program.account.bondingCurveState.fetch(pda);

    return null;
  } catch {
    return null;
  }
}

export interface BuyParams {
  mint: string;
  solAmount: BN; // lamports
  minTokensOut: BN;
  wallet: any; // AnchorWallet
}

export interface SellParams {
  mint: string;
  tokenAmount: BN;
  minSolOut: BN;
  wallet: any;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  uri: string;
  wallet: any;
}

/**
 * Build buy transaction.
 * In production, use @coral-xyz/anchor with the deployed IDL.
 */
export async function buildBuyTransaction(params: BuyParams): Promise<Transaction> {
  const connection = getConnection();
  const mintPubkey = new PublicKey(params.mint);
  const [bondingCurvePDA] = getBondingCurvePDA(mintPubkey);

  const tokenVault = await getAssociatedTokenAddress(
    mintPubkey,
    bondingCurvePDA,
    true
  );

  const buyerTokenAccount = await getAssociatedTokenAddress(
    mintPubkey,
    params.wallet.publicKey
  );

  const tx = new Transaction();

  // Check if buyer ATA exists
  const ataInfo = await connection.getAccountInfo(buyerTokenAccount);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        params.wallet.publicKey,
        buyerTokenAccount,
        params.wallet.publicKey,
        mintPubkey
      )
    );
  }

  // In production, add the actual program instruction via Anchor:
  // const program = getAnchorProgram(params.wallet);
  // const ix = await program.methods
  //   .buy(params.solAmount, params.minTokensOut)
  //   .accounts({ ... })
  //   .instruction();
  // tx.add(ix);

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = params.wallet.publicKey;

  return tx;
}

/**
 * Build sell transaction.
 */
export async function buildSellTransaction(params: SellParams): Promise<Transaction> {
  const connection = getConnection();
  const mintPubkey = new PublicKey(params.mint);
  const [bondingCurvePDA] = getBondingCurvePDA(mintPubkey);

  const tokenVault = await getAssociatedTokenAddress(
    mintPubkey,
    bondingCurvePDA,
    true
  );

  const sellerTokenAccount = await getAssociatedTokenAddress(
    mintPubkey,
    params.wallet.publicKey
  );

  const tx = new Transaction();

  // In production, add the actual program instruction via Anchor
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = params.wallet.publicKey;

  return tx;
}

/**
 * Get SOL balance for a wallet
 */
export async function getSolBalance(address: string): Promise<number> {
  const connection = getConnection();
  const balance = await connection.getBalance(new PublicKey(address));
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Get token balance for a wallet
 */
export async function getTokenBalance(
  walletAddress: string,
  mintAddress: string
): Promise<BN> {
  try {
    const connection = getConnection();
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(mintAddress);
    const ata = await getAssociatedTokenAddress(mint, wallet);
    const balance = await connection.getTokenAccountBalance(ata);
    return new BN(balance.value.amount);
  } catch {
    return new BN(0);
  }
}
