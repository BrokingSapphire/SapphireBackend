// funds.services.ts

import { db } from '@app/database';
import {WithdrawalRequest} from './funds.types'
export class FundsService {
    /**
     * Verify Bank Account of a particular User
     */
    async verifyBankAccount(userId: number, bankAccountId: number): Promise<boolean> {
        const bankAccount = await db
            .selectFrom('bank_to_user')
            .where('user_id', '=', userId)
            .where('bank_account_id', '=', bankAccountId)
            .executeTakeFirst();

        return !!bankAccount;
    }

    /**
     * Calculate safety cut for withdrawal based on F&O positions
     */
    async calculateSafetyCut(userId: number, amount: number): Promise<{ safetyCut: WithdrawalRequest['safetyCut'] }> {
        // Checking F&O pos. if safety cut is needed
        const hasActivePositions = await db
            .selectFrom('trading_positions')
            .where('user_id', '=', userId)
            .where(eb => 
                eb.or([
                    eb('trade_type', '=', 'equity_futures'),
                    eb('trade_type', '=', 'equity_options'),
                    eb('trade_type', '=', 'currency_futures'),
                    eb('trade_type', '=', 'currency_options'),
                    eb('trade_type', '=', 'commodity_futures'),
                    eb('trade_type', '=', 'commodity_options')
                ])
            )
            .select('id')
            .limit(1)
            .executeTakeFirst();
    
        // Apply safety cut logic
        let safetyCut: WithdrawalRequest['safetyCut'] & { applied: boolean }  = {
            percentage: 5,
            amount: 0,
            reason: hasActivePositions ? 'Active F&O Positions' : null,
            originalAmount: amount,
            finalAmount: amount,
            applied: !!hasActivePositions 
        };
    
        if (hasActivePositions) {
            // Apply 5% safety cut for users with F&O positions
            safetyCut.amount = amount * 0.05;
            safetyCut.finalAmount = amount - safetyCut.amount;
        }
    
        return { safetyCut };
    }
    
    //  * Prepare scheduled processing time for withdrawal

    prepareScheduledProcessingTime(): { 
        processingWindow: string, 
        scheduledTime: Date 
    } {
        const now = new Date();
        const currentHour = now.getHours();
        const processingWindow = currentHour < 12 ? 'NOON' : 'EOD';

        let scheduledTime = new Date();
        
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
}

// Create singleton instance
export const fundsService = new FundsService();