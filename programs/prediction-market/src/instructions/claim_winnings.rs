use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let clock = Clock::get()?;

    // Validation - market must be ended (past end_timestamp)
    require!(!market.is_active(clock.unix_timestamp), ErrorCode::MarketNotEnded);
    require!(!position.claimed, ErrorCode::AlreadyClaimed);

    // Calculate proportional payout based on final pool ratios
    let yes_payout = market.calculate_yes_payout(position.yes_shares);
    let no_payout = market.calculate_no_payout(position.no_shares);
    let total_payout = yes_payout + no_payout;

    require!(total_payout > 0, ErrorCode::NoWinnings);

    // Transfer proportional winnings from market to user
    **market.to_account_info().try_borrow_mut_lamports()? -= total_payout;
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += total_payout;

    // Mark as claimed
    position.claimed = true;

    msg!("Proportional payout claimed: {} SOL", total_payout / 1_000_000_000);
    msg!("YES shares: {} -> {} SOL", position.yes_shares, yes_payout / 1_000_000_000);
    msg!("NO shares: {} -> {} SOL", position.no_shares, no_payout / 1_000_000_000);

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}