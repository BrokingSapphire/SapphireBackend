// rms.types

import { UserInvestmentSegment } from '@app/database/db';

export enum AccountStatus {
    ACTIVE = 'ACTIVE',
    DORMANT = 'DORMANT',
    SUSPENDED = 'SUSPENDED',
    PENDING_KYC = 'PENDING_KYC',
    CLOSED = 'CLOSED'
  }

  export interface AccountStatusValidationResult {
    isValid: boolean;
    status: AccountStatus;
    reason: string;
    additionalInfo?: {
      restrictedFeatures?: string[];
      reactivationSteps?: string[];
      requiredActions?: string[];
    };
  }

  export interface KycDetails {
    panVerified: boolean;
    aadhaarVerified: boolean;
    bankVerified: boolean;
    ipvCompleted: boolean;
    pendingItems: string[];
  }

  export interface SuspensionDetails {
    reason: string;
    requiredAction: string;
  }

  export interface SegmentValidationResult {
    isValid: boolean;
    segment: UserInvestmentSegment;
    reason: string;
    additionalInfo?: {
      activatedSegments?: UserInvestmentSegment[];
      activationSteps?: string[];
    };
  }
  

  