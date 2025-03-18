// validator.ts
import { Request, Response, NextFunction } from 'express';
import { Transaction, Order, Settlement } from './settlement.types';
import { SettlementManager } from './settlement.service';

export interface ValidationError {
    field: string;
    message: string;
}

export class SettlementValidator {
    /**
     * Validate transaction ID parameter
     */
    static validateTransactionId(req: Request, res: Response, next: NextFunction): void {
        const transactionId = parseInt(req.params.transactionId, 10);

        if (isNaN(transactionId) || transactionId <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid transaction ID',
                data: null,
            });
            return;
        }

        next();
    }

    /**
     * Validate settlement ID parameter
     */
    static validateSettlementId(req: Request, res: Response, next: NextFunction): void {
        const settlementId = parseInt(req.params.settlementId, 10);

        if (isNaN(settlementId) || settlementId <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid settlement ID',
                data: null,
            });
            return;
        }

        next();
    }

    /**
     * Validate user ID parameter
     */
    static validateUserId(req: Request, res: Response, next: NextFunction): void {
        const userId = parseInt(req.params.userId, 10);

        if (isNaN(userId) || userId <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid user ID',
                data: null,
            });
            return;
        }

        next();
    }

    /**
     * Validate withdrawal request timing
     */
    static validateWithdrawalRequestTiming(req: Request, res: Response, next: NextFunction): void {
        // Check if we're within the withdrawal request window
        if (!SettlementManager.isWithinWithdrawalRequestWindow()) {
            res.status(400).json({
                success: false,
                message: 'Withdrawal requests can only be submitted between 7AM and 6PM',
                data: null,
            });
            return;
        }

        next();
    }

    /**
     * Validate withdrawal processing timing
     */
    static validateWithdrawalProcessingTiming(req: Request, res: Response, next: NextFunction): void {
        // Check if we're within the withdrawal processing window
        if (!SettlementManager.isWithinWithdrawalProcessingWindow()) {
            res.status(400).json({
                success: false,
                message: 'Withdrawal processing is only available between 12PM-2PM and 6PM-8PM',
                data: null,
            });
            return;
        }

        next();
    }

    /**
     * Validate settlement timing
     */
    static validateSettlementTiming(req: Request, res: Response, next: NextFunction): void {
        // Check if we're within the settlement window
        if (!SettlementManager.isWithinSettlementWindow()) {
            res.status(400).json({
                success: false,
                message: 'Settlement processing is only available between 12AM and 7AM',
                data: null,
            });
            return;
        }

        next();
    }

    /**
     * Validate withdrawal request data
     */
    static validateWithdrawalRequest(req: Request, res: Response, next: NextFunction): void {
        const { amount, userId } = req.body;
        const errors: ValidationError[] = [];

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            errors.push({
                field: 'amount',
                message: 'Amount must be a positive number',
            });
        }

        if (!userId || isNaN(Number(userId)) || Number(userId) <= 0) {
            errors.push({
                field: 'userId',
                message: 'User ID must be a positive number',
            });
        }

        if (errors.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors,
                data: null,
            });
            return;
        }

        next();
    }

    /**
     * Validate settlement request data
     */
    static validateSettlementRequest(req: Request, res: Response, next: NextFunction): void {
        const { orderId, userId, tradeType, amount } = req.body;
        const errors: ValidationError[] = [];

        if (!orderId || isNaN(Number(orderId)) || Number(orderId) <= 0) {
            errors.push({
                field: 'orderId',
                message: 'Order ID must be a positive number',
            });
        }

        if (!userId || isNaN(Number(userId)) || Number(userId) <= 0) {
            errors.push({
                field: 'userId',
                message: 'User ID must be a positive number',
            });
        }

        if (!tradeType || typeof tradeType !== 'string') {
            errors.push({
                field: 'tradeType',
                message: 'Trade type is required',
            });
        }

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            errors.push({
                field: 'amount',
                message: 'Amount must be a positive number',
            });
        }

        if (errors.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors,
                data: null,
            });
            return;
        }

        next();
    }

    /**
     * Validate date range for reports
     */
    static validateDateRange(req: Request, res: Response, next: NextFunction): void {
        const { startDate, endDate } = req.query;
        const errors: ValidationError[] = [];

        // Parse dates
        const parsedStartDate = startDate ? new Date(startDate as string) : null;
        const parsedEndDate = endDate ? new Date(endDate as string) : null;

        if (startDate && isNaN(parsedStartDate?.getTime() || 0)) {
            errors.push({
                field: 'startDate',
                message: 'Start date must be a valid date format',
            });
        }

        if (endDate && isNaN(parsedEndDate?.getTime() || 0)) {
            errors.push({
                field: 'endDate',
                message: 'End date must be a valid date format',
            });
        }

        if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
            errors.push({
                field: 'dateRange',
                message: 'Start date cannot be after end date',
            });
        }

        if (errors.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors,
                data: null,
            });
            return;
        }

        next();
    }
}

export default SettlementValidator;
