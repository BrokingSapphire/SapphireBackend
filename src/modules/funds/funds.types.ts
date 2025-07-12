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

// Request payload types
// export type DepositFundsPayload = {
//     amount: number;
//     mode: DepositMode;
//     bank_account_id: number; // Always required in body, logic handles when to use it
//     payVPA?: string; // Optional VPA for UPI payments
// };
export type DepositFundsPayload = Pretty<
    {
        amount: number;
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
