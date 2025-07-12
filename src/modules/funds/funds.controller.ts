import { Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { Request, DefaultResponseData } from '@app/types.d';
import { db } from '@app/database';
import { CREATED, OK } from '@app/utils/httpstatus';
import { NTTPaymentService } from '@app/services/ntt-pg.service';
import { env } from '@app/env';
import { BalanceTransactionStatus, DepositTransactionType } from '@app/database/db';
import { SessionJwtType } from '../common.types';
import {
    DepositFundsPayload,
    WithdrawFundsPayload,
    GetTransactionsQuery,
    TransactionParam,
    DepositMode,
} from './funds.types';
import IdGenerator from '@app/services/id-generator';

/**
 * Get user funds
 */
const getUserFunds = async (req: Request<SessionJwtType, ParamsDictionary>, res: Response): Promise<void> => {
    const balance = await db
        .selectFrom('user_balance')
        .select([
            'available_cash',
            'blocked_cash',
            'total_cash',
            'available_margin',
            'blocked_margin',
            'total_margin',
            'total_available_balance',
            'total_balance',
        ])
        .where('user_id', '=', req.auth!!.userId)
        .executeTakeFirstOrThrow();

    res.status(OK).json({
        message: 'User balance fetched successfully',
        data: balance,
    });
};

const getBankAccounts = async (req: Request<SessionJwtType, ParamsDictionary>, res: Response): Promise<void> => {
    const bankAccounts = await db
        .selectFrom('bank_account')
        .innerJoin('bank_to_user', 'bank_to_user.bank_account_id', 'bank_account.id')
        .select(['bank_account.id', 'account_no'])
        .where('user_id', '=', req.auth!!.userId)
        .where('verification', '=', 'verified')
        .execute();

    res.status(OK).json({
        message: 'Bank accounts fetched successfully',
        data: bankAccounts.map((account) => ({
            id: account.id,
            account_no: `XXXXXXXXXXXXXX${account.account_no.slice(-4)}`,
        })),
    });
};

/**
 * Add funds to user account
 */
const depositFunds = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, DepositFundsPayload>,
    res: Response,
): Promise<void> => {
    const { userId } = req.auth!;
    const { amount, mode } = req.body;

    const bankAccountId = mode === DepositMode.NB ? req.body.bank_account_id : undefined;
    const payVPA = mode === DepositMode.UPI ? req.body.payVPA : undefined;

    const merchantTxnId = await new IdGenerator('transaction_ref').nextValue({
        mode: 'DP',
    });
    const paymentService = new NTTPaymentService(
        `${req.protocol}://${req.hostname}:${req.socket.localPort}${env.apiPath}/webhook/deposit/callback`,
    );

    const details = await db
        .selectFrom('user')
        .innerJoin('phone_number', 'user.phone', 'phone_number.id')
        .innerJoin('user_name', 'user_name.id', 'user.name')
        .innerJoin('bank_to_user', 'bank_to_user.user_id', 'user.id')
        .innerJoin('bank_account', 'bank_account.id', 'bank_to_user.bank_account_id')
        .select([
            'user_name.full_name',
            'user_name.first_name',
            'user.email',
            'phone_number.phone',
            'bank_account.account_no',
            'bank_account.ifsc_code',
        ])
        .where('user.id', '=', userId)
        .$if(mode === DepositMode.UPI, (qb) => qb.where('bank_to_user.is_primary', '=', true))
        .$if(mode === DepositMode.NB, (qb) => qb.where('bank_account.id', '=', bankAccountId!))
        .executeTakeFirstOrThrow();

    const paymentUrl = await paymentService.createPaymentRequest(
        amount.toFixed(2),
        merchantTxnId,
        userId,
        {
            custFirstName: details.first_name,
            custLastName: null,
            custEmail: details.email,
            custMobile: details.phone,
        },
        {
            custAccNo: details.account_no,
            custAccIfsc: details.ifsc_code,
        },
        mode === DepositMode.UPI ? 'UP' : 'NB',
        payVPA,
    );

    res.status(OK).json({
        message: 'Deposit url generated successfully',
        data: {
            url: paymentUrl,
        },
    });
};

/**
 * Withdraw funds - standard withdrawal
 */
const withdrawFunds = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, WithdrawFundsPayload>,
    res: Response,
): Promise<void> => {
    const { userId } = req.auth!;
    const { amount, bank_account_id, type } = req.body;

    const bankDetails = await db
        .selectFrom('bank_to_user')
        .innerJoin('bank_account', 'bank_account.id', 'bank_to_user.bank_account_id')
        .select(['bank_account.account_no', 'bank_account.ifsc_code'])
        .where('user_id', '=', userId)
        .where('bank_account_id', '=', bank_account_id)
        .executeTakeFirstOrThrow();

    if (type === 'Instant') {
        // TODO: Implement instant withdrawal logic

        res.status(OK).json({
            message: 'Withdrawal request sent successfully',
        });
    } else {
        await db
            .transaction()
            .setIsolationLevel('serializable')
            .execute(async (tx) => {
                const txnId = await new IdGenerator('transaction_ref').nextValue({
                    mode: 'WD',
                });
                await tx
                    .insertInto('balance_transactions')
                    .values({
                        reference_no: txnId,
                        transaction_id: txnId, // TODO: Get from pg
                        user_id: userId,
                        transaction_type: 'withdrawal',
                        status: 'pending',
                        bank_id: bank_account_id,
                        amount,
                        safety_cut_amount: 0, // TODO: Implement safety cut logic
                        safety_cut_percentage: 0,
                        transaction_time: new Date(),
                    })
                    .execute();
            });

        res.status(CREATED).json({
            message: 'Withdrawal request created successfully',
        });
    }
};

/**
 * Get user transactions
 */
const getUserTransactions = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, any, GetTransactionsQuery>,
    res: Response,
): Promise<void> => {
    const { limit, offset, transaction_type, status } = req.query;

    const { count } = db.fn;
    const result = await db
        .with('all_txn', (tx) =>
            tx
                .selectFrom('balance_transactions')
                .select(['transaction_id', 'transaction_type', 'status', 'amount', 'created_at', 'updated_at'])
                .where('user_id', '=', req.auth!!.userId),
        )
        .with('count_all_txn', (tx) => tx.selectFrom('all_txn').select(count('transaction_id').as('total')))
        .with('filtered_txn', (tx) =>
            tx
                .selectFrom('all_txn')
                .selectAll()
                .$if(status !== undefined, (qb) => qb.where('status', '=', status as BalanceTransactionStatus))
                .$if(transaction_type !== undefined, (qb) =>
                    qb.where('transaction_type', '=', transaction_type as DepositTransactionType),
                )
                .orderBy('created_at', 'desc'),
        )
        .with('count_filtered_txn', (tx) =>
            tx.selectFrom('filtered_txn').select(count('transaction_id').as('filtered_total')),
        )
        .with('paginated_result', (tx) =>
            tx
                .selectFrom('filtered_txn')
                .selectAll()
                .$if(limit !== undefined, (qb) => qb.limit(Number(limit)))
                .$if(offset !== undefined, (qb) => qb.offset(Number(offset))),
        )
        .selectFrom('paginated_result')
        .leftJoin('count_all_txn', (eb) => eb.onTrue()) // Always true condition to join
        .leftJoin('count_filtered_txn', (eb) => eb.onTrue()) // Always true condition to join
        .select([
            'paginated_result.transaction_id',
            'paginated_result.transaction_type',
            'paginated_result.status',
            'paginated_result.amount',
            'paginated_result.created_at',
            'paginated_result.updated_at',
            'count_filtered_txn.filtered_total',
            'count_all_txn.total',
        ])
        .execute();

    res.status(OK).json({
        message: 'Users Transaction Fetched Successfully',
        data: {
            all: result.length > 0 ? result[0].total : 0,
            total: result.length > 0 ? result[0].filtered_total : 0,
            pageTotal: result.length,
            transactions: result.map((txn) => ({
                transaction_id: txn.transaction_id,
                transaction_type: txn.transaction_type,
                status: txn.status,
                amount: txn.amount,
                created_at: txn.created_at,
                updated_at: txn.updated_at,
            })),
        },
    });
};

/**
 * Get transaction by ID
 */
const getTransactionInfo = async (req: Request<SessionJwtType, TransactionParam>, res: Response): Promise<void> => {
    const { id } = req.params;
    const transaction = await db
        .selectFrom('balance_transactions')
        .innerJoin('bank_account', 'balance_transactions.bank_id', 'bank_account.id')
        .select([
            'balance_transactions.transaction_id',
            'balance_transactions.transaction_type',
            'balance_transactions.status',
            'balance_transactions.amount',
            'balance_transactions.created_at',
            'balance_transactions.updated_at',
            'bank_account.account_no',
            'bank_account.ifsc_code',
        ])
        .where('transaction_id', '=', id)
        .executeTakeFirstOrThrow();

    res.status(OK).json({
        message: 'Transaction details fetched successfully',
        data: {
            transactionId: transaction.transaction_id,
            transactionType: transaction.transaction_type,
            status: transaction.status,
            amount: transaction.amount,
            createdAt: transaction.created_at,
            updatedAt: transaction.updated_at,
            bankAccount: {
                accountNo: `XXXXXXXXXXXXXX${transaction.account_no.slice(-4)}`,
                ifscCode: transaction.ifsc_code,
            },
        },
    });
};

export { getUserFunds, depositFunds, withdrawFunds, getUserTransactions, getTransactionInfo, getBankAccounts };
