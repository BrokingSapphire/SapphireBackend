import { JwtPayloadWithoutWildcard } from '@app/types';

export type JwtType = JwtPayloadWithoutWildcard & {
    userId: number;
};

export enum AccountStatus {
    ACTIVE = 'ACTIVE',
    DORMANT = 'DORMANT',
    SUSPENDED = 'SUSPENDED',
    PENDING_KYC = 'PENDING_KYC',
    CLOSED = 'CLOSED',
}

export enum RiskCategory {
    LOW = 'LOW',
    MODERATE = 'MODERATE',
    HIGH = 'HIGH',
}

// Classification groups for occupations
export enum OccupationRiskGroup {
    STABLE = 'STABLE', // Professional, Government/Public Sector, Business
    MEDIUM = 'MEDIUM', // Private Sector, Agriculturist
    VULNERABLE = 'VULNERABLE', // Student, Housewife, Retired, Others
}

export enum OrderValidity {
    DAY = 'day',
    IMMEDIATE = 'immediate',
    MINUTES = 'minutes',
}

export enum UserCategory {
    RETAIL = 'RETAIL', // Account Value ≤ 10,00,000
    HNI = 'HNI', // Account Value > 10,00,000 && ≤ 1,00,00,000
    ULTRA_HNI = 'ULTRA_HNI', // Account Value > 1,00,00,000
}
