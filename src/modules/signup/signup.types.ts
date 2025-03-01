enum CredentialsType {
    EMAIL = 'email',
    PHONE = 'phone',
}

enum CheckpointStep {
    CREDENTIALS = 'credentials',
    PAN = 'pan',
    AADHAAR = 'aadhaar',
    INVESTMENT_SEGMENT = 'investment_segment',
}

enum InvestmentSegment {
    EQUITY = 'equity',
    DEBT = 'debt',
}

export { CredentialsType, CheckpointStep };
