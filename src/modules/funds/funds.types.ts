import { JwtPayloadWithoutWildcard } from '@app/types';

export type JwtType = JwtPayloadWithoutWildcard & {
    userId: number;
};

export enum DepositMode {
    UPI = 'UPI',
    NB = 'NB',
}

export enum WithdrawType {
    NORMAL = 'Normal',
    INSTANT = 'Instant',
}
