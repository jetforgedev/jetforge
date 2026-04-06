use anchor_lang::prelude::*;

#[error_code]
pub enum TokenLaunchError {
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,

    #[msg("Token has already graduated to a DEX")]
    TokenGraduated,

    #[msg("Token has not yet graduated")]
    TokenNotGraduated,

    #[msg("Insufficient token balance")]
    InsufficientTokens,

    #[msg("Insufficient SOL reserves in bonding curve")]
    InsufficientSolReserves,

    #[msg("Invalid fee configuration")]
    InvalidFeeConfig,

    #[msg("Unauthorized: caller is not the creator")]
    Unauthorized,

    #[msg("Math overflow in calculation")]
    MathOverflow,

    #[msg("Graduation threshold not met")]
    GraduationThresholdNotMet,

    #[msg("Invalid token amount: must be greater than zero")]
    InvalidAmount,

    #[msg("Token supply exhausted")]
    TokenSupplyExhausted,

    #[msg("Invalid mint account")]
    InvalidMint,

    #[msg("Price impact too high")]
    PriceImpactTooHigh,

    #[msg("Buyback threshold not yet reached")]
    BuybackThresholdNotMet,

    #[msg("Invalid metadata: name and symbol must be non-empty and contain visible characters")]
    InvalidMetadata,
}
