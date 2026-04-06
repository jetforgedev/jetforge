use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer as TokenTransfer},
};

use crate::{
    errors::TokenLaunchError,
    state::{BondingCurveState, BPS_DENOMINATOR, CREATOR_FEE_SHARE, FEE_BPS, FEE_SHARE_DENOMINATOR, TREASURY_FEE_SHARE},
};

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
    )]
    pub bonding_curve: Account<'info, BondingCurveState>,

    /// Bonding curve's token vault
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// Seller's token account
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// Treasury wallet — must match the program-hardcoded TREASURY address.
    /// CHECK: Key is validated by the constraint below.
    #[account(
        mut,
        constraint = treasury.key() == crate::TREASURY_PUBKEY @ TokenLaunchError::InvalidFeeConfig,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// Buyback vault PDA — accumulates 20% of fees for buyback-and-burn
    /// CHECK: validated by PDA seeds [b"buyback_vault", mint]
    #[account(
        mut,
        seeds = [b"buyback_vault", mint.key().as_ref()],
        bump,
    )]
    pub buyback_vault: UncheckedAccount<'info>,

    /// Creator vault PDA — accumulates 40% of fees, withdrawable by creator
    /// CHECK: validated by PDA seeds [b"creator_vault", mint]
    #[account(
        mut,
        seeds = [b"creator_vault", mint.key().as_ref()],
        bump,
    )]
    pub creator_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct SellEvent {
    pub mint: Pubkey,
    pub seller: Pubkey,
    pub token_amount: u64,
    pub sol_amount: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub fee: u64,
    pub timestamp: i64,
}

pub fn sell(
    ctx: Context<Sell>,
    token_amount: u64,
    min_sol_out: u64,
) -> Result<()> {
    let bonding_curve = &ctx.accounts.bonding_curve;

    // Ensure token has not graduated
    require!(!bonding_curve.complete, TokenLaunchError::TokenGraduated);

    // Ensure valid amount
    require!(token_amount > 0, TokenLaunchError::InvalidAmount);

    // Ensure seller has enough tokens
    require!(
        ctx.accounts.seller_token_account.amount >= token_amount,
        TokenLaunchError::InsufficientTokens
    );

    // Calculate SOL out (before fee)
    let sol_out_before_fee = bonding_curve
        .get_sol_for_tokens(token_amount)
        .ok_or(TokenLaunchError::MathOverflow)?;

    require!(sol_out_before_fee > 0, TokenLaunchError::InsufficientSolReserves);

    // Calculate fee (1% of sol out)
    let fee = sol_out_before_fee
        .checked_mul(FEE_BPS)
        .ok_or(TokenLaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(TokenLaunchError::MathOverflow)?;

    let sol_out_after_fee = sol_out_before_fee
        .checked_sub(fee)
        .ok_or(TokenLaunchError::MathOverflow)?;

    // Check slippage
    require!(sol_out_after_fee >= min_sol_out, TokenLaunchError::SlippageExceeded);

    // Ensure curve has enough SOL
    require!(
        bonding_curve.real_sol_reserves >= sol_out_before_fee,
        TokenLaunchError::InsufficientSolReserves
    );

    // Calculate fee distribution: 40% creator / 40% treasury / 20% buyback
    let creator_fee = fee
        .checked_mul(CREATOR_FEE_SHARE)
        .ok_or(TokenLaunchError::MathOverflow)?
        .checked_div(FEE_SHARE_DENOMINATOR)
        .ok_or(TokenLaunchError::MathOverflow)?;

    let treasury_fee = fee
        .checked_mul(TREASURY_FEE_SHARE)
        .ok_or(TokenLaunchError::MathOverflow)?
        .checked_div(FEE_SHARE_DENOMINATOR)
        .ok_or(TokenLaunchError::MathOverflow)?;

    let buyback_fee = fee
        .checked_sub(creator_fee)
        .ok_or(TokenLaunchError::MathOverflow)?
        .checked_sub(treasury_fee)
        .ok_or(TokenLaunchError::MathOverflow)?;

    // Transfer tokens from seller to token vault
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.seller_token_account.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        token_amount,
    )?;

    // All outgoing SOL transfers use direct lamport manipulation —
    // SystemInstruction::Transfer cannot be used from an account that carries data.
    {
        let bc_info = ctx.accounts.bonding_curve.to_account_info();
        let mut bc_lamports = bc_info.try_borrow_mut_lamports()?;
        **bc_lamports = bc_lamports
            .checked_sub(sol_out_after_fee)
            .ok_or(TokenLaunchError::MathOverflow)?
            .checked_sub(creator_fee)
            .ok_or(TokenLaunchError::MathOverflow)?
            .checked_sub(treasury_fee)
            .ok_or(TokenLaunchError::MathOverflow)?
            .checked_sub(buyback_fee)
            .ok_or(TokenLaunchError::MathOverflow)?;
    }
    **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += sol_out_after_fee;
    if creator_fee > 0 {
        **ctx.accounts.creator_vault.to_account_info().try_borrow_mut_lamports()? += creator_fee;
    }
    if treasury_fee > 0 {
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += treasury_fee;
    }
    if buyback_fee > 0 {
        **ctx.accounts.buyback_vault.to_account_info().try_borrow_mut_lamports()? += buyback_fee;
    }

    // Update curve state
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    bonding_curve.apply_sell(token_amount, sol_out_before_fee);
    bonding_curve.total_volume_sol = bonding_curve
        .total_volume_sol
        .saturating_add(sol_out_before_fee);
    bonding_curve.total_trades = bonding_curve.total_trades.saturating_add(1);

    let timestamp = Clock::get()?.unix_timestamp;

    emit!(SellEvent {
        mint: ctx.accounts.mint.key(),
        seller: ctx.accounts.seller.key(),
        token_amount,
        sol_amount: sol_out_after_fee,
        virtual_sol_reserves: bonding_curve.virtual_sol_reserves,
        virtual_token_reserves: bonding_curve.virtual_token_reserves,
        real_sol_reserves: bonding_curve.real_sol_reserves,
        real_token_reserves: bonding_curve.real_token_reserves,
        fee,
        timestamp,
    });

    Ok(())
}
