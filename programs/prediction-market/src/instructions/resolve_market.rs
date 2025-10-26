use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::ErrorCode;

pub fn handler(
    ctx: Context<ResolveMarket>,
    outcome: bool,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let treasury = &mut ctx.accounts.treasury;
    let clock = Clock::get()?;

    // Validation
    require!(!market.resolved, ErrorCode::MarketAlreadyResolved);
    require!(clock.unix_timestamp >= market.end_timestamp, ErrorCode::MarketNotEnded);
    require!(
        ctx.accounts.resolver.key() == market.creator,
        ErrorCode::UnauthorizedResolver
    );

    // Resolve market
    market.resolved = true;
    market.outcome = outcome;

    // Transfer accumulated fees to treasury
    if market.treasury_fee > 0 {
        **market.to_account_info().try_borrow_mut_lamports()? -= market.treasury_fee;
        **treasury.to_account_info().try_borrow_mut_lamports()? += market.treasury_fee;
        
        treasury.total_fees += market.treasury_fee;
        treasury.total_volume += market.total_volume;
    }

    msg!("Market resolved: {}", if outcome { "YES" } else { "NO" });
    msg!("Total volume: {} SOL", market.total_volume / 1_000_000_000);
    msg!("Fees collected: {} SOL", market.treasury_fee / 1_000_000_000);

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump  // Let Anchor find the bump automatically
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub resolver: Signer<'info>,

    pub system_program: Program<'info, System>,
}