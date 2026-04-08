use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, transfer, Burn, Mint, Token, TokenAccount, Transfer as TokenTransfer},
};

use crate::{
    errors::TokenLaunchError,
    state::{BondingCurveState, GRADUATION_TREASURY_BPS, GRADUATION_CREATOR_BPS, BPS_DENOMINATOR},
};

#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    /// Mint must be mutable so we can burn the unsold curve tokens
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
        constraint = bonding_curve.complete @ TokenLaunchError::GraduationThresholdNotMet,
    )]
    pub bonding_curve: Account<'info, BondingCurveState>,

    /// Bonding curve's main token vault — holds unsold curve tokens (will be BURNED)
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// Reserve vault — holds the 30% (300M) reserved for Raydium liquidity
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

    /// Treasury token account — receives the 300M reserve tokens to seed Raydium pool.
    /// Must already exist before calling this instruction.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// Token creator — receives graduation bonus (5% of SOL)
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
    /// SOL going to Raydium pool (90% of raised SOL)
    pub real_sol_reserves: u64,
    /// Tokens going to Raydium pool (always 300M reserve tokens)
    pub real_token_reserves: u64,
    /// Unsold curve tokens that were burned
    pub tokens_burned: u64,
    pub total_volume_sol: u64,
    pub total_trades: u64,
    pub timestamp: i64,
}

pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
    let bonding_curve = &ctx.accounts.bonding_curve;

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

    let total_sol     = bonding_curve.real_sol_reserves;
    let unsold_tokens = ctx.accounts.token_vault.amount;   // 70% bucket — will be BURNED
    let reserve_tokens = ctx.accounts.reserve_vault.amount; // 30% bucket — goes to Raydium
    let creator       = bonding_curve.creator;
    let total_volume  = bonding_curve.total_volume_sol;
    let total_trades  = bonding_curve.total_trades;

    msg!("[graduate] total_sol={} unsold_tokens={} reserve_tokens={}",
        total_sol, unsold_tokens, reserve_tokens);

    // ── SOL split ────────────────────────────────────────────────────────────────
    //   5%  → creator (graduation reward)
    //   5%  → treasury (platform fee)
    //   90% → treasury (to seed Raydium pool)
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

    msg!("[graduate] treasury_cut={} creator_bonus={} liquidity_sol={}",
        treasury_cut, creator_bonus, liquidity_sol);

    // ── Step 1: Transfer 300M reserve tokens → treasury ATA (for Raydium pool) ─
    if reserve_tokens > 0 {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TokenTransfer {
                    from: ctx.accounts.reserve_vault.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                signer_seeds,
            ),
            reserve_tokens,
        )?;
        msg!("[graduate] Sent {} reserve tokens to treasury for Raydium pool", reserve_tokens);
    }

    // ── Step 2: BURN unsold curve tokens (deflationary) ─────────────────────────
    // Unsold tokens from the 70% curve bucket are permanently destroyed.
    // This reduces total supply and benefits existing token holders.
    if unsold_tokens > 0 {
        burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.token_vault.to_account_info(),
                    authority: ctx.accounts.bonding_curve.to_account_info(),
                },
                signer_seeds,
            ),
            unsold_tokens,
        )?;
        msg!("[graduate] Burned {} unsold curve tokens", unsold_tokens);
    }

    // ── Step 3: SOL distribution (after token CPIs, matching sell.rs pattern) ───
    {
        let bc_info = ctx.accounts.bonding_curve.to_account_info();
        let mut bc_lamps = bc_info.try_borrow_mut_lamports()?;
        msg!("[graduate] bc_lamps={} subtracting={}", **bc_lamps, total_sol);
        **bc_lamps = bc_lamps
            .checked_sub(total_sol)
            .ok_or(TokenLaunchError::MathOverflow)?;
    }

    // Treasury receives platform fee (5%) + liquidity SOL (90%) = 95%
    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? +=
        treasury_cut.checked_add(liquidity_sol).ok_or(TokenLaunchError::MathOverflow)?;

    // Creator receives graduation bonus (5%)
    **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += creator_bonus;

    // ── Update bonding curve state ───────────────────────────────────────────────
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    bonding_curve.real_sol_reserves = 0;
    bonding_curve.real_token_reserves = 0;

    let timestamp = Clock::get()?.unix_timestamp;

    emit!(GraduationEvent {
        mint: mint_key,
        creator,
        real_sol_reserves: liquidity_sol,    // 90% SOL → Raydium pool
        real_token_reserves: reserve_tokens, // 300M reserve tokens → Raydium pool
        tokens_burned: unsold_tokens,        // unsold curve tokens destroyed
        total_volume_sol: total_volume,
        total_trades,
        timestamp,
    });

    Ok(())
}
