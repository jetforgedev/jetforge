/**
 * Payout Service
 *
 * Sends SOL from the treasury wallet to a recipient.
 * Used for referral withdrawals and cashback claims.
 *
 * Design decisions:
 *  - Tx fee (~0.000005 SOL) is absorbed by the treasury — never deducted from the user's payout.
 *  - Returns the confirmed tx signature on success.
 *  - Throws on failure so callers do NOT zero the DB balance unless this succeeds.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { config } from "../config";

function getTreasuryKeypair(): Keypair {
  const raw = process.env.TREASURY_PRIVATE_KEY;
  if (!raw || raw.trim() === "" || raw.trim() === '""') {
    throw new Error("TREASURY_PRIVATE_KEY not configured");
  }
  let cleaned = raw.trim().replace(/^"|"$/g, "");
  if (!cleaned.startsWith("[")) cleaned = `[${cleaned}]`;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(cleaned)));
}

/**
 * Transfer `amountSol` SOL from the treasury to `recipientWallet`.
 * Tx fee is paid by treasury on top of the transfer amount.
 *
 * @returns confirmed transaction signature
 * @throws if treasury keypair is missing, balance is insufficient, or tx fails
 */
export async function payoutSol(
  recipientWallet: string,
  amountSol: number
): Promise<string> {
  if (amountSol <= 0) throw new Error("Payout amount must be > 0");

  const treasury = getTreasuryKeypair();
  const recipient = new PublicKey(recipientWallet);
  const connection = new Connection(config.solana.rpcUrl, "confirmed");

  const lamports = Math.round(amountSol * 1e9);

  // Sanity check treasury balance before sending
  const treasuryBalance = await connection.getBalance(treasury.publicKey);
  const feeReserve = 10_000; // ~0.00001 SOL safety buffer for fees
  if (treasuryBalance < lamports + feeReserve) {
    throw new Error(
      `Treasury balance too low: ${(treasuryBalance / 1e9).toFixed(6)} SOL, ` +
      `need ${((lamports + feeReserve) / 1e9).toFixed(6)} SOL`
    );
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: recipient,
      lamports,
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [treasury], {
    commitment: "confirmed",
  });

  console.log(
    `[payout] Sent ${amountSol.toFixed(6)} SOL to ${recipientWallet.slice(0, 8)}… tx=${sig}`
  );
  return sig;
}
