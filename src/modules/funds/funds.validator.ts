import Joi from 'joi';
import { DepositMode, WithdrawType } from './funds.types';

const DepositRequestSchema = Joi.object({
    amount: Joi.number().greater(0).required(),
    mode: Joi.string()
        .valid(...Object.values(DepositMode))
        .required(),
});

const WithdrawalRequestSchema = Joi.object({
    amount: Joi.number().positive().required(),
    bank_account_id: Joi.number().positive().required(),
    type: Joi.string()
        .valid(...Object.values(WithdrawType))
        .required(),
});

export { DepositRequestSchema, WithdrawalRequestSchema };
