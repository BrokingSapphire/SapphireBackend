// funds.services.ts

import { WithdrawalRequest } from './funds.types';

export class FundsService {
    /**
     * Calculate safety cut for withdrawal based on F&O positions
     * @param hasActivePositions Whether the user has active F&O positions
     * @param amount The withdrawal amount
     */
    calculateSafetyCut(hasActivePositions: boolean, amount: number): { safetyCut: WithdrawalRequest['safetyCut'] } {
        // Apply safety cut logic
        const safetyCut: WithdrawalRequest['safetyCut'] & { applied: boolean } = {
            percentage: 5,
            amount: 0,
            reason: hasActivePositions ? 'Active F&O Positions' : null,
            originalAmount: amount,
            finalAmount: amount,
            applied: hasActivePositions,
        };

        if (hasActivePositions) {
            // Apply 5% safety cut for users with F&O positions
            safetyCut.amount = amount * 0.05;
            safetyCut.finalAmount = amount - safetyCut.amount;
        }

        return { safetyCut };
    }

    /**
     * Prepare scheduled processing time for withdrawal
     */
    prepareScheduledProcessingTime(): {
        processingWindow: string;
        scheduledTime: Date;
    } {
        const now = new Date();
        const currentHour = now.getHours();
        const processingWindow = currentHour < 12 ? 'NOON' : 'EOD';

        const scheduledTime = new Date();

        if (processingWindow === 'NOON') {
            // Set to noon today
            scheduledTime.setHours(12, 0, 0, 0);

            if (now > scheduledTime) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }
        } else {
            scheduledTime.setHours(18, 0, 0, 0);

            // already past 6PM
            if (now > scheduledTime) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }
        }

        return { processingWindow, scheduledTime };
    }

    /**
     * Utility function to calculate processing windows based on current time
     */
    getProcessingWindow(): string {
        const currentHour = new Date().getHours();
        return currentHour < 12 ? 'NOON' : 'EOD';
    }

    /**
     * Format a currency value with 2 decimal places
     */
    formatCurrency(amount: number): string {
        return amount.toFixed(2);
    }
}

// Create singleton instance
export const fundsService = new FundsService();
