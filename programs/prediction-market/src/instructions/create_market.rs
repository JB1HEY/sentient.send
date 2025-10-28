use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(
    ctx: Context<CreateMarket>,
    question: String,
    description: String,
    end_timestamp: i64,
    side_names: Vec<String>,
    initial_amount: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let treasury = &mut ctx.accounts.treasury;
    let clock = Clock::get()?;

    // Validation
    require!(question.len() <= 200, ErrorCode::QuestionTooLong);
    require!(description.len() <= 500, ErrorCode::DescriptionTooLong);
    require!(end_timestamp > clock.unix_timestamp, ErrorCode::InvalidEndTimestamp);
    require!(initial_amount >= MIN_MARKET_CREATION, ErrorCode::CreationAmountTooSmall);
    require!(side_names.len() >= 2, ErrorCode::TooFewSides);
    require!(side_names.len() <= MAX_SIDES, ErrorCode::TooManySides);

    // Check for duplicate side names
    for i in 0..side_names.len() {
        for j in (i + 1)..side_names.len() {
            require!(
                side_names[i].to_lowercase() != side_names[j].to_lowercase(),
                ErrorCode::DuplicateSideName
            );
        }
    }

    // Calculate fees (2% of initial amount, 100% goes to fee pool)
    let creation_fee = (initial_amount * CREATION_FEE_BPS) / 10000;
    let amount_to_pool = initial_amount - creation_fee;

    // Transfer USDC from creator to market vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.creator_token_account.to_account_info(),
                to: ctx.accounts.market_vault.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        ),
        initial_amount,
    )?;

    // Initialize market
    market.creator = ctx.accounts.creator.key();
    market.question = question;
    market.description = description;
    market.end_timestamp = end_timestamp;
    market.resolved = false;
    market.winning_side_index = 0;
    market.total_pool = amount_to_pool;
    market.num_sides = side_names.len() as u8;
    market.fee_pool = creation_fee; // All creation fees go to fee pool
    market.creator_fees_distributed = 0; // Will be set at resolution
    market.protocol_fees_distributed = 0; // Will be set at resolution
    market.total_volume = initial_amount;
    market.num_bettors = 0;
    market.creation_amount = initial_amount;
    market.bump = ctx.bumps.market;

    // Initialize sides
    for (i, side_name) in side_names.iter().enumerate() {
        market.sides[i] = Side::new(side_name)?;
    }

    // Update treasury (must already exist)
    treasury.total_markets = treasury.total_markets
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    treasury.total_volume = treasury.total_volume
        .checked_add(initial_amount)
        .ok_or(ErrorCode::MathOverflow)?;

    msg!("Market created: {}", market.question);
    msg!("Number of sides: {}", market.num_sides);
    for i in 0..market.num_sides {
        msg!("  Side {}: {}", i, market.sides[i as usize].get_name());
    }
    msg!("Initial pool: {} USDC", amount_to_pool);
    msg!("Creation fee (to fee pool): {} USDC", creation_fee);
    msg!("Fees will be distributed 50/50 at market resolution");

    Ok(())
}

#[derive(Accounts)]
#[instruction(
    question: String,
    description: String,
    end_timestamp: i64,
    side_names: Vec<String>,
    initial_amount: u64,
)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [b"market", creator.key().as_ref(), question.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    /// Market vault to hold USDC
    #[account(
        init,
        payer = creator,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = market_vault,
    )]
    pub market_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    /// Creator's USDC token account
    #[account(
        mut,
        constraint = creator_token_account.mint == usdc_mint.key() @ ErrorCode::InvalidTokenAccount,
        constraint = creator_token_account.owner == creator.key() @ ErrorCode::InvalidTokenAccount,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// USDC mint
    pub usdc_mint: Account<'info, token::Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}