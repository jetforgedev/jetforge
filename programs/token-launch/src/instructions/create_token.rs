use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::token::{initialize_mint2, InitializeMint2};

use crate::state::{
    BondingCurveState, INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKENS, REAL_TOKEN_RESERVES_INIT,
    RESERVE_TOKEN_AMOUNT, TOTAL_SUPPLY,
};

// Well-known program IDs (hard-coded to avoid passing them)
pub const SPL_TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const ASSOC_TOKEN_PROGRAM_ID: Pubkey = pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
pub const TOKEN_METADATA_PROGRAM_ID: Pubkey = pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

/// Minimal accounts struct — all PDAs/programs as UncheckedAccount to stay under
/// the 4096-byte BPF stack-frame limit that Anchor's typed try_accounts blows through.
#[derive(Accounts)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: New mint keypair — validated below (must be empty, must sign)
    #[account(mut, signer)]
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Bonding curve PDA — derived and validated in instruction
    #[account(mut)]
    pub bonding_curve: UncheckedAccount<'info>,

    /// CHECK: Token vault (ATA of bonding curve for mint) — validated in instruction
    #[account(mut)]
    pub token_vault: UncheckedAccount<'info>,

    /// CHECK: Reserve vault PDA — validated in instruction
    #[account(mut)]
    pub reserve_vault: UncheckedAccount<'info>,

    /// CHECK: Buyback vault PDA — system-owned, accumulates 20% of all trading fees
    #[account(mut)]
    pub buyback_vault: UncheckedAccount<'info>,

    /// CHECK: Creator vault PDA — system-owned, accumulates 40% of all trading fees for creator
    #[account(mut)]
    pub creator_vault: UncheckedAccount<'info>,

    /// CHECK: Metaplex metadata PDA — created in instruction via CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: SPL Token program
    pub token_program: UncheckedAccount<'info>,

    /// CHECK: Associated Token program
    pub associated_token_program: UncheckedAccount<'info>,

    /// CHECK: Metaplex Token Metadata program
    pub token_metadata_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[event]
pub struct TokenCreatedEvent {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub virtual_sol_reserves: u64,
    pub virtual_token_reserves: u64,
    pub real_token_reserves: u64,
    pub timestamp: i64,
}

pub fn create_token(
    ctx: Context<CreateToken>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {
    // Length bounds
    require!(name.len() >= 1 && name.len() <= 32, crate::errors::TokenLaunchError::InvalidMetadata);
    require!(symbol.len() >= 1 && symbol.len() <= 10, crate::errors::TokenLaunchError::InvalidMetadata);
    require!(uri.len() <= 200, crate::errors::TokenLaunchError::InvalidMetadata);

    // Name and symbol: ASCII printable only (0x20–0x7E), no control chars or Unicode tricks
    require!(
        name.bytes().all(|b| b >= 0x20 && b <= 0x7e),
        crate::errors::TokenLaunchError::InvalidMetadata
    );
    require!(
        symbol.bytes().all(|b| b >= 0x20 && b <= 0x7e),
        crate::errors::TokenLaunchError::InvalidMetadata
    );
    // Must contain at least one non-space character
    require!(name.trim_ascii().len() > 0, crate::errors::TokenLaunchError::InvalidMetadata);
    require!(symbol.trim_ascii().len() > 0, crate::errors::TokenLaunchError::InvalidMetadata);

    // Block dangerous URI schemes (javascript:/data: injection); allow empty, https, http, ipfs, ar
    require!(
        uri.is_empty()
            || uri.starts_with("https://")
            || uri.starts_with("http://")
            || uri.starts_with("ipfs://")
            || uri.starts_with("ar://"),
        crate::errors::TokenLaunchError::InvalidMetadata
    );

    // Validate programs
    require_keys_eq!(
        ctx.accounts.token_program.key(),
        SPL_TOKEN_PROGRAM_ID,
        crate::errors::TokenLaunchError::InvalidMint
    );

    let mint_key = ctx.accounts.mint.key();
    let creator_key = ctx.accounts.creator.key();
    let program_id = ctx.program_id;

    // ── 1. Derive and validate bonding curve PDA ─────────────────────────────
    let (bonding_curve_key, bc_bump) = Pubkey::find_program_address(
        &[b"bonding_curve", mint_key.as_ref()],
        program_id,
    );
    require_keys_eq!(
        ctx.accounts.bonding_curve.key(),
        bonding_curve_key,
        crate::errors::TokenLaunchError::InvalidMint
    );

    // ── 2. Create the mint account ────────────────────────────────────────────
    let mint_space: u64 = 82;
    let mint_lamports = Rent::get()?.minimum_balance(mint_space as usize);
    create_account(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.mint.to_account_info(),
            },
        ),
        mint_lamports,
        mint_space,
        &SPL_TOKEN_PROGRAM_ID,
    )?;

    // ── 3. Initialize mint (authority = bonding_curve PDA) ───────────────────
    let bc_seeds: &[&[u8]] = &[b"bonding_curve", mint_key.as_ref(), &[bc_bump]];
    initialize_mint2(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            InitializeMint2 {
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        6,
        &bonding_curve_key,
        Some(&bonding_curve_key),
    )?;

    // ── 4. Create bonding curve PDA account ──────────────────────────────────
    let bc_space = BondingCurveState::SPACE as u64;
    let bc_lamports = Rent::get()?.minimum_balance(BondingCurveState::SPACE);
    create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.bonding_curve.to_account_info(),
            },
            &[bc_seeds],
        ),
        bc_lamports,
        bc_space,
        program_id,
    )?;

    // ── 5. Init BondingCurveState ─────────────────────────────────────────────
    let bc_account = &ctx.accounts.bonding_curve;
    let mut data = bc_account.try_borrow_mut_data()?;

    // Write discriminator (BondingCurveState)
    let discriminator = [182u8, 185, 75, 193, 72, 40, 132, 153];
    data[..8].copy_from_slice(&discriminator);

    // Write fields using Borsh
    let state = BondingCurveState {
        mint: mint_key,
        creator: creator_key,
        virtual_sol_reserves: INITIAL_VIRTUAL_SOL,
        virtual_token_reserves: INITIAL_VIRTUAL_TOKENS,
        real_sol_reserves: 0,
        real_token_reserves: REAL_TOKEN_RESERVES_INIT,
        token_total_supply: TOTAL_SUPPLY,
        complete: false,
        created_at: Clock::get()?.unix_timestamp,
        total_volume_sol: 0,
        total_trades: 0,
        bump: bc_bump,
    };
    use anchor_lang::AnchorSerialize;
    state.serialize(&mut &mut data[8..])?;
    drop(data);

    // ── 6. Create token vault (ATA for bonding_curve) ────────────────────────
    // ATA creation via Associated Token Program CPI
    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::instruction::Instruction {
            program_id: ASSOC_TOKEN_PROGRAM_ID,
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.creator.key(), true),
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.token_vault.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(bonding_curve_key, false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(mint_key, false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(SPL_TOKEN_PROGRAM_ID, false),
            ],
            data: vec![],  // "create" discriminator (idempotent create)
        },
        &[
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.token_vault.to_account_info(),
            ctx.accounts.bonding_curve.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
    )?;

    // ── 7. Create reserve vault (PDA token account) ───────────────────────────
    let (reserve_vault_key, rv_bump) = Pubkey::find_program_address(
        &[b"reserve_vault", mint_key.as_ref()],
        program_id,
    );
    require_keys_eq!(
        ctx.accounts.reserve_vault.key(),
        reserve_vault_key,
        crate::errors::TokenLaunchError::InvalidMint
    );

    let token_account_space: u64 = 165;
    let token_account_lamports = Rent::get()?.minimum_balance(token_account_space as usize);
    let rv_seeds: &[&[u8]] = &[b"reserve_vault", mint_key.as_ref(), &[rv_bump]];

    create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.reserve_vault.to_account_info(),
            },
            &[rv_seeds],
        ),
        token_account_lamports,
        token_account_space,
        &SPL_TOKEN_PROGRAM_ID,
    )?;

    // Initialize reserve vault using anchor_spl helper (handles discriminator correctly).
    anchor_spl::token::initialize_account3(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::InitializeAccount3 {
                account: ctx.accounts.reserve_vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
        ),
    )?;

    // ── 8. Mint trading supply to token vault ────────────────────────────────
    anchor_lang::solana_program::program::invoke_signed(
        &anchor_lang::solana_program::instruction::Instruction {
            program_id: SPL_TOKEN_PROGRAM_ID,
            accounts: vec![
                anchor_lang::solana_program::instruction::AccountMeta::new(mint_key, false),
                anchor_lang::solana_program::instruction::AccountMeta::new(ctx.accounts.token_vault.key(), false),
                anchor_lang::solana_program::instruction::AccountMeta::new_readonly(bonding_curve_key, true),
            ],
            data: {
                // MintTo instruction = 7, then u64 amount
                let mut d = vec![7u8];
                d.extend_from_slice(&REAL_TOKEN_RESERVES_INIT.to_le_bytes());
                d
            },
        },
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.token_vault.to_account_info(),
            ctx.accounts.bonding_curve.to_account_info(),
        ],
        &[bc_seeds],
    )?;

    // ── 9. Mint reserve supply to reserve vault (skipped when RESERVE_TOKEN_AMOUNT = 0) ─
    if RESERVE_TOKEN_AMOUNT > 0 {
        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::instruction::Instruction {
                program_id: SPL_TOKEN_PROGRAM_ID,
                accounts: vec![
                    anchor_lang::solana_program::instruction::AccountMeta::new(mint_key, false),
                    anchor_lang::solana_program::instruction::AccountMeta::new(reserve_vault_key, false),
                    anchor_lang::solana_program::instruction::AccountMeta::new_readonly(bonding_curve_key, true),
                ],
                data: {
                    let mut d = vec![7u8];
                    d.extend_from_slice(&RESERVE_TOKEN_AMOUNT.to_le_bytes());
                    d
                },
            },
            &[
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.reserve_vault.to_account_info(),
                ctx.accounts.bonding_curve.to_account_info(),
            ],
            &[bc_seeds],
        )?;
    }

    // ── 10. Create buyback vault (system-owned PDA, accumulates 20% of fees) ──
    let (buyback_vault_key, bb_bump) = Pubkey::find_program_address(
        &[b"buyback_vault", mint_key.as_ref()],
        program_id,
    );
    require_keys_eq!(
        ctx.accounts.buyback_vault.key(),
        buyback_vault_key,
        crate::errors::TokenLaunchError::InvalidMint
    );

    let bb_rent = Rent::get()?.minimum_balance(0);
    let bb_seeds: &[&[u8]] = &[b"buyback_vault", mint_key.as_ref(), &[bb_bump]];
    create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.buyback_vault.to_account_info(),
            },
            &[bb_seeds],
        ),
        bb_rent,
        0,
        &anchor_lang::system_program::ID,
    )?;

    // ── 11. Create creator vault (system-owned PDA, accumulates 40% of fees) ───
    let (creator_vault_key, cv_bump) = Pubkey::find_program_address(
        &[b"creator_vault", mint_key.as_ref()],
        program_id,
    );
    require_keys_eq!(
        ctx.accounts.creator_vault.key(),
        creator_vault_key,
        crate::errors::TokenLaunchError::InvalidMint
    );

    let cv_rent = Rent::get()?.minimum_balance(0);
    let cv_seeds: &[&[u8]] = &[b"creator_vault", mint_key.as_ref(), &[cv_bump]];
    create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.creator_vault.to_account_info(),
            },
            &[cv_seeds],
        ),
        cv_rent,
        0,
        &anchor_lang::system_program::ID,
    )?;

    // ── 12. Create Metaplex Token Metadata account ───────────────────────────
    // Derive and validate the metadata PDA
    let (metadata_key, _meta_bump) = Pubkey::find_program_address(
        &[
            b"metadata",
            TOKEN_METADATA_PROGRAM_ID.as_ref(),
            mint_key.as_ref(),
        ],
        &TOKEN_METADATA_PROGRAM_ID,
    );
    require_keys_eq!(
        ctx.accounts.metadata.key(),
        metadata_key,
        crate::errors::TokenLaunchError::InvalidMetadata
    );
    require_keys_eq!(
        ctx.accounts.token_metadata_program.key(),
        TOKEN_METADATA_PROGRAM_ID,
        crate::errors::TokenLaunchError::InvalidMetadata
    );

    // Manually Borsh-encode the CreateMetadataAccountV3 instruction data.
    // Discriminator 33 = CreateMetadataAccountV3 in mpl-token-metadata.
    let ix_data = {
        let name_bytes  = name.as_bytes();
        let sym_bytes   = symbol.as_bytes();
        let uri_bytes   = uri.as_bytes();

        let mut data = Vec::with_capacity(
            1                           // discriminator
            + 4 + name_bytes.len()      // name (u32 len + bytes)
            + 4 + sym_bytes.len()       // symbol
            + 4 + uri_bytes.len()       // uri
            + 2                         // seller_fee_basis_points
            + 1                         // creators: None
            + 1                         // collection: None
            + 1                         // uses: None
            + 1                         // is_mutable
            + 1,                        // collection_details: None
        );

        data.push(33u8); // CreateMetadataAccountV3 discriminator

        // DataV2 — name
        data.extend_from_slice(&(name_bytes.len() as u32).to_le_bytes());
        data.extend_from_slice(name_bytes);
        // symbol
        data.extend_from_slice(&(sym_bytes.len() as u32).to_le_bytes());
        data.extend_from_slice(sym_bytes);
        // uri
        data.extend_from_slice(&(uri_bytes.len() as u32).to_le_bytes());
        data.extend_from_slice(uri_bytes);
        // seller_fee_basis_points: 0 (no royalties)
        data.extend_from_slice(&0u16.to_le_bytes());
        // creators: None
        data.push(0u8);
        // collection: None
        data.push(0u8);
        // uses: None
        data.push(0u8);

        // is_mutable: true (creator can update later)
        data.push(1u8);
        // collection_details: None
        data.push(0u8);

        data
    };

    // Accounts for CreateMetadataAccountV3:
    // 0. metadata     [writable]
    // 1. mint         [readonly]
    // 2. mint_auth    [readonly, signer]  ← bonding curve PDA
    // 3. payer        [writable, signer]  ← creator
    // 4. update_auth  [readonly]          ← creator (holds update rights)
    // 5. system_prog  [readonly]
    let metadata_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: TOKEN_METADATA_PROGRAM_ID,
        accounts: vec![
            anchor_lang::solana_program::instruction::AccountMeta::new(metadata_key, false),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(mint_key, false),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(bonding_curve_key, true),
            anchor_lang::solana_program::instruction::AccountMeta::new(creator_key, true),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(creator_key, false),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
        ],
        data: ix_data,
    };

    // invoke_signed so the bonding curve PDA can sign as mint authority
    anchor_lang::solana_program::program::invoke_signed(
        &metadata_ix,
        &[
            ctx.accounts.metadata.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.bonding_curve.to_account_info(),
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_metadata_program.to_account_info(),
        ],
        &[bc_seeds],
    )?;

    emit!(TokenCreatedEvent {
        mint: mint_key,
        creator: creator_key,
        name,
        symbol,
        uri,
        virtual_sol_reserves: INITIAL_VIRTUAL_SOL,
        virtual_token_reserves: INITIAL_VIRTUAL_TOKENS,
        real_token_reserves: REAL_TOKEN_RESERVES_INIT,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
