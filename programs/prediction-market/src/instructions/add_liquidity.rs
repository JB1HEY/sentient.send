use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(
    ctx: Context<AddLiquidity>,
    amount: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;

    // Validation
    require!(!market.resolved, ErrorCode::MarketAlreadyResolved);
    require!(amount >= 100_000_000, ErrorCode::LiquidityTooSmall); // 0.1 SOL minimum

    // Transfer liquidity to market
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.liquidity_provider.to_account_info(),
                to: market.to_account_info(),
            },
        ),
        amount,
    )?;

    // Add equally to both pools to maintain price
    let half_amount = amount / 2;
    market.yes_pool += half_amount;
    market.no_pool += half_amount;
    
    // Update K constant
    market.k = (market.yes_pool as u128) * (market.no_pool as u128);

    msg!("Liquidity added: {} SOL", amount / 1_000_000_000);
    msg!("New pool sizes - YES: {} SOL, NO: {} SOL", 
        market.yes_pool / 1_000_000_000,
        market.no_pool / 1_000_000_000
    );

    Ok(())
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub liquidity_provider: Signer<'info>,

    pub system_program: Program<'info, System>,
}