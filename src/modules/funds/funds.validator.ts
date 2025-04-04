// funds.validator.ts
import Joi from 'joi';

// Using Joi for deposit req. validation
const DepositRequestSchema = Joi.object({
    amount: Joi.number().positive().required(),
    bankAccountId: Joi.number().positive().required(),
    remarks: Joi.string().optional().allow(null, ''),
});

// FOr withdrawl Request Validation
const WithdrawalRequestSchema = Joi.object({
    amount: Joi.number().positive().required(),
    bankAccountId: Joi.number().positive().required(),
    remarks: Joi.string().optional().allow(null, ''),
});

//  Transaction ID
const TransactionIdSchema = Joi.object({
    transactionId: Joi.number().positive().required(),
});

// User id Validation
const UserIdSchema = Joi.object({
    userId: Joi.number().positive().required(),
});

// pagination

const PaginationSchema = Joi.object({
    limit: Joi.number().integer().min(1).optional(),
    offset: Joi.number().integer().min(0).optional(),
}).unknown(true);

export { DepositRequestSchema, WithdrawalRequestSchema, TransactionIdSchema, UserIdSchema, PaginationSchema };
