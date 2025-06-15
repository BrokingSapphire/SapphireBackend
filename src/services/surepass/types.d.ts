export interface PrefillOptions {
    full_name: string;
    mobile_number: string;
    user_email: string;
}

export interface DigiLockerInitializeRequest {
    prefill_options: PrefillOptions;
    expiry_minutes: number;
    send_sms: boolean;
    send_email: boolean;
    verify_phone: boolean;
    verify_email: boolean;
    signup_flow: boolean;
    redirect_url: string;
    state: string;
}

export interface BankVerificationDetails {
    id_number: string;
    ifsc: string;
    ifsc_details: boolean;
}

export interface ESignPosition {
    x: number;
    y: number;
}

export interface ESignPositions {
    [page: string]: ESignPosition[];
}

export interface ESignConfig {
    accept_selfie: boolean;
    allow_selfie_upload: boolean;
    accept_virtual_sign: boolean;
    track_location: boolean;
    auth_mode: string;
    reason: string;
    positions: ESignPositions;
    skip_otp?: boolean;
    skip_email?: boolean;
}

export interface ESignInitializeRequest {
    file_id?: string;
    send_email?: boolean;
    pdf_pre_uploaded?: boolean;
    callback_url?: string;
    redirect_url?: string;
    config: ESignConfig;
    prefill_options?: PrefillOptions;
    previous_client_id?: string;
    testing_mode?: boolean;
    aadhaar_esign_backend?: string;
    expiry_minutes?: number;
    sign_type?: string;
    state?: string;
}

export interface ESignInitializeResponse {
    data: {
        token: string;
        client_id: string;
        url: string;
    };
    message_code: string;
    success: boolean;
    message: string;
    status_code: number;
}

export interface ESignStatusResponse {
    data: {
        status: string;
        completed: boolean;
        signed_document_url?: string;
        failure_reason?: string;
    };
    message_code: string;
    success: boolean;
    message: string;
    status_code: number;
}

export interface ESignDownloadResponse {
    data: {
        download_url: string;
        file_name: string;
        mime_type: string;
    };
    message_code: string;
    success: boolean;
    message: string;
    status_code: number;
}
