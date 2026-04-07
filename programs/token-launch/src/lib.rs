use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk");

/// Treasury pubkey — used in account constraints for buy/sell/graduate.
/// Hardcoded so the on-chain constraint cannot be bypassed by an untrusted caller.
pub const TREASURY_PUBKEY: Pubkey = pubkey!("13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW");

#[program]
pub mod token_launch {
    use super::*;

    /// Create a new token with bonding curve
    /// - Initializes mint with 6 decimals
    /// - Creates BondingCurveState PDA
    /// - Creates token vault and reserve vault
    /// - Mints trading and reserve supply
    /// - Creates Metaplex on-chain metadata
    pub fn create_token(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        instructions::create_token::create_token(ctx, name, symbol, uri)
    }

    /// Buy tokens from the bonding curve
    /// - sol_amount: lamports to spend (including fee)
    /// - min_tokens_out: minimum tokens to receive (slippage protection)
    pub fn buy(
        ctx: Context<Buy>,
        sol_amount: u64,
        min_tokens_out: u64,
    ) -> Result<()> {
        instructions::buy::buy(ctx, sol_amount, min_tokens_out)
    }

    /// Sell tokens back to the bonding curve
    /// - token_amount: number of tokens to sell (with 6 decimals)
    /// - min_sol_out: minimum SOL to receive (slippage protection)
    pub fn sell(
        ctx: Context<Sell>,
        token_amount: u64,
        min_sol_out: u64,
    ) -> Result<()> {
        instructions::sell::sell(ctx, token_amount, min_sol_out)
    }

    /// Graduate a completed token to a DEX
    /// - Only callable when bonding_curve.complete == true
    /// - Transfers SOL + tokens to treasury for DEX liquidity setup
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        instructions::graduate::graduate(ctx)
    }

    /// Execute buyback-and-burn using accumulated fee SOL
    /// - Permissionless: anyone can call when buyback_vault >= BUYBACK_THRESHOLD
    /// - Uses accumulated 20% fee SOL to buy tokens from curve, then burns them
    /// - Deflationary: reduces supply and pushes price up
    pub fn execute_buyback(ctx: Context<ExecuteBuyback>) -> Result<()> {
        instructions::execute_buyback::execute_buyback(ctx)
    }

    /// Withdraw accumulated creator fees from the creator vault PDA
    /// - Only callable by the token's creator
    /// - Transfers all available SOL from creator_vault to creator wallet
    pub fn withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
        instructions::withdraw_creator_fees::withdraw_creator_fees(ctx)
    }
}
