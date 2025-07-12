import Joi from 'joi';
import { DepositMode, WithdrawType } from './funds.types';

// --- PAYLOAD SCHEMAS (BODY) ---
export const DepositFundsPayloadSchema = Joi.object({
    amount: Joi.number().positive().precision(2).required(),
    mode: Joi.string()
        .valid(...Object.values(DepositMode))
        .required(),
    bank_account_id: Joi.number().positive().when('mode', {
        is: DepositMode.NB,
        then: Joi.required(),
    }),
    payVPA: Joi.string().when('mode', {
        is: DepositMode.UPI,
        then: Joi.required(),
        otherwise: Joi.forbidden(),
    }),
});

export const WithdrawFundsPayloadSchema = Joi.object({
    amount: Joi.number().positive().precision(2).required(),
    bank_account_id: Joi.number().positive().required(),
    type: Joi.string()
        .valid(...Object.values(WithdrawType))
        .required(),
});

// --- QUERY SCHEMAS ---
export const GetTransactionsQuerySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
    transaction_type: Joi.string().valid('deposit', 'withdrawal').optional(),
    status: Joi.string().valid('pending', 'completed', 'failed', 'rejected').optional(),
});

// --- PARAM SCHEMAS ---
export const TransactionParamSchema = Joi.object({
    id: Joi.string().required(),
});
