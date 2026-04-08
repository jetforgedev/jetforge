use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer as TokenTransfer},
};

use crate::{
    errors::TokenLaunchError,
    state::{BondingCurveState, GRADUATION_TREASURY_BPS, GRADUATION_CREATOR_BPS, BPS_DENOMINATOR},
};

/// Dead address for burning LP tokens (all zeros is a known dead address on Solana)
pub const DEAD_ADDRESS: &str = "1nc1nerator11111111111111111111111111111111";

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
        constraint = bonding_curve.complete @ TokenLaunchError::GraduationThresholdNotMet,
    )]
    pub bonding_curve: Account<'info, BondingCurveState>,

    /// Bonding curve's main token vault (holds unsold tokens)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// Reserve vault with liquidity tokens
    #[account(
        mut,
        seeds = [b"reserve_vault", mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = bonding_curve,
    )]
    pub reserve_vault: Account<'info, TokenAccount>,

    /// Treasury — must match the program-hardcoded TREASURY address.
    /// CHECK: Key is validated by the constraint below.
    #[account(
        mut,
        constraint = treasury.key() == crate::TREASURY_PUBKEY @ TokenLaunchError::Unauthorized,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// Treasury token account — receives unsold tokens to seed DEX liquidity.
    /// Must already exist before calling this instruction (create it first via ATA).
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// Token creator receives graduation bonus
    /// CHECK: Validated against bonding_curve.creator
    #[account(mut, constraint = creator.key() == bonding_curve.creator @ TokenLaunchError::Unauthorized)]
    pub creator: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct GraduationEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub real_sol_reserves: u64,
    pub real_token_reserves: u64,
    pub total_volume_sol: u64,
    pub total_trades: u64,
    pub timestamp: i64,
}

pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
    let bonding_curve = &ctx.accounts.bonding_curve;

    // Double-check graduation condition
    require!(
        bonding_curve.complete,
        TokenLaunchError::GraduationThresholdNotMet
    );
    require!(
        bonding_curve.real_sol_reserves >= crate::state::GRADUATION_THRESHOLD,
        TokenLaunchError::GraduationThresholdNotMet
    );

    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.accounts.bonding_curve.bump;
    let seeds: &[&[u8]] = &[b"bonding_curve", mint_key.as_ref(), &[bump]];
    let signer_seeds = &[seeds];

    let total_sol = bonding_curve.real_sol_reserves;
    let tokens_in_vault = ctx.accounts.token_vault.amount;
    let reserve_tokens = ctx.accounts.reserve_vault.amount;
    let creator = bonding_curve.creator;
    let total_volume = bonding_curve.total_volume_sol;
    let total_trades = bonding_curve.total_trades;

    // Split SOL at graduation (percentage-based):
    //   5%  → treasury (platform cut)
    //   5%  → creator (graduation reward)
    //   90% → treasury to seed DEX liquidity (Raydium CPMM pool)
    let treasury_cut = total_sol
        .checked_mul(GRADUATION_TREASURY_BPS)
        .ok_or(TokenLaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(TokenLaunchError::MathOverflow)?;
    let creator_bonus = total_sol
        .checked_mul(GRADUATION_CREATOR_BPS)
        .ok_or(TokenLaunchError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(TokenLaunchError::MathOverflow)?;
    let liquidity_sol = total_sol.saturating_sub(treasury_cut).saturating_sub(creator_bonus);

    // bonding_curve is a program-owned data account — SystemProgram::Transfer will
    // reject it as "not owned by system program".  Use direct lamport manipulation
    // instead, exactly as sell.rs does for the same reason.
    let total_out = treasury_cut
        .checked_add(creator_bonus)
        .ok_or(TokenLaunchError::MathOverflow)?
        .checked_add(liquidity_sol)
        .ok_or(TokenLaunchError::MathOverflow)?;

    {
        let bc_info = ctx.accounts.bonding_curve.to_account_info();
        let mut bc_lamps = bc_info.try_borrow_mut_lamports()?;
        **bc_lamps = bc_lamps
            .checked_sub(total_out)
            .ok_or(TokenLaunchError::MathOverflow)?;
    }

    // treasury receives its platform cut plus the DEX liquidity SOL portion
    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? +=
        treasury_cut.checked_add(liquidity_sol).ok_or(TokenLaunchError::MathOverflow)?;

    // creator receives graduation bonus
    **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += creator_bonus;

    // ── Token transfers ──────────────────────────────────────────────────────────

    // Step 1: Consolidate reserve vault → token vault (if any reserve tokens exist)
    if reserve_tokens > 0 {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TokenTransfer {
                    from: ctx.accounts.reserve_vault.to_account_info(),
                    to: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                signer_seeds,
            ),
            reserve_tokens,
        )?;
    }

    // Step 2: Transfer ALL tokens (unsold) from token vault → treasury ATA
    // Treasury will use these + the liquidity SOL to seed the Raydium CPMM pool
    let total_tokens = tokens_in_vault.checked_add(reserve_tokens)
        .ok_or(TokenLaunchError::MathOverflow)?;

    if total_tokens > 0 {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TokenTransfer {
                    from: ctx.accounts.token_vault.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                signer_seeds,
            ),
            total_tokens,
        )?;
    }

    let timestamp = Clock::get()?.unix_timestamp;

    emit!(GraduationEvent {
        mint: mint_key,
        creator,
        real_sol_reserves: liquidity_sol,   // 90% SOL going to DEX pool
        real_token_reserves: total_tokens,  // all unsold tokens going to DEX pool
        total_volume_sol: total_volume,
        total_trades,
        timestamp,
    });

    Ok(())
}
