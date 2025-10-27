use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod error;

use instructions::*;

declare_id!("8qXgRQksNnwYLprU4wmfTRJEN2tva4AtS64PyxKn2NNs");

#[program]
pub mod prediction_market {
    use super::*;

    /// Create a new prediction market
    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        description: String,
        end_timestamp: i64,
        initial_liquidity: u64,
        question_seed: [u8; 32],
    ) -> Result<()> {
        create_market::handler(
            ctx,
            question,
            description,
            end_timestamp,
            initial_liquidity,
            question_seed,
        )
    }

    /// Place a bet on YES or NO
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount: u64,
        is_yes: bool,
    ) -> Result<()> {
        place_bet::handler(ctx, amount, is_yes)
    }

    /// Claim proportional winnings after market ends
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        claim_winnings::handler(ctx)
    }

    /// Add liquidity to a market (optional, for deeper markets)
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount: u64,
    ) -> Result<()> {
        add_liquidity::handler(ctx, amount)
    }
}

#[derive(Accounts)]
pub struct Initialize {}