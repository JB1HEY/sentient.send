use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(
    ctx: Context<PlaceBet>,
    amount: u64,
    is_yes: bool,
) -> Result<()> {
    let clock = Clock::get()?;
    
    // Capture keys before mutable borrows
    let user_key = ctx.accounts.user.key();
    let market_key = ctx.accounts.market.key();
    
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    // Validation - check if market is still active
    require!(market.is_active(clock.unix_timestamp), ErrorCode::MarketEnded);
    require!(amount >= 10_000_000, ErrorCode::BetTooSmall); // 0.01 SOL minimum

    // Calculate 2% platform fee
    let fee = amount * 2 / 100;
    let bet_amount = amount - fee;

    // Transfer total amount to market
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: market.to_account_info(),
            },
        ),
        amount,
    )?;

    // Calculate shares based on AMM
    let shares = if is_yes {
        market.calculate_yes_shares(bet_amount)?
    } else {
        market.calculate_no_shares(bet_amount)?
    };

    // Update pools
    if is_yes {
        market.no_pool += bet_amount;
        market.yes_pool -= shares;
        market.total_yes_shares += shares;
        position.yes_shares += shares;
    } else {
        market.yes_pool += bet_amount;
        market.no_pool -= shares;
        market.total_no_shares += shares;
        position.no_shares += shares;
    }

    // Update K constant
    market.k = (market.yes_pool as u128) * (market.no_pool as u128);

    // Update position
    position.amount_invested += amount;
    
    // Set position fields if this is first bet
    if position.user == Pubkey::default() {
        position.user = user_key;
        position.market = market_key;
        position.bump = ctx.bumps.position;
        position.claimed = false;
    }

    // Update market stats
    market.treasury_fee += fee;
    market.total_volume += amount;
    
    // Track unique bettors (only count first bet)
    if position.amount_invested == amount {
        market.num_bettors += 1;
    }

    msg!("Bet placed: {} shares of {}", shares, if is_yes { "YES" } else { "NO" });
    msg!("New YES price: {}%", market.get_yes_price() / 100);
    msg!("New NO price: {}%", market.get_no_price() / 100);

    Ok(())
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserPosition::LEN,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}