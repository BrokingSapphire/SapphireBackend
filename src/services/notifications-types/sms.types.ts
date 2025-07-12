export enum SmsTemplateType {
    WITHDRAWAL_PROCESSED = 'WITHDRAWAL_PROCESSED',
    ACCOUNT_SUCCESSFULLY_OPENED = 'ACCOUNT_SUCCESSFULLY_OPENED',
    DOCUMENTS_RECEIVED_CONFIRMATION = 'DOCUMENTS_RECEIVED_CONFIRMATION',
    MARGIN_SHORTFALL_ALERT = 'MARGIN_SHORTFALL_ALERT',
    TERMINAL_PWD_RESET_OTP = 'TERMINAL_PWD_RESET_OTP',
    TWO_FACTOR_AUTHENTICATION_OTP = 'TWO_FACTOR_AUTHENTICATION_OTP',
    PAYOUT_REJECTED = 'PAYOUT_REJECTED',
    DOCUMENTS_REJECTED_NOTIFICATION = 'DOCUMENTS_REJECTED_NOTIFICATION',
    KYC_UPDATE_REQUIRED = 'KYC_UPDATE_REQUIRED',
    SAPPHIRE_SIGNUP = 'SAPPHIRE_SIGNUP',
    PASSWORD_CHANGE_CONFIRMATION = 'PASSWORD_CHANGE_CONFIRMATION',
    FUNDS_ADDED = 'FUNDS_ADDED',
    ACCOUNT_SUSPENSION_NOTICE = 'ACCOUNT_SUSPENSION_NOTICE',
    FORGET_MPIN = 'FORGET_MPIN',
    MPIN_CHANGE_CONFIRMATION = 'MPIN_CHANGE_CONFIRMATION',
    SEGMENT_MODIFICATION_OTP = 'SEGMENT_MODIFICATION_OTP',
    SEGMENT_MODIFICATION_APPROVED = 'SEGMENT_MODIFICATION_APPROVED',
    SEGMENT_MODIFICATION_REJECTED = 'SEGMENT_MODIFICATION_REJECTED',
    BANK_ACCOUNT_ADDITION_OTP = 'BANK_ACCOUNT_ADDITION_OTP',
    BANK_ACCOUNT_ADDITION_CONFIRMATION = 'BANK_ACCOUNT_ADDITION_CONFIRMATION',
    BANK_ACCOUNT_ADDITION_REJECTION = 'BANK_ACCOUNT_ADDITION_REJECTION',
    DEMAT_ACCOUNT_FREEZE_OTP = 'DEMAT_ACCOUNT_FREEZE_OTP',
    RUNNING_ACCOUNT_SETTLEMENT_OTP = 'RUNNING_ACCOUNT_SETTLEMENT_OTP',
}

// mapping of SMS template types to their content

const templateContentMap: Record<SmsTemplateType, string> = {
    [SmsTemplateType.WITHDRAWAL_PROCESSED]:
        'Dear {#name#}, your withdrawal request of ₹{#amount#} has been processed. Expected credit within {#time#} hours. Sapphire Broking',

    [SmsTemplateType.ACCOUNT_SUCCESSFULLY_OPENED]:
        'Dear {#name#}, your Sapphire account is now active! Start trading now: terminal.sapphirebroking.com. Sapphire Broking',

    [SmsTemplateType.DOCUMENTS_RECEIVED_CONFIRMATION]:
        'Dear {#name#}, we have received your documents for account opening. Your account will be activated within 12 to 24 working hours. Sapphire Broking',

    [SmsTemplateType.MARGIN_SHORTFALL_ALERT]:
        'Dear {#name#}, your account margin is low, and you have a margin shortfall of ₹{#amount#}. Please add funds to avoid an RMS square off. Sapphire Broking',

    [SmsTemplateType.TERMINAL_PWD_RESET_OTP]:
        'Your OTP to reset your Sapphire Terminal password is {#otp#}. Do not share this OTP. It is valid for 10 minutes. Sapphire Broking',

    [SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP]:
        'Your 2FA OTP for Sapphire Broking is {#otp#}. Do not share this with anyone. Sapphire Broking',

    [SmsTemplateType.PAYOUT_REJECTED]:
        'Dear {#name#}, your payout request of ₹{#amount#} has been rejected due to {#reason#}. Please check and retry. Sapphire Broking',

    [SmsTemplateType.DOCUMENTS_REJECTED_NOTIFICATION]:
        'Dear {#name#}, your account opening documents have been rejected due to {#reason#}. Please resubmit the correct documents to proceed. Upload here: https://www.sapphirebroking.com/signup Sapphire Broking',

    [SmsTemplateType.KYC_UPDATE_REQUIRED]:
        'Dear {#name#}, your KYC details need to be updated to continue using our services. Update here: https://www.sapphirebroking.com/signup Sapphire Broking',

    [SmsTemplateType.SAPPHIRE_SIGNUP]:
        'Welcome to Sapphire! Your OTP for signup is {#otp#}. Do not share this OTP with anyone. It is valid for 10 minutes. Sapphire Broking',

    [SmsTemplateType.PASSWORD_CHANGE_CONFIRMATION]:
        "Dear {#name#}, your Sapphire Terminal password has been changed successfully. If this wasn't you, contact support immediately. Sapphire Broking",

    [SmsTemplateType.FUNDS_ADDED]:
        'Dear {#name#}, ₹{#amount#} has been successfully added to your trading account. Available balance: ₹{#balance#}. Sapphire Broking',

    [SmsTemplateType.ACCOUNT_SUSPENSION_NOTICE]:
        'Dear {#name#}, your account has been temporarily suspended due to {#reason#}. Contact support for assistance. Sapphire Broking',

    [SmsTemplateType.FORGET_MPIN]:
        'Your OTP to reset your Sapphire Terminal MPIN is {#otp#}. Do not share this OTP. It is valid for 10 minutes. Sapphire Broking',

    [SmsTemplateType.MPIN_CHANGE_CONFIRMATION]:
        "Dear {#name#}, your Sapphire Terminal MPIN has been changed successfully. If this wasn't you, contact support immediately. Sapphire Broking",

    [SmsTemplateType.SEGMENT_MODIFICATION_OTP]:
        'Dear {#name#}, your OTP for segment modification is {#otp#}. Do not share this OTP. It is valid for 10 minutes. Sapphire Broking',

    [SmsTemplateType.SEGMENT_MODIFICATION_APPROVED]:
        'Dear {#name#}, your segment modification request has been approved. You can start trading in the new segment now. Sapphire Broking',

    [SmsTemplateType.SEGMENT_MODIFICATION_REJECTED]:
        'Dear {#name#}, your segment modification request has been rejected due to {#reason#}. Please resolve the mentioned discrepancies and reapply. Sapphire Broking',

    [SmsTemplateType.BANK_ACCOUNT_ADDITION_OTP]:
        'Dear {#name#}, your OTP for adding a bank account is {#otp#}. Do not share this OTP. It is valid for 10 minutes. Sapphire Broking',

    [SmsTemplateType.BANK_ACCOUNT_ADDITION_CONFIRMATION]:
        "Dear {#name#}, your bank account has been added successfully. If this wasn't you, contact support immediately. Sapphire Broking",

    [SmsTemplateType.BANK_ACCOUNT_ADDITION_REJECTION]:
        'Dear {#name#}, your bank account addition request has been rejected due to {#reason#}. Please resolve the mentioned discrepancies and reapply. Sapphire Broking',

    [SmsTemplateType.DEMAT_ACCOUNT_FREEZE_OTP]:
        'Dear {#name#}, your OTP for freezing your demat account is {#otp#}. Do not share this OTP. It is valid for 10 minutes. Sapphire Broking',

    [SmsTemplateType.RUNNING_ACCOUNT_SETTLEMENT_OTP]:
        'Dear {#name#}, your OTP for running account settlement is {#otp#}. Do not share this OTP. It is valid for 10 minutes. Sapphire Broking',
};

export default templateContentMap;
