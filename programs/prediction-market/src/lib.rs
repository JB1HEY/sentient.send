use anchor_lang::prelude::*;

pub mod state;
pub mod error;
pub mod instructions;

use instructions::*;

declare_id!("2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ");

#[program]
pub mod prediction_market {
    use super::*;

    /// Initialize the global treasury (call once)
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        instructions::initialize_treasury::handler(ctx)
    }

    /// Create a new multi-side prediction market
    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        description: String,
        end_timestamp: i64,
        side_names: Vec<String>,
        initial_amount: u64,
    ) -> Result<()> {
        instructions::create_market::handler(
            ctx,
            question,
            description,
            end_timestamp,
            side_names,
            initial_amount,
        )
    }

    /// Place a bet on a specific side
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        side_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::place_bet::handler(ctx, side_index, amount)
    }

    /// Claim winnings if you bet on the winning side
    /// Market will auto-resolve if not already resolved
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }

    /// Withdraw accumulated creator fees (only after market is resolved)
    pub fn withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
        instructions::withdraw_fees::withdraw_creator_fees(ctx)
    }

    /// Withdraw accumulated protocol fees (admin only, only after market is resolved)
    pub fn withdraw_protocol_fees(ctx: Context<WithdrawProtocolFees>) -> Result<()> {
        instructions::withdraw_fees::withdraw_protocol_fees(ctx)
    }
}