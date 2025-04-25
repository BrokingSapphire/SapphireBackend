// src/validators/compliance.types.ts
import { ComplianceVerificationStatus } from '@app/database/db';

/**
 * Valid verification types from the database
 */
export type VerificationType =
    | 'pan'
    | 'aadhaar'
    | 'bank'
    | 'address'
    | 'signature'
    | 'ipv'
    | 'front_office'
    | 'trading_preferences'
    | 'nominee'
    | 'other_documents'
    | 'esign';

/**
 * Valid verification statuses matching the database enum
 */
export type VerificationStatus = ComplianceVerificationStatus;

/**
 * Valid verification steps for UI flow
 */
export type VerificationStep =
    | 'step1-pan'
    | 'step2-aadhar'
    | 'step3-bank'
    | 'step4-address'
    | 'step5-signature'
    | 'step6-ipv'
    | 'step7-fo'
    | 'step8-trading'
    | 'step9-nominee'
    | 'step10-other'
    | 'step11-esign';

/**
 * Interface for the request to update verification status
 */
export interface UpdateVerificationRequest {
    verificationType: VerificationType;
    status: VerificationStatus;
}

/**
 * Interface for the request to render verification detail
 */
export interface RenderVerificationDetailRequest {
    step: VerificationStep;
}

/**
 * Interface for checkpoint details returned from the API
 */
export interface CheckpointDetails {
    checkpoint_id: number;
    email: string;
    phone: string | null;
    pan_number: string | null;
    full_name: string | null;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    client_code: string;
    profile_image: string | null;
}

/**
 * Mapping between verification types and corresponding database field names
 */
export const verificationTypeToFieldMap: Record<VerificationType, string> = {
    'pan': 'pan_status',
    'aadhaar': 'aadhaar_status',
    'bank': 'bank_status',
    'address': 'address_status',
    'signature': 'signature_status',
    'ipv': 'ipv_status',
    'front_office': 'front_office_status',
    'trading_preferences': 'trading_preferences_status',
    'nominee': 'nominee_status',
    'other_documents': 'other_documents_status',
    'esign': 'esign_status'
};