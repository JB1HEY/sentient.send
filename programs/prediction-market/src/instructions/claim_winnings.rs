use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let clock = Clock::get()?;

    // Auto-resolve market if needed
    if market.should_resolve(clock.unix_timestamp) {
        market.auto_resolve();
    }

    // Validation
    require!(market.resolved, ErrorCode::MarketNotEnded);
    require!(!position.claimed, ErrorCode::AlreadyClaimed);

    // Calculate payout (only winners get paid)
    let user_bet = position.get_bet(market.winning_side_index);
    let user_bet_amount = user_bet.amount; // Copy the amount value
    let payout = market.calculate_payout(market.winning_side_index, user_bet_amount);

    require!(payout > 0, ErrorCode::NoWinnings);

    // Transfer from vault to user using vault PDA as authority
    let market_key = market.key();
    let seeds = &[
        b"vault",
        market_key.as_ref(),
        &[ctx.bumps.market_vault],
    ];
    let signer_seeds = &[&seeds[..]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.market_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.market_vault.to_account_info(),
            },
            signer_seeds,
        ),
        payout,
    )?;

    // Mark as claimed
    position.claimed = true;

    msg!("Winnings claimed: {} USDC", payout);
    msg!("User had {} USDC on winning side", user_bet_amount);

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
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
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump
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
}