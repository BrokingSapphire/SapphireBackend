import { JwtPayloadWithoutWildcard } from '@app/types';

export type LoginJwtType = JwtPayloadWithoutWildcard & {
    clientId: string;
    userId: string;
};

