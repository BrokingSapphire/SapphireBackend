import { BalanceTransactionStatus, DepositTransactionType } from '@app/database/db';
import { Pretty, ToDiscoUnion } from '@app/types';

export enum DepositMode {
    UPI = 'UPI',
    NB = 'NB',
}

export enum WithdrawType {
    NORMAL = 'Normal',
    INSTANT = 'Instant',
}

export type DepositFundsPayload = Pretty<
    {
        amount: number;
        redirect?: string;
    } & ToDiscoUnion<
        {
            [DepositMode.UPI]: { payVPA: string };
            [DepositMode.NB]: { bank_account_id: number };
        },
        'mode'
    >
>;

export type WithdrawFundsPayload = {
    amount: number;
    bank_account_id: number;
    type: WithdrawType;
};

// Query parameter types
export type GetTransactionsQuery = {
    limit?: number;
    offset?: number;
    transaction_type?: DepositTransactionType;
    status?: BalanceTransactionStatus;
};

// Route parameter types
export type TransactionParam = {
    id: string;
};
