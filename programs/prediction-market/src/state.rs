use anchor_lang::prelude::*;

/// Maximum number of sides allowed in a market
pub const MAX_SIDES: usize = 10;

/// Maximum length for side names
pub const MAX_SIDE_NAME_LENGTH: usize = 50;

/// Minimum bet amount in USDC (1 USDC = 1,000,000 because 6 decimals)
pub const MIN_BET: u64 = 1_000_000; // 1 USDC

/// Maximum bet amount in USDC (200 USDC)
pub const MAX_BET: u64 = 200_000_000; // 200 USDC

/// Minimum market creation amount (150 USDC)
pub const MIN_MARKET_CREATION: u64 = 150_000_000; // 150 USDC minimum

/// Bet fee in basis points (2% = 200 basis points)
pub const BET_FEE_BPS: u64 = 200;

/// Market creation fee in basis points (2% = 200 basis points)
pub const CREATION_FEE_BPS: u64 = 200;

/// Main market account
#[account]
pub struct Market {
    pub creator: Pubkey,                    // Market creator
    pub question: String,                   // Market question (max 200 chars)
    pub description: String,                // Market description (max 500 chars)
    pub end_timestamp: i64,                 // When market ends
    pub resolved: bool,                     // Has market been resolved?
    pub winning_side_index: u8,             // Index of winning side (if resolved)
    pub total_pool: u64,                    // Total USDC in the pool (before fee distribution)
    pub num_sides: u8,                      // Number of sides in this market
    pub sides: [Side; MAX_SIDES],           // Array of sides
    pub fee_pool: u64,                      // Accumulated fees (distributed at resolution)
    pub creator_fees_distributed: u64,      // Fees given to creator (after resolution)
    pub protocol_fees_distributed: u64,     // Fees given to protocol (after resolution)
    pub total_volume: u64,                  // Total volume traded
    pub num_bettors: u32,                   // Unique bettors
    pub creation_amount: u64,               // Initial USDC put in by creator
    pub bump: u8,                           // PDA bump
}

impl Market {
    // 8 (discriminator) + 32 (creator) + 4+200 (question) + 4+500 (description)
    // + 8 (timestamp) + 1 (resolved) + 1 (winning_side) + 8 (total_pool)
    // + 1 (num_sides) + (MAX_SIDES * Side::LEN) + 8 (fee_pool) + 8+8 (fees_distributed)
    // + 8 (volume) + 4 (num_bettors) + 8 (creation_amount) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 204 + 504 + 8 + 1 + 1 + 8 + 1 
        + (MAX_SIDES * Side::LEN) + 8 + 16 + 8 + 4 + 8 + 1;

    /// Check if market is still active (before end time)
    pub fn is_active(&self, current_timestamp: i64) -> bool {
        !self.resolved && current_timestamp < self.end_timestamp
    }

    /// Check if market should auto-resolve (past end time but not yet resolved)
    pub fn should_resolve(&self, current_timestamp: i64) -> bool {
        !self.resolved && current_timestamp >= self.end_timestamp
    }

    /// Get side by index
    pub fn get_side(&self, index: u8) -> Option<&Side> {
        if index < self.num_sides {
            Some(&self.sides[index as usize])
        } else {
            None
        }
    }

    /// Get mutable side by index
    pub fn get_side_mut(&mut self, index: u8) -> Option<&mut Side> {
        if index < self.num_sides {
            Some(&mut self.sides[index as usize])
        } else {
            None
        }
    }

    /// Determine winning side (side with most USDC)
    pub fn determine_winner(&self) -> u8 {
        let mut winning_index = 0;
        let mut max_amount = 0u64;

        for i in 0..self.num_sides {
            let side = &self.sides[i as usize];
            if side.total_amount > max_amount {
                max_amount = side.total_amount;
                winning_index = i;
            }
        }

        winning_index
    }

    /// Auto-resolve market and distribute fees (50/50 split)
    pub fn auto_resolve(&mut self) {
        if self.resolved {
            return;
        }

        self.winning_side_index = self.determine_winner();
        self.resolved = true;

        // Split fee pool 50/50 between creator and protocol
        let half_fees = self.fee_pool / 2;
        self.creator_fees_distributed = half_fees;
        self.protocol_fees_distributed = self.fee_pool - half_fees; // Handle odd amounts
    }

    /// Calculate payout for a user on a specific side
    pub fn calculate_payout(&self, side_index: u8, user_amount: u64) -> u64 {
        if !self.resolved || side_index != self.winning_side_index {
            return 0;
        }

        let winning_side = &self.sides[side_index as usize];
        if winning_side.total_amount == 0 {
            return 0;
        }

        // User gets their proportional share of the total pool
        ((user_amount as u128 * self.total_pool as u128) / winning_side.total_amount as u128) as u64
    }
}

/// Individual side/option in a market
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct Side {
    pub name: [u8; MAX_SIDE_NAME_LENGTH],  // Side name (e.g., "Kanye West")
    pub name_len: u8,                       // Actual length of name
    pub total_amount: u64,                  // Total USDC bet on this side
    pub num_bettors: u32,                   // Number of bettors on this side
}

impl Side {
    pub const LEN: usize = MAX_SIDE_NAME_LENGTH + 1 + 8 + 4;

    /// Create a new side
    pub fn new(name: &str) -> Result<Self> {
        let name_bytes = name.as_bytes();
        require!(
            name_bytes.len() <= MAX_SIDE_NAME_LENGTH,
            crate::error::ErrorCode::SideNameTooLong
        );

        let mut name_array = [0u8; MAX_SIDE_NAME_LENGTH];
        name_array[..name_bytes.len()].copy_from_slice(name_bytes);

        Ok(Self {
            name: name_array,
            name_len: name_bytes.len() as u8,
            total_amount: 0,
            num_bettors: 0,
        })
    }

    /// Get the name as a string
    pub fn get_name(&self) -> String {
        String::from_utf8_lossy(&self.name[..self.name_len as usize]).to_string()
    }

    /// Add a bet to this side
    pub fn add_bet(&mut self, amount: u64, is_new_bettor: bool) {
        self.total_amount += amount;
        if is_new_bettor {
            self.num_bettors += 1;
        }
    }
}

impl Default for Side {
    fn default() -> Self {
        Self {
            name: [0u8; MAX_SIDE_NAME_LENGTH],
            name_len: 0,
            total_amount: 0,
            num_bettors: 0,
        }
    }
}

/// User's position in a specific market
#[account]
pub struct UserPosition {
    pub user: Pubkey,                       // Position owner
    pub market: Pubkey,                     // Market reference
    pub bets: [SideBet; MAX_SIDES],         // Bets on each side
    pub total_invested: u64,                // Total USDC invested
    pub claimed: bool,                      // Has user claimed winnings?
    pub bump: u8,                           // PDA bump
}

impl UserPosition {
    pub const LEN: usize = 8 + 32 + 32 + (MAX_SIDES * SideBet::LEN) + 8 + 1 + 1;

    /// Get bet for a specific side
    pub fn get_bet(&self, side_index: u8) -> &SideBet {
        &self.bets[side_index as usize]
    }

    /// Get mutable bet for a specific side
    pub fn get_bet_mut(&mut self, side_index: u8) -> &mut SideBet {
        &mut self.bets[side_index as usize]
    }

    /// Add a bet to a side
    pub fn add_bet(&mut self, side_index: u8, amount: u64) {
        let is_first_bet = self.bets[side_index as usize].amount == 0;
        self.bets[side_index as usize].amount += amount;
        self.total_invested += amount;
        
        if is_first_bet {
            self.bets[side_index as usize].has_bet = true;
        }
    }

    /// Check if user has any bets
    pub fn has_any_bets(&self) -> bool {
        self.bets.iter().any(|bet| bet.has_bet)
    }
}

/// Individual bet on a side
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct SideBet {
    pub amount: u64,        // Amount bet on this side
    pub has_bet: bool,      // Has user bet on this side?
}

impl SideBet {
    pub const LEN: usize = 8 + 1;
}

/// Global treasury for protocol fees
#[account]
pub struct Treasury {
    pub authority: Pubkey,          // Treasury authority
    pub total_protocol_fees: u64,   // Total protocol fees collected
    pub total_creator_fees: u64,    // Total creator fees collected
    pub total_markets: u32,         // Number of markets created
    pub total_volume: u64,          // All-time trading volume
    pub bump: u8,                   // PDA bump
}

impl Treasury {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 4 + 8 + 1;
}