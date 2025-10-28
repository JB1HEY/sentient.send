use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(
    ctx: Context<PlaceBet>,
    side_index: u8,
    amount: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let clock = Clock::get()?;

    // Validation
    require!(market.is_active(clock.unix_timestamp), ErrorCode::MarketEnded);
    require!(amount >= MIN_BET, ErrorCode::BetTooSmall);
    require!(amount <= MAX_BET, ErrorCode::BetTooLarge);
    require!(side_index < market.num_sides, ErrorCode::InvalidSideIndex);

    // Calculate fees (1.5% of bet, split 50/50)
    let total_fee = (amount * BET_FEE_BPS) / 10000;
    let creator_fee = total_fee / 2;
    let protocol_fee = total_fee / 2;
    let amount_to_pool = amount - total_fee;

    // Transfer USDC from user to market vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.market_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update market
    let side = market.get_side_mut(side_index).unwrap();
    let is_first_bet_on_side = position.get_bet(side_index).amount == 0;
    side.add_bet(amount_to_pool, is_first_bet_on_side);
    
    market.total_pool += amount_to_pool;
    market.creator_fees_collected += creator_fee;
    market.protocol_fees_collected += protocol_fee;
    market.total_volume += amount;

    // Update position
    let is_new_bettor = !position.has_any_bets();
    if position.user == Pubkey::default() {
        position.user = ctx.accounts.user.key();
        position.market = market.key();
        position.bump = ctx.bumps.position;
        position.claimed = false;
    }
    
    position.add_bet(side_index, amount_to_pool);
    
    if is_new_bettor {
        market.num_bettors += 1;
    }

    msg!("Bet placed on side: {}", side.get_name());
    msg!("Amount: {} USDC", amount_to_pool);
    msg!("Side total now: {} USDC", side.total_amount);
    msg!("Creator fee: {} USDC", creator_fee);
    msg!("Protocol fee: {} USDC", protocol_fee);

    Ok(())
}

#[derive(Accounts)]
#[instruction(side_index: u8, amount: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// Market vault holding USDC
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub market_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserPosition::LEN,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,

    /// User's USDC token account
    #[account(
        mut,
        constraint = user_token_account.mint == market_vault.mint @ ErrorCode::InvalidTokenAccount,
        constraint = user_token_account.owner == user.key() @ ErrorCode::InvalidTokenAccount,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}