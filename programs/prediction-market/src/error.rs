use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    
    #[msg("Market has not ended yet")]
    MarketNotEnded,
    
    #[msg("Market has ended, betting is closed")]
    MarketEnded,
    
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
    
    #[msg("Market has not been resolved yet")]
    MarketNotResolved,
    
    #[msg("No winnings to claim")]
    NoWinnings,
    
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    
    #[msg("Only market creator can resolve")]
    UnauthorizedResolver,
    
    #[msg("Math overflow occurred")]
    MathOverflow,
    
    #[msg("Initial liquidity too small (minimum 1 SOL)")]
    LiquidityTooSmall,
    
    #[msg("Invalid pool state")]
    InvalidPoolState,
}