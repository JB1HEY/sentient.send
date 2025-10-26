use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    // Validation
    require!(market.resolved, ErrorCode::MarketNotResolved);
    require!(!position.claimed, ErrorCode::AlreadyClaimed);

    // Calculate payout
    let payout = position.calculate_payout(market.outcome, market);
    require!(payout > 0, ErrorCode::NoWinnings);

    // Transfer winnings from market to user
    **market.to_account_info().try_borrow_mut_lamports()? -= payout;
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += payout;

    // Mark as claimed
    position.claimed = true;

    msg!("Winnings claimed: {} SOL", payout / 1_000_000_000);
    msg!("Profit: {} SOL", (payout as i64 - position.amount_invested as i64) / 1_000_000_000);

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