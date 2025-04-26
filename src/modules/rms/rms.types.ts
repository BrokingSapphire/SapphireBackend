// rms.types

export enum AccountStatus {
    ACTIVE = 'ACTIVE',
    DORMANT = 'DORMANT',
    SUSPENDED = 'SUSPENDED',
    PENDING_KYC = 'PENDING_KYC',
    CLOSED = 'CLOSED'
}

export enum RiskCategory {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH'
}

// Classification groups for occupations
export enum OccupationRiskGroup {
  STABLE = 'STABLE',    // Professional, Government/Public Sector, Business
  MEDIUM = 'MEDIUM',    // Private Sector, Agriculturist
  VULNERABLE = 'VULNERABLE'  // Student, Housewife, Retired, Others
}

export enum OrderValidity {
  DAY = 'day',
  IMMEDIATE = 'immediate',
  MINUTES = 'minutes'
}