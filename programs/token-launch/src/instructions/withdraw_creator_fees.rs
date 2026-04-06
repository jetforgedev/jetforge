use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use anchor_spl::token::Mint;
use crate::errors::TokenLaunchError;
use crate::state::BondingCurveState;

#[derive(Accounts)]
pub struct WithdrawCreatorFees<'info> {
    /// The token creator — must sign and match bonding_curve.creator
    #[account(mut)]
    pub creator: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
        has_one = mint,
        constraint = bonding_curve.creator == creator.key() @ TokenLaunchError::Unauthorized,
    )]
    pub bonding_curve: Account<'info, BondingCurveState>,

    /// Creator vault PDA — accumulates 40% of all trading fees
    /// CHECK: validated by PDA seeds [b"creator_vault", mint]
    #[account(
        mut,
        seeds = [b"creator_vault", mint.key().as_ref()],
        bump,
    )]
    pub creator_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct CreatorWithdrawEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

pub fn withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
    // Minimum rent-exempt balance to keep account alive
    let rent_min = Rent::get()?.minimum_balance(0);
    let vault_lamports = ctx.accounts.creator_vault.lamports();

    let withdrawable = vault_lamports.saturating_sub(rent_min);
    require!(withdrawable > 0, TokenLaunchError::InsufficientSolReserves);

    // creator_vault is a system-owned PDA — must use SystemProgram::Transfer
    // with PDA signer seeds (lamport manipulation is only valid for program-owned accounts).
    let mint_key = ctx.accounts.mint.key();
    let creator_vault_bump = ctx.bumps.creator_vault;
    let seeds: &[&[u8]] = &[b"creator_vault", mint_key.as_ref(), &[creator_vault_bump]];
    let signer_seeds = &[seeds];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.creator_vault.to_account_info(),
                to: ctx.accounts.creator.to_account_info(),
            },
            signer_seeds,
        ),
        withdrawable,
    )?;

    emit!(CreatorWithdrawEvent {
        mint: ctx.accounts.mint.key(),
        creator: ctx.accounts.creator.key(),
        amount: withdrawable,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
