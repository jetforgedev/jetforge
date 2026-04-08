use anchor_lang::prelude::*;

/// Initial virtual SOL reserves (30 SOL in lamports)
pub const INITIAL_VIRTUAL_SOL: u64 = 30_000_000_000;

/// Initial virtual token reserves
pub const INITIAL_VIRTUAL_TOKENS: u64 = 1_073_000_191_000_000;

/// Total token supply (1 billion tokens with 6 decimals)
pub const TOTAL_SUPPLY: u64 = 1_000_000_000_000_000;

/// Tokens available for trading on the bonding curve (70% of total supply)
/// 700M tokens purchasable by users — unsold ones are BURNED at graduation
pub const REAL_TOKEN_RESERVES_INIT: u64 = 700_000_000_000_000;

/// Tokens locked in reserve vault for DEX liquidity at graduation (30% of total supply)
/// These 300M tokens are NEVER for sale — they ALWAYS seed the Raydium CPMM pool
pub const RESERVE_TOKEN_AMOUNT: u64 = 300_000_000_000_000;

/// Graduation threshold in lamports (0.5 SOL for local testing)
pub const GRADUATION_THRESHOLD: u64 = 500_000_000;

/// Fee in basis points (1%)
pub const FEE_BPS: u64 = 100;

/// Total basis points
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Creator fee share of total fee (40%)
pub const CREATOR_FEE_SHARE: u64 = 40;

/// Treasury fee share of total fee (40%)
pub const TREASURY_FEE_SHARE: u64 = 40;

/// Buyback-and-burn fee share of total fee (20%)
pub const BUYBACK_FEE_SHARE: u64 = 20;

/// Minimum SOL accumulated before a buyback is triggered (0.1 SOL)
pub const BUYBACK_THRESHOLD: u64 = 100_000_000;

/// Fee share denominator
pub const FEE_SHARE_DENOMINATOR: u64 = 100;

/// Treasury share of total raised SOL at graduation (5%)
pub const GRADUATION_TREASURY_BPS: u64 = 500;

/// Creator reward share of total raised SOL at graduation (5%)
pub const GRADUATION_CREATOR_BPS: u64 = 500;

#[account]
pub struct BondingCurveState {
    /// The token mint address
    pub mint: Pubkey,
    /// Creator's public key
    pub creator: Pubkey,
    /// Virtual SOL reserves (includes initial 30 SOL offset)
    pub virtual_sol_reserves: u64,
    /// Virtual token reserves
    pub virtual_token_reserves: u64,
    /// Actual SOL collected from trades
    pub real_sol_reserves: u64,
    /// Actual tokens available for sale
    pub real_token_reserves: u64,
    /// Total token supply
    pub token_total_supply: u64,
    /// Whether curve has graduated to a DEX
    pub complete: bool,
    /// Unix timestamp of creation
    pub created_at: i64,
    /// Total SOL volume traded
    pub total_volume_sol: u64,
    /// Total number of trades
    pub total_trades: u64,
    /// PDA bump
    pub bump: u8,
}

impl BondingCurveState {
    /// Account discriminator (8) + fields
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 8 + 1;

    /// Calculate tokens out for a given SOL input (after fee)
    /// Uses constant product formula: k = virtual_sol * virtual_token
    pub fn get_tokens_for_sol(&self, sol_in_after_fee: u64) -> Option<u64> {
        let k = (self.virtual_sol_reserves as u128)
            .checked_mul(self.virtual_token_reserves as u128)?;

        let new_virtual_sol = (self.virtual_sol_reserves as u128)
            .checked_add(sol_in_after_fee as u128)?;

        let new_virtual_token = k.checked_div(new_virtual_sol)?;

        let tokens_out = (self.virtual_token_reserves as u128)
            .checked_sub(new_virtual_token)?;

        // Ensure we have enough real tokens
        if tokens_out > self.real_token_reserves as u128 {
            return None;
        }

        u64::try_from(tokens_out).ok()
    }

    /// Calculate SOL out for a given token input (before fee deduction)
    /// Uses constant product formula: k = virtual_sol * virtual_token
    pub fn get_sol_for_tokens(&self, token_in: u64) -> Option<u64> {
        let k = (self.virtual_sol_reserves as u128)
            .checked_mul(self.virtual_token_reserves as u128)?;

        let new_virtual_token = (self.virtual_token_reserves as u128)
            .checked_add(token_in as u128)?;

        let new_virtual_sol = k.checked_div(new_virtual_token)?;

        let sol_out = (self.virtual_sol_reserves as u128)
            .checked_sub(new_virtual_sol)?;

        // Cap at real SOL reserves — can never extract more than was deposited
        let sol_out_capped = sol_out.min(self.real_sol_reserves as u128);

        u64::try_from(sol_out_capped).ok()
    }

    /// Current price of token in lamports per token (6 decimals)
    pub fn current_price(&self) -> Option<u64> {
        let price = (self.virtual_sol_reserves as u128)
            .checked_mul(1_000_000)? // scale by token decimals
            .checked_div(self.virtual_token_reserves as u128)?;
        u64::try_from(price).ok()
    }

    /// Market cap in lamports
    pub fn market_cap(&self) -> Option<u64> {
        let price = self.current_price()?;
        let market_cap = (price as u128)
            .checked_mul(self.token_total_supply as u128)?
            .checked_div(1_000_000)?; // divide by token decimals
        u64::try_from(market_cap).ok()
    }

    /// Apply buy: update reserves after purchase
    pub fn apply_buy(&mut self, sol_in_after_fee: u64, tokens_out: u64) {
        self.virtual_sol_reserves = self.virtual_sol_reserves.saturating_add(sol_in_after_fee);
        self.virtual_token_reserves = self.virtual_token_reserves.saturating_sub(tokens_out);
        self.real_sol_reserves = self.real_sol_reserves.saturating_add(sol_in_after_fee);
        self.real_token_reserves = self.real_token_reserves.saturating_sub(tokens_out);
    }

    /// Apply sell: update reserves after sale
    pub fn apply_sell(&mut self, tokens_in: u64, sol_out_before_fee: u64) {
        self.virtual_token_reserves = self.virtual_token_reserves.saturating_add(tokens_in);
        self.virtual_sol_reserves = self.virtual_sol_reserves.saturating_sub(sol_out_before_fee);
        self.real_token_reserves = self.real_token_reserves.saturating_add(tokens_in);
        self.real_sol_reserves = self.real_sol_reserves.saturating_sub(sol_out_before_fee);
    }

    /// Check if graduation threshold is reached
    pub fn should_graduate(&self) -> bool {
        self.real_sol_reserves >= GRADUATION_THRESHOLD
    }
}
