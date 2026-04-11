use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer as TokenTransfer},
};

use crate::{
    errors::TokenLaunchError,
    state::{BondingCurveState, BPS_DENOMINATOR, CREATOR_FEE_SHARE, FEE_BPS, FEE_SHARE_DENOMINATOR, TREASURY_FEE_SHARE},
};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

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

    /// Buyer's token account (created if needed)
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

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
pub struct BuyEvent {
    pub mint: Pubkey,
    pub buyer: Pubkey,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub fee: u64,
    pub is_graduated: bool,
    pub timestamp: i64,
}

pub fn buy(
    ctx: Context<Buy>,
    sol_amount: u64,
    min_tokens_out: u64,
) -> Result<()> {
    let bonding_curve = &ctx.accounts.bonding_curve;

    // Ensure token has not graduated
    require!(!bonding_curve.complete, TokenLaunchError::TokenGraduated);

    // Ensure valid amount
    require!(sol_amount > 0, TokenLaunchError::InvalidAmount);

    // Calculate fee (1% of sol_amount)
    let fee = sol_amount
        .checked_mul(FEE_BPS)
        .ok_or(TokenLaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(TokenLaunchError::MathOverflow)?;

    let sol_in_after_fee = sol_amount
        .checked_sub(fee)
        .ok_or(TokenLaunchError::MathOverflow)?;

    // Calculate tokens out using constant product
    let tokens_out = bonding_curve
        .get_tokens_for_sol(sol_in_after_fee)
        .ok_or(TokenLaunchError::MathOverflow)?;

    require!(tokens_out > 0, TokenLaunchError::InvalidAmount);
    require!(tokens_out >= min_tokens_out, TokenLaunchError::SlippageExceeded);
    require!(
        tokens_out <= bonding_curve.real_token_reserves,
        TokenLaunchError::TokenSupplyExhausted
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

    // Buyer pays net SOL directly to bonding curve (no fee mixed in)
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.bonding_curve.to_account_info(),
            },
        ),
        sol_in_after_fee,
    )?;

    // Buyer pays fees directly to each recipient — buyer has no data so
    // SystemInstruction::Transfer works cleanly for all three.
    if creator_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.creator_vault.to_account_info(),
                },
            ),
            creator_fee,
        )?;
    }
    if treasury_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            treasury_fee,
        )?;
    }
    if buyback_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.buyback_vault.to_account_info(),
                },
            ),
            buyback_fee,
        )?;
    }

    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.accounts.bonding_curve.bump;
    let seeds: &[&[u8]] = &[b"bonding_curve", mint_key.as_ref(), &[bump]];
    let signer_seeds = &[seeds];

    // Transfer tokens from vault to buyer
    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.token_vault.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
            signer_seeds,
        ),
        tokens_out,
    )?;

    // Update curve state
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    bonding_curve.apply_buy(sol_in_after_fee, tokens_out)?;
    bonding_curve.total_volume_sol = bonding_curve
        .total_volume_sol
        .saturating_add(sol_amount);
    bonding_curve.total_trades = bonding_curve.total_trades.saturating_add(1);

    // Check graduation
    let should_graduate = bonding_curve.should_graduate();
    if should_graduate {
        bonding_curve.complete = true;
    }

    let timestamp = Clock::get()?.unix_timestamp;

    emit!(BuyEvent {
        mint: ctx.accounts.mint.key(),
        buyer: ctx.accounts.buyer.key(),
        sol_amount,
        token_amount: tokens_out,
        virtual_sol_reserves: bonding_curve.virtual_sol_reserves,
        virtual_token_reserves: bonding_curve.virtual_token_reserves,
        real_sol_reserves: bonding_curve.real_sol_reserves,
        real_token_reserves: bonding_curve.real_token_reserves,
        fee,
        is_graduated: bonding_curve.complete,
        timestamp,
    });

    Ok(())
}
