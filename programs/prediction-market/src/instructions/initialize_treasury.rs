use anchor_lang::prelude::*;
use crate::state::*;

pub fn handler(ctx: Context<InitializeTreasury>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    
    treasury.authority = ctx.accounts.authority.key();
    treasury.total_protocol_fees = 0;
    treasury.total_creator_fees = 0;
    treasury.total_markets = 0;
    treasury.total_volume = 0;
    treasury.bump = ctx.bumps.treasury;

    msg!("Treasury initialized with authority: {}", treasury.authority);

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = Treasury::LEN,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}