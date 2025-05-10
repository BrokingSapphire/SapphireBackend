import { StockExchange } from '@app/database/db';
import { JwtPayloadWithoutWildcard } from '@app/types';

export enum CredentialsType {
    EMAIL = 'email',
    PHONE = 'phone',
}

export type SessionJwtType = JwtPayloadWithoutWildcard & {
    userId: number;
};

export type UserIdParam = {
    userId: number;
};

export const Exchange: Record<StockExchange, StockExchange> = {
    NSE: 'NSE',
    BSE: 'BSE',
    MCX: 'MCX',
    NCDEX: 'NCDEX',
};
