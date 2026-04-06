/**
 * Integration tests for the token-launch Anchor program.
 *
 * Accounts match the CURRENT instruction structs:
 *   create_token : creator, mint, bondingCurve, tokenVault, reserveVault,
 *                  buybackVault, creatorVault, tokenProgram,
 *                  associatedTokenProgram, systemProgram
 *   buy          : buyer, mint, bondingCurve, tokenVault, buyerTokenAccount,
 *                  treasury (*hardcoded*), buybackVault, creatorVault,
 *                  tokenProgram, associatedTokenProgram, systemProgram
 *   sell         : seller, mint, bondingCurve, tokenVault, sellerTokenAccount,
 *                  treasury (*hardcoded*), buybackVault, creatorVault,
 *                  tokenProgram, associatedTokenProgram, systemProgram
 *   withdraw_creator_fees : creator, mint, bondingCurve, creatorVault,
 *                           systemProgram
 *
 * NO metadata/rent/tokenMetadataProgram accounts — the program does not call
 * Metaplex.  NO direct `creator` account in buy/sell — fees go through the
 * creator_vault PDA.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenLaunch } from "../target/types/token_launch";
import idl from "../target/idl/token_launch.json";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import BN from "bn.js";

// ─── Constants (must match bonding_curve.rs exactly) ────────────────────────

const INITIAL_VIRTUAL_SOL    = new BN("30000000000");
const INITIAL_VIRTUAL_TOKENS = new BN("1073000191000000");
const REAL_TOKEN_RESERVES_INIT = new BN("1000000000000000"); // 100% to trading vault
const TOTAL_SUPPLY           = new BN("1000000000000000");
const GRADUATION_THRESHOLD   = new BN("85000000000");       // 85 SOL
const FEE_BPS   = 100;
const BPS_DENOM = 10_000;

// Hardcoded treasury — must match crate::TREASURY_PUBKEY in lib.rs.
const TREASURY_PUBKEY = new PublicKey(
  "13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW"
);

// ─── Math helpers (mirror Rust) ──────────────────────────────────────────────

function tokensOut(vSol: BN, vTok: BN, solAfterFee: BN): BN {
  const k = vSol.mul(vTok);
  return vTok.sub(k.div(vSol.add(solAfterFee)));
}

function solOut(vSol: BN, vTok: BN, tokIn: BN): BN {
  const k = vSol.mul(vTok);
  return vSol.sub(k.div(vTok.add(tokIn)));
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe("token-launch", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program    = new anchor.Program(idl as unknown as Idl, provider) as unknown as Program<TokenLaunch>;
  const connection = provider.connection;

  // Keypairs
  let mint:    Keypair;
  let creator: Keypair;
  let buyer:   Keypair;

  // Derived addresses
  let bondingCurvePDA: PublicKey;
  let bondingCurveBump: number;
  let tokenVault:    PublicKey;
  let reserveVault:  PublicKey;
  let buybackVault:  PublicKey;
  let creatorVault:  PublicKey;

  // Fund a keypair from the provider wallet (works on devnet where airdrop is rate-limited)
  async function fund(kp: Keypair, lamports: number) {
    const payer = (provider.wallet as anchor.Wallet).payer;
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: kp.publicKey, lamports })
    );
    await sendAndConfirmTransaction(connection, tx, [payer]);
  }

  before(async () => {
    creator = Keypair.generate();
    buyer   = Keypair.generate();
    mint    = Keypair.generate();

    await fund(creator, Math.floor(0.05 * LAMPORTS_PER_SOL));
    await fund(buyer,   Math.floor(0.45 * LAMPORTS_PER_SOL));

    [bondingCurvePDA, bondingCurveBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mint.publicKey.toBuffer()],
      program.programId
    );

    tokenVault = await getAssociatedTokenAddress(
      mint.publicKey,
      bondingCurvePDA,
      true // allowOwnerOffCurve
    );

    [reserveVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("reserve_vault"), mint.publicKey.toBuffer()],
      program.programId
    );

    [buybackVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("buyback_vault"), mint.publicKey.toBuffer()],
      program.programId
    );

    [creatorVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator_vault"), mint.publicKey.toBuffer()],
      program.programId
    );
  });

  // ── create_token ────────────────────────────────────────────────────────────

  describe("create_token", () => {
    it("creates a token with bonding curve and correct initial state", async () => {
      const tx = await program.methods
        .createToken("Test Token", "TEST", "https://example.com/meta.json")
        .accounts({
          creator:                creator.publicKey,
          mint:                   mint.publicKey,
          bondingCurve:           bondingCurvePDA,
          tokenVault,
          reserveVault,
          buybackVault,
          creatorVault,
          tokenProgram:           TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram:          SystemProgram.programId,
        })
        .signers([creator, mint])
        .rpc();

      console.log("create_token tx:", tx);

      const curve = await program.account.bondingCurveState.fetch(bondingCurvePDA);

      assert.equal(curve.mint.toBase58(),    mint.publicKey.toBase58());
      assert.equal(curve.creator.toBase58(), creator.publicKey.toBase58());
      assert.equal(curve.virtualSolReserves.toString(),   INITIAL_VIRTUAL_SOL.toString());
      assert.equal(curve.virtualTokenReserves.toString(), INITIAL_VIRTUAL_TOKENS.toString());
      assert.equal(curve.realSolReserves.toString(),      "0");
      assert.equal(curve.realTokenReserves.toString(),    REAL_TOKEN_RESERVES_INIT.toString());
      assert.equal(curve.tokenTotalSupply.toString(),     TOTAL_SUPPLY.toString());
      assert.equal(curve.complete, false);
      assert.equal(curve.totalTrades.toString(), "0");
      assert.equal(curve.totalVolumeSol.toString(), "0");

      // Trading vault holds all 1 T tokens.
      const vault = await getAccount(connection, tokenVault);
      assert.equal(vault.amount.toString(), REAL_TOKEN_RESERVES_INIT.toString());

      // Reserve vault exists but holds 0 tokens (RESERVE_TOKEN_AMOUNT == 0).
      const reserve = await getAccount(connection, reserveVault);
      assert.equal(reserve.amount.toString(), "0");

      // Fee vaults created and rent-exempt (non-zero lamports, no data).
      const bbLamps = await connection.getBalance(buybackVault);
      const cvLamps = await connection.getBalance(creatorVault);
      assert.isTrue(bbLamps > 0, "buyback_vault should be rent-exempt");
      assert.isTrue(cvLamps > 0, "creator_vault should be rent-exempt");
    });
  });

  // ── buy ─────────────────────────────────────────────────────────────────────

  describe("buy", () => {
    it("buys tokens and correctly splits fees", async () => {
      const solIn = new BN(Math.floor(0.3 * LAMPORTS_PER_SOL)); // 0.3 SOL

      const curve = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      const fee         = solIn.muln(FEE_BPS).divn(BPS_DENOM);
      const solAfterFee = solIn.sub(fee);
      const expectedTok = tokensOut(
        curve.virtualSolReserves,
        curve.virtualTokenReserves,
        solAfterFee
      );
      const minTok = expectedTok.muln(99).divn(100); // 1% slippage

      const buyerATA = await getAssociatedTokenAddress(mint.publicKey, buyer.publicKey);

      const cvBefore = await connection.getBalance(creatorVault);
      const bbBefore = await connection.getBalance(buybackVault);

      const tx = await program.methods
        .buy(solIn, minTok)
        .accounts({
          buyer:                  buyer.publicKey,
          mint:                   mint.publicKey,
          bondingCurve:           bondingCurvePDA,
          tokenVault,
          buyerTokenAccount:      buyerATA,
          treasury:               TREASURY_PUBKEY,
          buybackVault,
          creatorVault,
          tokenProgram:           TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram:          SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      console.log("buy tx:", tx);

      // Buyer received tokens.
      const ata = await getAccount(connection, buyerATA);
      assert.isTrue(new BN(ata.amount.toString()).gte(minTok), "buyer should receive >= minTok");

      // Curve updated.
      const updated = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      assert.equal(updated.totalTrades.toString(), "1");
      assert.isTrue(updated.realSolReserves.gt(new BN(0)));
      // virtual SOL should increase by sol_in_after_fee.
      assert.isTrue(
        updated.virtualSolReserves.gt(curve.virtualSolReserves),
        "virtual SOL should increase after buy"
      );

      // Creator vault received 40% of fee.
      const cvAfter = await connection.getBalance(creatorVault);
      const creatorFeeExpected = fee.muln(40).divn(100);
      assert.isTrue(
        cvAfter - cvBefore >= creatorFeeExpected.toNumber() - 1,
        "creator_vault should receive 40% of fee"
      );

      // Buyback vault received 20% of fee.
      const bbAfter = await connection.getBalance(buybackVault);
      const buybackFeeExpected = fee.muln(20).divn(100);
      assert.isTrue(
        bbAfter - bbBefore >= buybackFeeExpected.toNumber() - 1,
        "buyback_vault should receive 20% of fee"
      );

      console.log(`Tokens received: ${ata.amount}`);
    });

    it("rejects with SlippageExceeded when min_tokens_out is too high", async () => {
      const solIn = new BN(LAMPORTS_PER_SOL);
      const impossibleMin = new BN("999999999999999");
      const buyerATA = await getAssociatedTokenAddress(mint.publicKey, buyer.publicKey);

      try {
        await program.methods
          .buy(solIn, impossibleMin)
          .accounts({
            buyer:                  buyer.publicKey,
            mint:                   mint.publicKey,
            bondingCurve:           bondingCurvePDA,
            tokenVault,
            buyerTokenAccount:      buyerATA,
            treasury:               TREASURY_PUBKEY,
            buybackVault,
            creatorVault,
            tokenProgram:           TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram:          SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Expected SlippageExceeded");
      } catch (err: any) {
        assert.include(err.toString(), "SlippageExceeded");
      }
    });

    it("rejects with InvalidFeeConfig when wrong treasury is passed", async () => {
      const solIn    = new BN(LAMPORTS_PER_SOL);
      const fakeTreasury = Keypair.generate().publicKey;
      const buyerATA = await getAssociatedTokenAddress(mint.publicKey, buyer.publicKey);

      const curve = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      const fee         = solIn.muln(FEE_BPS).divn(BPS_DENOM);
      const solAfterFee = solIn.sub(fee);
      const minTok = tokensOut(
        curve.virtualSolReserves,
        curve.virtualTokenReserves,
        solAfterFee
      ).muln(90).divn(100);

      try {
        await program.methods
          .buy(solIn, minTok)
          .accounts({
            buyer:                  buyer.publicKey,
            mint:                   mint.publicKey,
            bondingCurve:           bondingCurvePDA,
            tokenVault,
            buyerTokenAccount:      buyerATA,
            treasury:               fakeTreasury, // wrong!
            buybackVault,
            creatorVault,
            tokenProgram:           TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram:          SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Expected InvalidFeeConfig");
      } catch (err: any) {
        assert.include(err.toString(), "InvalidFeeConfig");
      }
    });

    it("price increases monotonically across multiple buys", async () => {
      const buyer2 = Keypair.generate();
      await fund(buyer2, Math.floor(0.4 * LAMPORTS_PER_SOL));
      const buyer2ATA = await getAssociatedTokenAddress(mint.publicKey, buyer2.publicKey);

      const c1 = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      const p1 = c1.virtualSolReserves.toNumber() / c1.virtualTokenReserves.toNumber();

      if (c1.complete) { console.log("curve completed early, skip price test"); return; }

      const solIn = new BN(Math.floor(0.3 * LAMPORTS_PER_SOL));
      const fee   = solIn.muln(FEE_BPS).divn(BPS_DENOM);
      const minTok = tokensOut(c1.virtualSolReserves, c1.virtualTokenReserves, solIn.sub(fee))
        .muln(90).divn(100);

      await program.methods
        .buy(solIn, minTok)
        .accounts({
          buyer:                  buyer2.publicKey,
          mint:                   mint.publicKey,
          bondingCurve:           bondingCurvePDA,
          tokenVault,
          buyerTokenAccount:      buyer2ATA,
          treasury:               TREASURY_PUBKEY,
          buybackVault,
          creatorVault,
          tokenProgram:           TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram:          SystemProgram.programId,
        })
        .signers([buyer2])
        .rpc();

      const c2 = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      const p2 = c2.virtualSolReserves.toNumber() / c2.virtualTokenReserves.toNumber();
      assert.isTrue(p2 > p1, `price should rise after buy (${p1} → ${p2})`);
    });
  });

  // ── sell ────────────────────────────────────────────────────────────────────

  describe("sell", () => {
    it("sells 25% of position and returns SOL", async () => {
      const buyerATA = await getAssociatedTokenAddress(mint.publicKey, buyer.publicKey);
      const ataInfo  = await getAccount(connection, buyerATA);
      const tokSell  = new BN(ataInfo.amount.toString()).divn(4);

      const curve = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      if (curve.complete) { console.log("curve completed, skipping sell test"); return; }

      const grossSol = solOut(curve.virtualSolReserves, curve.virtualTokenReserves, tokSell);
      const fee      = grossSol.muln(FEE_BPS).divn(BPS_DENOM);
      const minSol   = grossSol.sub(fee).muln(99).divn(100);

      const solBefore = await connection.getBalance(buyer.publicKey);

      await program.methods
        .sell(tokSell, minSol)
        .accounts({
          seller:                 buyer.publicKey,
          mint:                   mint.publicKey,
          bondingCurve:           bondingCurvePDA,
          tokenVault,
          sellerTokenAccount:     buyerATA,
          treasury:               TREASURY_PUBKEY,
          buybackVault,
          creatorVault,
          tokenProgram:           TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram:          SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      const solAfter = await connection.getBalance(buyer.publicKey);
      // Seller receives net SOL (minus tx fee ~5k lamports).
      assert.isTrue(
        solAfter > solBefore - 10_000,
        "seller SOL balance should increase"
      );

      const updated = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      console.log("real SOL after sell:", updated.realSolReserves.toString());
    });

    it("rejects with InvalidFeeConfig when wrong treasury is passed", async () => {
      const buyerATA = await getAssociatedTokenAddress(mint.publicKey, buyer.publicKey);
      const ataInfo  = await getAccount(connection, buyerATA);
      const tokSell  = new BN(ataInfo.amount.toString()).divn(10);

      if (tokSell.isZero()) { console.log("no tokens left, skip"); return; }

      try {
        await program.methods
          .sell(tokSell, new BN(0))
          .accounts({
            seller:                 buyer.publicKey,
            mint:                   mint.publicKey,
            bondingCurve:           bondingCurvePDA,
            tokenVault,
            sellerTokenAccount:     buyerATA,
            treasury:               Keypair.generate().publicKey, // wrong!
            buybackVault,
            creatorVault,
            tokenProgram:           TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram:          SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        assert.fail("Expected InvalidFeeConfig");
      } catch (err: any) {
        assert.include(err.toString(), "InvalidFeeConfig");
      }
    });
  });

  // ── withdraw_creator_fees ────────────────────────────────────────────────────

  describe("withdraw_creator_fees", () => {
    it("creator can withdraw accumulated fees from creator_vault", async () => {
      const cvBefore  = await connection.getBalance(creatorVault);
      const walBefore = await connection.getBalance(creator.publicKey);

      // There should be accumulated fees from the buy tests above.
      assert.isTrue(cvBefore > 0, "creator_vault should have accumulated fees");

      await program.methods
        .withdrawCreatorFees()
        .accounts({
          creator:      creator.publicKey,
          mint:         mint.publicKey,
          bondingCurve: bondingCurvePDA,
          creatorVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const cvAfter  = await connection.getBalance(creatorVault);
      const walAfter = await connection.getBalance(creator.publicKey);

      // Vault drained to rent minimum.
      assert.isTrue(cvAfter < cvBefore, "creator_vault should decrease");
      // Creator wallet increased (net of tx fee).
      assert.isTrue(walAfter > walBefore - 10_000, "creator wallet should increase");

      console.log(`Withdrawn: ${(cvBefore - cvAfter) / 1e9} SOL`);
    });

    it("rejects when caller is not the creator", async () => {
      const imposter = Keypair.generate();
      await fund(imposter, Math.floor(0.05 * LAMPORTS_PER_SOL));

      try {
        await program.methods
          .withdrawCreatorFees()
          .accounts({
            creator:      imposter.publicKey, // wrong!
            mint:         mint.publicKey,
            bondingCurve: bondingCurvePDA,
            creatorVault,
            systemProgram: SystemProgram.programId,
          })
          .signers([imposter])
          .rpc();
        assert.fail("Expected Unauthorized");
      } catch (err: any) {
        assert.include(err.toString(), "Unauthorized");
      }
    });
  });

  // ── bonding curve math invariants ────────────────────────────────────────────

  describe("bonding curve invariants", () => {
    it("total_trades increments once per buy and once per sell", async () => {
      const before = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      if (before.complete) { console.log("curve complete, skip"); return; }

      const b = Keypair.generate();
      await fund(b, Math.floor(0.08 * LAMPORTS_PER_SOL));
      const bATA = await getAssociatedTokenAddress(mint.publicKey, b.publicKey);

      const solIn  = new BN(Math.floor(0.05 * LAMPORTS_PER_SOL));
      const fee    = solIn.muln(FEE_BPS).divn(BPS_DENOM);
      const minTok = tokensOut(
        before.virtualSolReserves, before.virtualTokenReserves, solIn.sub(fee)
      ).muln(90).divn(100);

      await program.methods
        .buy(solIn, minTok)
        .accounts({
          buyer: b.publicKey, mint: mint.publicKey,
          bondingCurve: bondingCurvePDA, tokenVault,
          buyerTokenAccount: bATA, treasury: TREASURY_PUBKEY,
          buybackVault, creatorVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([b])
        .rpc();

      const afterBuy = await program.account.bondingCurveState.fetch(bondingCurvePDA);
      assert.equal(
        afterBuy.totalTrades.toNumber(),
        before.totalTrades.toNumber() + 1,
        "totalTrades should increment after buy"
      );

      // Sell back half.
      const bAtaInfo = await getAccount(connection, bATA);
      const tokSell  = new BN(bAtaInfo.amount.toString()).divn(2);
      if (!tokSell.isZero()) {
        await program.methods
          .sell(tokSell, new BN(0))
          .accounts({
            seller: b.publicKey, mint: mint.publicKey,
            bondingCurve: bondingCurvePDA, tokenVault,
            sellerTokenAccount: bATA, treasury: TREASURY_PUBKEY,
            buybackVault, creatorVault,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([b])
          .rpc();

        const afterSell = await program.account.bondingCurveState.fetch(bondingCurvePDA);
        assert.equal(
          afterSell.totalTrades.toNumber(),
          afterBuy.totalTrades.toNumber() + 1,
          "totalTrades should increment after sell"
        );
      }
    });
  });
});
