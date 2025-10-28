use anchor_lang::prelude::*;

pub mod state;
pub mod error;
pub mod instructions;

use instructions::*;

declare_id!("YOUR_PROGRAM_ID_HERE");

#[program]
pub mod prediction_market {
    use super::*;

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

    /// Resolve the market (determine winner)
    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        instructions::resolve_market::handler(ctx)
    }

    /// Claim winnings if you bet on the winning side
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }

    /// Withdraw accumulated creator fees
    pub fn withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
        instructions::withdraw_fees::withdraw_creator_fees(ctx)
    }

    /// Withdraw accumulated protocol fees (admin only)
    pub fn withdraw_protocol_fees(ctx: Context<WithdrawProtocolFees>) -> Result<()> {
        instructions::withdraw_fees::withdraw_protocol_fees(ctx)
    }
}