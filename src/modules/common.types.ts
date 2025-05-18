import { StockExchange } from '@app/database/db';
import { JwtPayloadWithoutWildcard } from '@app/types';

export enum CredentialsType {
    EMAIL = 'email',
    PHONE = 'phone',
}

export type SessionJwtType = JwtPayloadWithoutWildcard & {
    userId: string;
};

export type UserIdParam = {
    userId: string;
};

export const Exchange: Record<StockExchange, StockExchange> = {
    NSE: 'NSE',
    BSE: 'BSE',
    MCX: 'MCX',
    NCDEX: 'NCDEX',
};
