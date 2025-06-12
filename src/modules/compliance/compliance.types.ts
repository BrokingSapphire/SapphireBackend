import { SignupVerificationStatus } from '@app/database/db';

/**
 * Valid verification types from the database
 */
export enum VerificationType {
    PAN = 'pan',
    AADHAAR = 'aadhaar',
    BANK = 'bank',
    ADDRESS = 'address',
    SIGNATURE = 'signature',
    IPV = 'ipv',
    FRONT_OFFICE = 'front_office',
    TRADING_PREFERENCES = 'trading_preferences',
    NOMINEE = 'nominee',
    OTHER_DOCUMENTS = 'other_documents',
    ESIGN = 'esign',
    DEMAT = 'demat',
}

export type VerificationState = 'approve' | 'reject';

/**
 * Interface for the request to update verification status
 */
export interface UpdateVerificationRequest {
    verificationType: VerificationType;
    status: VerificationState;
}

export interface AddDematAccountRequest {
    depository: 'CDSL' | 'NSDL';
    dp_name: string;
    dp_id: string;
    bo_id: string;
    client_name: string;
}

/**
 * Mapping between verification types and corresponding database field names
 */
export const verificationTypeToFieldMap: Record<VerificationType, keyof SignupVerificationStatus> = {
    pan: 'pan_status',
    aadhaar: 'aadhaar_status',
    bank: 'bank_status',
    address: 'address_status',
    signature: 'signature_status',
    ipv: 'ipv_status',
    front_office: 'front_office_status',
    trading_preferences: 'trading_preferences_status',
    nominee: 'nominee_status',
    other_documents: 'other_documents_status',
    esign: 'esign_status',
    demat: 'demat_status' as keyof SignupVerificationStatus,
};
