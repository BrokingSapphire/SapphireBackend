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
