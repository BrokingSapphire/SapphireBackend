// import Joi from 'joi';
// import { TransactionType, TransactionStatus, ProcessingWindow } from './funds.types';

// const AddFundsSchema = Joi.object({
//     amount: Joi.number().positive().required(),
//     bankAccountId: Joi.number().required(),
//     remarks: Joi.string().optional(),
//     transaction_type: Joi.string()
//         .valid(TransactionType.DEPOSIT)
//         .required(),
// });

// const WithdrawFundsSchema = Joi.object({
//     amount: Joi.number().positive().required(),
//     bankAccountId: Joi.number().required(),
//     remarks: Joi.string().optional(),
//     transaction_type: Joi.string()
//         .valid(TransactionType.WITHDRAWAL)
//         .required(),
//     processing_window: Joi.string()
//         .valid(...Object.values(ProcessingWindow))
//         .optional(),
// });

// const UpdateTransactionSchema = Joi.object({
//     status: Joi.string()
//         .valid(...Object.values(TransactionStatus))
//         .required(),
//     remarks: Joi.string().optional(),
//     processed_at: Joi.date().optional(),
// });

// const GetTransactionsSchema = Joi.object({
//     userId: Joi.number().required(),
//     limit: Joi.number().min(1).max(100).default(20),
//     offset: Joi.number().min(0).default(0),
//     transaction_type: Joi.string()
//         .valid(...Object.values(TransactionType))
//         .optional(),
//     status: Joi.string()
//         .valid(...Object.values(TransactionStatus))
//         .optional(),
//     from_date: Joi.date().optional(),
//     to_date: Joi.date().optional(),
// });

// const GetUserFundsSchema = Joi.object({
//     userId: Joi.number().required()
// });

// export {
//     AddFundsSchema,
//     WithdrawFundsSchema,
//     UpdateTransactionSchema,
//     GetTransactionsSchema,
//     GetUserFundsSchema
// };


// funds.validator.ts


import { Request, Response, NextFunction } from 'express';
import { DepositRequest, WithdrawalProcessRequest } from './funds.types';

/**
 * Validator middleware for funds deposit request
 */
export const validateDepositRequest = (req: Request, res: Response, next: NextFunction) => {
  const { amount, bankAccountId } = req.body as DepositRequest;
  
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid amount. Must be a positive number.'
    });
  }
  
  if (!bankAccountId || isNaN(Number(bankAccountId))) {
    return res.status(400).json({
      success: false,
      message: 'Bank account ID is required and must be a number'
    });
  }
  
  next();
};

/**
 * Validator middleware for funds withdrawal request
 */
export const validateWithdrawalRequest = (req: Request, res: Response, next: NextFunction) => {
  const { amount, bankAccountId } = req.body as WithdrawalProcessRequest;
  
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid amount. Must be a positive number.'
    });
  }
  
  if (!bankAccountId || isNaN(Number(bankAccountId))) {
    return res.status(400).json({
      success: false,
      message: 'Bank account ID is required and must be a number'
    });
  }
  
  next();
};

/**
 * Validator middleware for transaction ID
 */
export const validateTransactionId = (req: Request, res: Response, next: NextFunction) => {
  const transactionId = parseInt(req.params.transactionId);
  
  if (isNaN(transactionId) || transactionId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid transaction ID'
    });
  }
  
  next();
};

/**
 * Validator middleware for user ID
 */
export const validateUserId = (req: Request, res: Response, next: NextFunction) => {
  const userId = parseInt(req.params.userId);
  
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID'
    });
  }
  
  next();
};

/**
 * Validator middleware for pagination params
 */
export const validatePaginationParams = (req: Request, res: Response, next: NextFunction) => {
  let { limit, offset } = req.query;
  
  if (limit !== undefined && (isNaN(Number(limit)) || Number(limit) < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid limit parameter'
    });
  }
  
  if (offset !== undefined && (isNaN(Number(offset)) || Number(offset) < 0)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid offset parameter'
    });
  }
  
  next();
};