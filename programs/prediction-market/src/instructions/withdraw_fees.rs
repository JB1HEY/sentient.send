use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::error::ErrorCode;

/// Withdraw accumulated creator fees from a market (only after resolution)
pub fn withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;

    // Auto-resolve if needed
    if market.should_resolve(clock.unix_timestamp) {
        market.auto_resolve();
    }

    // Must be resolved before withdrawing
    require!(market.resolved, ErrorCode::MarketNotEnded);

    require!(
        ctx.accounts.creator.key() == market.creator,
        ErrorCode::UnauthorizedResolver
    );

    let amount = market.creator_fees_distributed;
    require!(amount > 0, ErrorCode::NoWinnings);

    // Store market key before transferring
    let market_key = market.key();

    // Transfer fees from vault to creator using vault PDA as authority
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
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.market_vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Update treasury stats
    let treasury = &mut ctx.accounts.treasury;
    treasury.total_creator_fees = treasury.total_creator_fees
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Mark as withdrawn
    market.creator_fees_distributed = 0;

    msg!("Creator fees withdrawn: {} USDC", amount);

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawCreatorFees<'info> {
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
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Creator's USDC token account
    #[account(
        mut,
        constraint = creator_token_account.mint == market_vault.mint @ ErrorCode::InvalidTokenAccount,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Withdraw protocol fees from a market (only protocol authority, only after resolution)
pub fn withdraw_protocol_fees(ctx: Context<WithdrawProtocolFees>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;

    // Auto-resolve if needed
    if market.should_resolve(clock.unix_timestamp) {
        market.auto_resolve();
    }

    // Must be resolved before withdrawing
    require!(market.resolved, ErrorCode::MarketNotEnded);

    let amount = market.protocol_fees_distributed;
    require!(amount > 0, ErrorCode::NoWinnings);

    // Store market key before transferring
    let market_key = market.key();

    // Transfer fees from vault to protocol using vault PDA as authority
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
                to: ctx.accounts.protocol_token_account.to_account_info(),
                authority: ctx.accounts.market_vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Update treasury stats
    let treasury = &mut ctx.accounts.treasury;
    treasury.total_protocol_fees = treasury.total_protocol_fees
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    // Mark as withdrawn
    market.protocol_fees_distributed = 0;

    msg!("Protocol fees withdrawn: {} USDC", amount);

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawProtocolFees<'info> {
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
        seeds = [b"treasury"],
        bump = treasury.bump,
        constraint = protocol_authority.key() == treasury.authority @ ErrorCode::UnauthorizedResolver,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Protocol's USDC token account
    #[account(
        mut,
        constraint = protocol_token_account.mint == market_vault.mint @ ErrorCode::InvalidTokenAccount,
    )]
    pub protocol_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub protocol_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}