// utils.ts
import { UserMargin, MarginAllocation, MarginSource, TradeType } from './rms.types';

// Non-null assertion helper function
export function assertNonNull<T>(value: T | null | undefined, errorMessage: string): T {
    if (value === null || value === undefined) {
        throw new Error(errorMessage);
    }
    return value;
}

/**
 * Calculate margin allocation based on user's available margin and preference
 */
export function calculateMarginAllocation(
    userMargin: UserMargin,
    requiredMargin: number,
    maxLeverage: number,
    requestedMarginSource: MarginSource = MarginSource.BOTH,
): MarginAllocation {
    const totalAvailableMargin = Number(userMargin.cash_margin) + Number(userMargin.pledge_margin);
    const negativeLimit = userMargin.negative_cash_limit || 0;
    const isNegativeCashAllowed = userMargin.is_negative_cash_allowed ?? false;

    let cashMarginUsed = 0;
    let pledgeMarginUsed = 0;

    // Handle based on requested margin source
    if (requestedMarginSource === MarginSource.CASH) {
        // Use only cash margin
        cashMarginUsed = requiredMargin;
        pledgeMarginUsed = 0;

        // Check if there's enough cash margin
        if (userMargin.cash_margin < requiredMargin) {
            throw new Error('Insufficient cash margin for this order');
        }
    } else if (requestedMarginSource === MarginSource.PLEDGE) {
        // Use only pledge margin
        cashMarginUsed = 0;
        pledgeMarginUsed = requiredMargin;

        // Check if there's enough pledge margin
        if (userMargin.pledge_margin < requiredMargin) {
            throw new Error('Insufficient pledge margin for this order');
        }
    } else {
        // Default to 'both' - use 50-50 allocation if possible
        if (userMargin.cash_margin >= requiredMargin / 2 && userMargin.pledge_margin >= requiredMargin / 2) {
            // Ideal 50-50 split
            cashMarginUsed = requiredMargin / 2;
            pledgeMarginUsed = requiredMargin / 2;
        } else if (userMargin.cash_margin >= requiredMargin) {
            // Not enough pledge, use all cash
            cashMarginUsed = requiredMargin;
            pledgeMarginUsed = 0;
        } else if (userMargin.pledge_margin >= requiredMargin) {
            // Not enough cash, use all pledge
            cashMarginUsed = 0;
            pledgeMarginUsed = requiredMargin;
        } else {
            // Use whatever is available from each
            pledgeMarginUsed = Math.min(userMargin.pledge_margin, requiredMargin);
            cashMarginUsed = requiredMargin - pledgeMarginUsed;

            // Check if the remaining required cash is available
            if (userMargin.cash_margin < cashMarginUsed) {
                throw new Error('Insufficient margin for this order');
            }
        }
    }

    // Check negative cash balance constraints
    if (isNegativeCashAllowed && userMargin.cash_margin - cashMarginUsed < -negativeLimit) {
        throw new Error(`Negative cash limit of ${negativeLimit} exceeded`);
    }

    return {
        totalMarginAvailable: Number(totalAvailableMargin),
        cashMarginUsed: Number(cashMarginUsed),
        pledgeMarginUsed: Number(pledgeMarginUsed),
        marginSource:
            pledgeMarginUsed > 0 ? (cashMarginUsed > 0 ? MarginSource.BOTH : MarginSource.PLEDGE) : MarginSource.CASH,
    };
}

/**
 * Get current market price for a symbol and trade type
 * Mock function to be replaced with actual market data service
 */
export async function getCurrentMarketPrice(symbol: string, tradeType: TradeType): Promise<number> {
    // In a real-world scenario, this would fetch live market prices
    const defaultPrices: Record<TradeType, number> = {
        [TradeType.EQUITY_DELIVERY]: 100,
        [TradeType.EQUITY_INTRADAY]: 100,
        [TradeType.EQUITY_FUTURES]: 500,
        [TradeType.EQUITY_OPTIONS]: 50,
        [TradeType.COMMODITY_FUTURES]: 200,
        [TradeType.COMMODITY_OPTIONS]: 100,
        [TradeType.CURRENCY_FUTURES]: 75,
        [TradeType.CURRENCY_OPTIONS]: 25,
    };

    return defaultPrices[tradeType] || 100;
}
