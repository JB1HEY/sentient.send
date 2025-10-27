use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Market has ended, trading is closed")]
    MarketEnded,
    
    #[msg("Market has not ended yet")]
    MarketNotEnded,
    
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    
    #[msg("Insufficient funds for this bet")]
    InsufficientFunds,
    
    #[msg("Question is too long (max 200 characters)")]
    QuestionTooLong,
    
    #[msg("Description is too long (max 500 characters)")]
    DescriptionTooLong,
    
    #[msg("End timestamp must be in the future")]
    InvalidEndTimestamp,
    
    #[msg("Bet amount is too small (minimum 0.01 SOL)")]
    BetTooSmall,
    
    #[msg("No winnings to claim")]
    NoWinnings,
    
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    
    #[msg("Math overflow occurred")]
    MathOverflow,
    
    #[msg("Initial liquidity too small (minimum 1 SOL)")]
    LiquidityTooSmall,
    
    #[msg("Invalid pool state")]
    InvalidPoolState,
}