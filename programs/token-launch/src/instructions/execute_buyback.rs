use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{burn, Burn, Mint, Token, TokenAccount},
};

use crate::{
    errors::TokenLaunchError,
    state::{BondingCurveState, BUYBACK_THRESHOLD},
};

#[derive(Accounts)]
pub struct ExecuteBuyback<'info> {
    /// Anyone can trigger — trustless permissionless buyback
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
    )]
    pub bonding_curve: Account<'info, BondingCurveState>,

    /// Bonding curve's token vault — tokens are burned from here
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub token_vault: Account<'info, TokenAccount>,

    /// CHECK: validated by PDA seeds [b"buyback_vault", mint]
    #[account(
        mut,
        seeds = [b"buyback_vault", mint.key().as_ref()],
        bump,
    )]
    pub buyback_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct BuybackEvent {
    pub mint: Pubkey,
    pub triggered_by: Pubkey,
    pub sol_used: u64,
    pub tokens_burned: u64,
    pub new_virtual_sol: u64,
    pub new_virtual_tokens: u64,
    pub new_real_sol: u64,
    pub new_real_tokens: u64,
    pub timestamp: i64,
}

pub fn execute_buyback(ctx: Context<ExecuteBuyback>) -> Result<()> {
    let bonding_curve = &ctx.accounts.bonding_curve;

    // Only active (non-graduated) tokens can trigger buybacks
    require!(!bonding_curve.complete, TokenLaunchError::TokenGraduated);

    // Calculate available SOL (total minus rent minimum to keep account alive)
    let rent_min = Rent::get()?.minimum_balance(0);
    let vault_lamports = ctx.accounts.buyback_vault.lamports();
    let available_sol = vault_lamports.saturating_sub(rent_min);

    require!(available_sol >= BUYBACK_THRESHOLD, TokenLaunchError::BuybackThresholdNotMet);

    // How many tokens can we buy with this SOL at current curve price?
    let tokens_to_burn = bonding_curve
        .get_tokens_for_sol(available_sol)
        .ok_or(TokenLaunchError::MathOverflow)?;

    require!(tokens_to_burn > 0, TokenLaunchError::InvalidAmount);
    require!(
        tokens_to_burn <= bonding_curve.real_token_reserves,
        TokenLaunchError::TokenSupplyExhausted
    );

    let mint_key = ctx.accounts.mint.key();
    let bc_bump = ctx.accounts.bonding_curve.bump;
    let bc_seeds: &[&[u8]] = &[b"bonding_curve", mint_key.as_ref(), &[bc_bump]];

    let (_, bb_bump) = Pubkey::find_program_address(
        &[b"buyback_vault", mint_key.as_ref()],
        ctx.program_id,
    );
    let bb_seeds: &[&[u8]] = &[b"buyback_vault", mint_key.as_ref(), &[bb_bump]];

    // Transfer accumulated SOL: buyback_vault → bonding_curve
    // This increases the curve's SOL reserves, pushing the price up
    anchor_lang::solana_program::program::invoke_signed(
        &system_instruction::transfer(
            &ctx.accounts.buyback_vault.key(),
            &ctx.accounts.bonding_curve.key(),
            available_sol,
        ),
        &[
            ctx.accounts.buyback_vault.to_account_info(),
            ctx.accounts.bonding_curve.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[bb_seeds],
    )?;

    // Burn the equivalent tokens from the bonding curve's token vault
    // bonding_curve PDA is the authority over its own ATA (token_vault)
    burn(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
            &[bc_seeds],
        ),
        tokens_to_burn,
    )?;

    // Update curve state: same as apply_buy (SOL added, tokens removed)
    let bonding_curve = &mut ctx.accounts.bonding_curve;
    bonding_curve.apply_buy(available_sol, tokens_to_burn)?;

    // Buyback could push the curve to graduation
    if bonding_curve.should_graduate() {
        bonding_curve.complete = true;
    }

    emit!(BuybackEvent {
        mint: mint_key,
        triggered_by: ctx.accounts.payer.key(),
        sol_used: available_sol,
        tokens_burned: tokens_to_burn,
        new_virtual_sol: bonding_curve.virtual_sol_reserves,
        new_virtual_tokens: bonding_curve.virtual_token_reserves,
        new_real_sol: bonding_curve.real_sol_reserves,
        new_real_tokens: bonding_curve.real_token_reserves,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
