use anchor_lang::prelude::*;

/// Main market account storing all market data
#[account]
pub struct Market {
    pub creator: Pubkey,           // Who created the market
    pub question: String,          // The prediction question
    pub description: String,       // Additional context
    pub end_timestamp: i64,        // When trading closes
    pub yes_pool: u64,            // SOL in YES pool (lamports)
    pub no_pool: u64,             // SOL in NO pool (lamports)
    pub k: u128,                  // Constant product for AMM (yes_pool * no_pool)
    pub total_yes_shares: u64,    // Total YES shares issued
    pub total_no_shares: u64,     // Total NO shares issued
    pub treasury_fee: u64,        // Accumulated fees (2% of bets)
    pub creation_fee: u64,        // Fee paid to create market
    pub total_volume: u64,        // Total amount bet
    pub num_bettors: u32,         // Number of unique bettors
    pub bump: u8,                 // PDA bump seed
}

impl Market {
    pub const LEN: usize = 8 +    // discriminator
        32 +                       // creator
        4 + 200 +                  // question (max 200 chars)
        4 + 500 +                  // description (max 500 chars)
        8 +                        // end_timestamp
        8 +                        // yes_pool
        8 +                        // no_pool
        16 +                       // k
        8 +                        // total_yes_shares
        8 +                        // total_no_shares
        8 +                        // treasury_fee
        8 +                        // creation_fee
        8 +                        // total_volume
        4 +                        // num_bettors
        1;                         // bump

    /// Check if market is still active (before end time)
    pub fn is_active(&self, current_timestamp: i64) -> bool {
        current_timestamp < self.end_timestamp
    }

    /// Get current price for YES (between 0 and 1)
    pub fn get_yes_price(&self) -> u64 {
        if self.yes_pool == 0 || self.no_pool == 0 {
            return 5000; // 50% in basis points (1% = 100 bp)
        }
        let total = self.yes_pool + self.no_pool;
        ((self.no_pool as u128 * 10000) / total as u128) as u64
    }

    /// Get current price for NO
    pub fn get_no_price(&self) -> u64 {
        10000 - self.get_yes_price()
    }

    /// Calculate shares received for buying YES
    pub fn calculate_yes_shares(&self, amount_in: u64) -> Result<u64> {
        let new_no_pool = self.no_pool.checked_add(amount_in)
            .ok_or(error::ErrorCode::MathOverflow)?;
        
        let new_yes_pool = (self.k / new_no_pool as u128) as u64;
        
        Ok(self.yes_pool.checked_sub(new_yes_pool)
            .ok_or(error::ErrorCode::MathOverflow)?)
    }

    /// Calculate shares received for buying NO
    pub fn calculate_no_shares(&self, amount_in: u64) -> Result<u64> {
        let new_yes_pool = self.yes_pool.checked_add(amount_in)
            .ok_or(error::ErrorCode::MathOverflow)?;
        
        let new_no_pool = (self.k / new_yes_pool as u128) as u64;
        
        Ok(self.no_pool.checked_sub(new_no_pool)
            .ok_or(error::ErrorCode::MathOverflow)?)
    }

    /// Calculate proportional payout for YES shares after market ends
    pub fn calculate_yes_payout(&self, yes_shares: u64) -> u64 {
        if self.total_yes_shares == 0 {
            return 0;
        }
        let total_pool = self.yes_pool + self.no_pool;
        let yes_pool_share = (self.yes_pool as u128 * total_pool as u128) / (self.yes_pool + self.no_pool) as u128;
        ((yes_pool_share * yes_shares as u128) / self.total_yes_shares as u128) as u64
    }

    /// Calculate proportional payout for NO shares after market ends
    pub fn calculate_no_payout(&self, no_shares: u64) -> u64 {
        if self.total_no_shares == 0 {
            return 0;
        }
        let total_pool = self.yes_pool + self.no_pool;
        let no_pool_share = (self.no_pool as u128 * total_pool as u128) / (self.yes_pool + self.no_pool) as u128;
        ((no_pool_share * no_shares as u128) / self.total_no_shares as u128) as u64
    }
}

/// User's position in a specific market
#[account]
pub struct UserPosition {
    pub user: Pubkey,              // Who owns this position
    pub market: Pubkey,            // Which market
    pub yes_shares: u64,           // How many YES shares
    pub no_shares: u64,            // How many NO shares
    pub amount_invested: u64,      // Total SOL invested
    pub claimed: bool,             // Has user claimed winnings?
    pub bump: u8,                  // PDA bump
}

impl UserPosition {
    pub const LEN: usize = 8 +     // discriminator
        32 +                        // user
        32 +                        // market
        8 +                         // yes_shares
        8 +                         // no_shares
        8 +                         // amount_invested
        1 +                         // claimed
        1;                          // bump

    /// Calculate potential payout if market resolves to outcome
    pub fn calculate_payout(&self, outcome: bool, market: &Market) -> u64 {
        if outcome {
            // YES won - each YES share is worth 1 SOL
            self.yes_shares
        } else {
            // NO won - each NO share is worth 1 SOL
            self.no_shares
        }
    }
}

/// Global treasury for platform fees
#[account]
pub struct Treasury {
    pub authority: Pubkey,         // Who can withdraw fees
    pub total_fees: u64,           // Total fees accumulated
    pub total_markets: u32,        // Number of markets created
    pub total_volume: u64,         // All-time trading volume
    pub bump: u8,
}

impl Treasury {
    pub const LEN: usize = 8 +     // discriminator
        32 +                        // authority
        8 +                         // total_fees
        4 +                         // total_markets
        8 +                         // total_volume
        1;                          // bump
}