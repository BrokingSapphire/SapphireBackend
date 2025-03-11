interface JwtType {
    email: string;
    phone: string;
}

enum CredentialsType {
    EMAIL = 'email',
    PHONE = 'phone',
}

enum CheckpointStep {
    CREDENTIALS = 'credentials',
    PAN = 'pan',
    AADHAAR_URI = 'aadhaar_uri',
    AADHAAR = 'aadhaar',
    INVESTMENT_SEGMENT = 'investment_segment',
}

enum InvestmentSegment {
    EQUITY = 'equity',
    DEBT = 'debt',
}

export { JwtType, CredentialsType, CheckpointStep };
