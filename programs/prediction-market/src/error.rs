use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Market has ended, trading is closed")]
    MarketEnded,
    
    #[msg("Market has not ended yet")]
    MarketNotEnded,
    
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    
    #[msg("Question is too long (max 200 characters)")]
    QuestionTooLong,
    
    #[msg("Description is too long (max 500 characters)")]
    DescriptionTooLong,
    
    #[msg("End timestamp must be in the future")]
    InvalidEndTimestamp,
    
    #[msg("Bet amount is below minimum (1 USDC)")]
    BetTooSmall,
    
    #[msg("Bet amount exceeds maximum (200 USDC)")]
    BetTooLarge,
    
    #[msg("No winnings to claim")]
    NoWinnings,
    
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    
    #[msg("Math overflow occurred")]
    MathOverflow,
    
    #[msg("Market creation amount too small (minimum 1 USDC)")]
    CreationAmountTooSmall,
    
    #[msg("Invalid side index")]
    InvalidSideIndex,
    
    #[msg("Too many sides (maximum 10)")]
    TooManySides,
    
    #[msg("Too few sides (minimum 2)")]
    TooFewSides,
    
    #[msg("Side name is too long (max 50 characters)")]
    SideNameTooLong,
    
    #[msg("Duplicate side names not allowed")]
    DuplicateSideName,
    
    #[msg("Only market creator can resolve")]
    UnauthorizedResolver,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("Insufficient token balance")]
    InsufficientBalance,
}