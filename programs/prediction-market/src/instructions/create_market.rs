use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(
    ctx: Context<CreateMarket>,
    question: String,
    description: String,
    end_timestamp: i64,
    initial_liquidity: u64,
    question_seed: [u8; 32],
) -> Result<()> {
    msg!("Question seed received: {:?}", &question_seed[..8]); // Log first 8 bytes
    msg!("Creator: {}", ctx.accounts.creator.key());
    
    // ---- Validation (no borrows yet) ----
    let clock = Clock::get()?;
    require!(question.len() <= 200, ErrorCode::QuestionTooLong);
    require!(description.len() <= 500, ErrorCode::DescriptionTooLong);
    require!(end_timestamp > clock.unix_timestamp, ErrorCode::InvalidEndTimestamp);
    require!(initial_liquidity >= 1_000_000_000, ErrorCode::LiquidityTooSmall); // 1 SOL

    let creation_fee = 100_000_000; // 0.1 SOL

    // ---- Do CPIs in a short scope so borrows end before mutation ----
    {
        // fee -> treasury
        let sys = ctx.accounts.system_program.to_account_info();
        let from = ctx.accounts.creator.to_account_info();
        let to   = ctx.accounts.treasury.to_account_info();
        transfer(CpiContext::new(sys.clone(), Transfer { from, to }), creation_fee)?;

        // initial liquidity -> market
        let from = ctx.accounts.creator.to_account_info();
        let to   = ctx.accounts.market.to_account_info();
        transfer(CpiContext::new(sys, Transfer { from, to }), initial_liquidity)?;
    } // <- all immutable borrows of accounts end here

    // ---- Now it's safe to take &mut borrows and mutate ----
    let market   = &mut ctx.accounts.market;
    let treasury = &mut ctx.accounts.treasury;

    let half_liquidity = initial_liquidity / 2;

    market.creator         = ctx.accounts.creator.key();
    market.question        = question;
    market.description     = description;
    market.end_timestamp   = end_timestamp;
    market.resolved        = false;
    market.outcome         = false;
    market.yes_pool        = half_liquidity;
    market.no_pool         = half_liquidity;
    market.k               = (half_liquidity as u128) * (half_liquidity as u128);
    market.total_yes_shares= 0;
    market.total_no_shares = 0;
    market.treasury_fee    = 0;
    market.creation_fee    = creation_fee;
    market.total_volume    = 0;
    market.num_bettors     = 0;
    market.question_hash   = question_seed;
    market.bump            = ctx.bumps.market;

    // Update treasury stats (use checked add if you want safety)
    treasury.total_fees = treasury.total_fees
        .checked_add(creation_fee)
        .ok_or(ErrorCode::MathOverflow)?;
    treasury.total_markets = treasury.total_markets
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("Market created: {}", market.question);
    msg!("Initial YES price: {}%", market.get_yes_price() / 100);
    msg!("Initial NO  price: {}%", market.get_no_price() / 100);
    Ok(())
}

#[derive(Accounts)]
#[instruction(
    question: String,
    description: String,
    end_timestamp: i64,
    initial_liquidity: u64,
    question_seed: [u8; 32]
)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [b"market", creator.key().as_ref(), &question_seed],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = creator,
        space = Treasury::LEN,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}