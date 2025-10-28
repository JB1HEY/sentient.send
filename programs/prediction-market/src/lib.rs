use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ");

// Constants
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
pub const MIN_BET: u64 = LAMPORTS_PER_SOL / 100; // 0.01 SOL
pub const MAX_BET: u64 = LAMPORTS_PER_SOL; // 1 SOL
pub const MIN_CREATION_AMOUNT: u64 = LAMPORTS_PER_SOL; // 1 SOL
pub const CREATION_FEE_BPS: u16 = 200; // 2%
pub const BET_FEE_BPS: u16 = 200; // 2%
pub const MAX_SIDES: usize = 10;
pub const MIN_SIDES: usize = 2;
pub const MAX_SIDE_NAME_LEN: usize = 50;
pub const MAX_QUESTION_LEN: usize = 200;
pub const MAX_DESCRIPTION_LEN: usize = 500;

#[program]
pub mod prediction_market {
    use super::*;

    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.total_protocol_fees = 0;
        treasury.total_creator_fees = 0;
        treasury.total_markets = 0;
        treasury.total_volume = 0;
        treasury.bump = ctx.bumps.treasury;
        Ok(())
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        description: String,
        end_timestamp: i64,
        side_names: Vec<String>,
        initial_amount: u64,
    ) -> Result<()> {
        require!(
            question.len() <= MAX_QUESTION_LEN,
            ErrorCode::QuestionTooLong
        );
        require!(
            description.len() <= MAX_DESCRIPTION_LEN,
            ErrorCode::DescriptionTooLong
        );
        require!(
            side_names.len() >= MIN_SIDES && side_names.len() <= MAX_SIDES,
            ErrorCode::InvalidSideCount
        );
        require!(
            initial_amount >= MIN_CREATION_AMOUNT,
            ErrorCode::CreationAmountTooSmall
        );

        let now = Clock::get()?.unix_timestamp;
        require!(end_timestamp > now, ErrorCode::InvalidEndTimestamp);

        // Validate side names
        for name in &side_names {
            require!(
                name.len() > 0 && name.len() <= MAX_SIDE_NAME_LEN,
                ErrorCode::SideNameTooLong
            );
        }

        // Check for duplicates
        for i in 0..side_names.len() {
            for j in (i + 1)..side_names.len() {
                require!(
                    side_names[i].to_lowercase() != side_names[j].to_lowercase(),
                    ErrorCode::DuplicateSideName
                );
            }
        }

        // Calculate fee
        let fee_amount = initial_amount
            .checked_mul(CREATION_FEE_BPS as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::MathOverflow)?;

        let net_amount = initial_amount
            .checked_sub(fee_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transfer SOL from creator to market
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.market.to_account_info(),
                },
            ),
            initial_amount,
        )?;

        // Initialize market
        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.question = question;
        market.description = description;
        market.end_timestamp = end_timestamp;
        market.resolved = false;
        market.winning_side_index = 0;
        market.num_sides = side_names.len() as u8;
        market.fee_pool = fee_amount;
        market.creator_fees_distributed = 0;
        market.protocol_fees_distributed = 0;
        market.total_volume = initial_amount;
        market.num_bettors = 1;
        market.creation_amount = initial_amount;
        market.bump = ctx.bumps.market;

        // Split net amount equally across sides
        let amount_per_side = net_amount
            .checked_div(side_names.len() as u64)
            .ok_or(ErrorCode::MathOverflow)?;

        for i in 0..side_names.len() {
            let mut name_bytes = [0u8; MAX_SIDE_NAME_LEN];
            let name = &side_names[i];
            let bytes = name.as_bytes();
            name_bytes[..bytes.len()].copy_from_slice(bytes);

            market.sides[i] = Side {
                name: name_bytes,
                name_len: bytes.len() as u8,
                total_amount: amount_per_side,
                num_bettors: 1,
            };
        }

        market.total_pool = net_amount;

        // Initialize creator's position
        let position = &mut ctx.accounts.position;
        position.user = ctx.accounts.creator.key();
        position.market = market.key();
        position.total_invested = initial_amount;
        position.claimed = false;
        position.bump = ctx.bumps.position;

        for i in 0..side_names.len() {
            position.bets[i] = SideBet {
                amount: amount_per_side,
                has_bet: true,
            };
        }

        // Update treasury
        let treasury = &mut ctx.accounts.treasury;
        treasury.total_markets = treasury.total_markets.checked_add(1).unwrap();
        treasury.total_volume = treasury.total_volume.checked_add(initial_amount).unwrap();

        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        side_index: u8,
        amount: u64,
    ) -> Result<()> {
        // Get account info BEFORE creating mutable borrow
        let market_info = ctx.accounts.market.to_account_info();
        
        let market = &mut ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        // Initialize position if this is first bet
        if position.user == Pubkey::default() {
            position.user = ctx.accounts.user.key();
            position.market = market.key();
            position.total_invested = 0;
            position.claimed = false;
            position.bump = ctx.bumps.position;
            position.bets = [SideBet { amount: 0, has_bet: false }; 10];
        }

        require!(!market.resolved, ErrorCode::MarketAlreadyResolved);
        require!(
            side_index < market.num_sides,
            ErrorCode::InvalidSideIndex
        );

        let now = Clock::get()?.unix_timestamp;
        require!(now < market.end_timestamp, ErrorCode::MarketEnded);
        require!(amount >= MIN_BET, ErrorCode::BetTooSmall);
        require!(amount <= MAX_BET, ErrorCode::BetTooLarge);

        // Calculate fee
        let fee_amount = amount
            .checked_mul(BET_FEE_BPS as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::MathOverflow)?;

        let net_amount = amount
            .checked_sub(fee_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transfer SOL from user to market (do this before updating market state)
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: market_info,
                },
            ),
            amount,
        )?;

        // Update market
        market.sides[side_index as usize].total_amount = market.sides[side_index as usize]
            .total_amount
            .checked_add(net_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        market.total_pool = market
            .total_pool
            .checked_add(net_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        market.fee_pool = market
            .fee_pool
            .checked_add(fee_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        market.total_volume = market
            .total_volume
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;

        // Update position
        if !position.bets[side_index as usize].has_bet {
            market.sides[side_index as usize].num_bettors = market.sides[side_index as usize]
                .num_bettors
                .checked_add(1)
                .unwrap();
            market.num_bettors = market.num_bettors.checked_add(1).unwrap();
        }

        position.bets[side_index as usize].amount = position.bets[side_index as usize]
            .amount
            .checked_add(net_amount)
            .ok_or(ErrorCode::MathOverflow)?;
        position.bets[side_index as usize].has_bet = true;

        position.total_invested = position
            .total_invested
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        // Try to resolve if not resolved yet
        if !market.resolved {
            try_resolve_market(market)?;
        }

        require!(market.resolved, ErrorCode::MarketNotEnded);
        require!(!position.claimed, ErrorCode::AlreadyClaimed);

        let winning_side_index = market.winning_side_index;
        let user_bet = position.bets[winning_side_index as usize];

        require!(user_bet.has_bet && user_bet.amount > 0, ErrorCode::NoWinnings);

        let winning_side = &market.sides[winning_side_index as usize];
        require!(winning_side.total_amount > 0, ErrorCode::NoWinnings);

        // Calculate payout
        let payout = (user_bet.amount as u128)
            .checked_mul(market.total_pool as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(winning_side.total_amount as u128)
            .ok_or(ErrorCode::MathOverflow)?;

        let payout = payout as u64;
        require!(payout > 0, ErrorCode::NoWinnings);

        // Transfer SOL from market to user (do this before updating position)
        let market_lamports = ctx.accounts.market.to_account_info();
        let user_lamports = ctx.accounts.user.to_account_info();
        **market_lamports.try_borrow_mut_lamports()? -= payout;
        **user_lamports.try_borrow_mut_lamports()? += payout;

        position.claimed = true;

        Ok(())
    }

    pub fn withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
        // Get account info BEFORE creating mutable borrow
        let market_lamports = ctx.accounts.market.to_account_info();
        let creator_lamports = ctx.accounts.creator.to_account_info();
        
        let market = &mut ctx.accounts.market;

        // Try to resolve if not resolved yet
        if !market.resolved {
            try_resolve_market(market)?;
        }

        require!(market.resolved, ErrorCode::MarketNotEnded);
        require!(
            ctx.accounts.creator.key() == market.creator,
            ErrorCode::UnauthorizedResolver
        );

        let creator_share = market
            .fee_pool
            .checked_div(2)
            .ok_or(ErrorCode::MathOverflow)?;

        let remaining_fees = creator_share
            .checked_sub(market.creator_fees_distributed)
            .ok_or(ErrorCode::MathOverflow)?;

        require!(remaining_fees > 0, ErrorCode::NoWinnings);

        // Transfer SOL from market to creator (do this before updating market state)
        **market_lamports.try_borrow_mut_lamports()? -= remaining_fees;
        **creator_lamports.try_borrow_mut_lamports()? += remaining_fees;

        market.creator_fees_distributed = market
            .creator_fees_distributed
            .checked_add(remaining_fees)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn withdraw_protocol_fees(ctx: Context<WithdrawProtocolFees>) -> Result<()> {
        // Get account info BEFORE creating mutable borrow
        let market_lamports = ctx.accounts.market.to_account_info();
        let protocol_lamports = ctx.accounts.protocol_authority.to_account_info();
        
        let market = &mut ctx.accounts.market;
        let treasury = &ctx.accounts.treasury;

        // Try to resolve if not resolved yet
        if !market.resolved {
            try_resolve_market(market)?;
        }

        require!(market.resolved, ErrorCode::MarketNotEnded);
        require!(
            ctx.accounts.protocol_authority.key() == treasury.authority,
            ErrorCode::UnauthorizedResolver
        );

        let protocol_share = market
            .fee_pool
            .checked_div(2)
            .ok_or(ErrorCode::MathOverflow)?;

        let remaining_fees = protocol_share
            .checked_sub(market.protocol_fees_distributed)
            .ok_or(ErrorCode::MathOverflow)?;

        require!(remaining_fees > 0, ErrorCode::NoWinnings);

        // Transfer SOL from market to protocol (do this before updating market state)
        **market_lamports.try_borrow_mut_lamports()? -= remaining_fees;
        **protocol_lamports.try_borrow_mut_lamports()? += remaining_fees;

        market.protocol_fees_distributed = market
            .protocol_fees_distributed
            .checked_add(remaining_fees)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }
}

// Helper function to resolve market
fn try_resolve_market(market: &mut Market) -> Result<()> {
    if market.resolved {
        return Ok(());
    }

    let now = Clock::get()?.unix_timestamp;
    if now < market.end_timestamp {
        return Ok(());
    }

    // Find winning side (most lamports)
    let mut winning_side_index = 0u8;
    let mut max_amount = market.sides[0].total_amount;

    for i in 1..market.num_sides {
        if market.sides[i as usize].total_amount > max_amount {
            max_amount = market.sides[i as usize].total_amount;
            winning_side_index = i;
        }
    }

    market.resolved = true;
    market.winning_side_index = winning_side_index;

    Ok(())
}

// Account structures
#[derive(Accounts)]
#[instruction(question: String)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", creator.key().as_ref(), question.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = creator,
        space = 8 + UserPosition::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserPosition::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
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
}

#[derive(Accounts)]
pub struct WithdrawCreatorFees<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFees<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub protocol_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub creator: Pubkey,
    #[max_len(200)]
    pub question: String,
    #[max_len(500)]
    pub description: String,
    pub end_timestamp: i64,
    pub resolved: bool,
    pub winning_side_index: u8,
    pub total_pool: u64,
    pub num_sides: u8,
    pub sides: [Side; MAX_SIDES],
    pub fee_pool: u64,
    pub creator_fees_distributed: u64,
    pub protocol_fees_distributed: u64,
    pub total_volume: u64,
    pub num_bettors: u32,
    pub creation_amount: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct Side {
    pub name: [u8; MAX_SIDE_NAME_LEN],
    pub name_len: u8,
    pub total_amount: u64,
    pub num_bettors: u32,
}

#[account]
#[derive(InitSpace)]
pub struct UserPosition {
    pub user: Pubkey,
    pub market: Pubkey,
    pub bets: [SideBet; MAX_SIDES],
    pub total_invested: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct SideBet {
    pub amount: u64,
    pub has_bet: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub authority: Pubkey,
    pub total_protocol_fees: u64,
    pub total_creator_fees: u64,
    pub total_markets: u32,
    pub total_volume: u64,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Market has ended, trading is closed")]
    MarketEnded,
    #[msg("Market has not ended yet")]
    MarketNotEnded,
    #[msg("Market has already been resolved")]
    MarketAlreadyResolved,
    #[msg("Question is too long (max 200 characters)")]
    QuestionTooLong,
    #[msg("Description is too long (max 500 characters)")]
    DescriptionTooLong,
    #[msg("End timestamp must be in the future")]
    InvalidEndTimestamp,
    #[msg("Bet amount is below minimum (0.01 SOL)")]
    BetTooSmall,
    #[msg("Bet amount exceeds maximum (1 SOL)")]
    BetTooLarge,
    #[msg("No winnings to claim")]
    NoWinnings,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("Math overflow occurred")]
    MathOverflow,
    #[msg("Market creation amount too small (minimum 1 SOL)")]
    CreationAmountTooSmall,
    #[msg("Invalid side index")]
    InvalidSideIndex,
    #[msg("Invalid number of sides (must be 2-10)")]
    InvalidSideCount,
    #[msg("Side name is too long (max 50 characters)")]
    SideNameTooLong,
    #[msg("Duplicate side names not allowed")]
    DuplicateSideName,
    #[msg("Only market creator can resolve")]
    UnauthorizedResolver,
}