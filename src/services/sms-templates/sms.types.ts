export enum SmsTemplateType {
    WITHDRAWAL_PROCESSED = 'WITHDRAWAL_PROCESSED',
    TERMINAL_LOGIN_OTP = 'TERMINAL_LOGIN_OTP',
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
}

// mapping of SMS template types to their content

const templateContentMap: Record<SmsTemplateType, string> = {
    [SmsTemplateType.WITHDRAWAL_PROCESSED]:
        'Dear {#var#}, your withdrawal request of ₹{#var#} has been processed. Expected credit within {#var#} hours. - Sapphire Broking',

    [SmsTemplateType.TERMINAL_LOGIN_OTP]:
        'Your OTP for Sapphire Terminal login is {#var#}. Do not share this OTP with anyone. It is valid for 10 minutes. - Sapphire Broking',

    [SmsTemplateType.ACCOUNT_SUCCESSFULLY_OPENED]:
        'Dear {#var#}, your Sapphire account is now active! Start trading now: terminal.sapphirebroking.com - Sapphire Broking',

    [SmsTemplateType.DOCUMENTS_RECEIVED_CONFIRMATION]:
        'Dear {#var#}, we have received your documents for account opening. Your account will be activated within 12-24 working hours. - Sapphire Broking',

    [SmsTemplateType.MARGIN_SHORTFALL_ALERT]:
        'Dear {#var#}, your account margin is low, and you have a margin shortfall of ₹{#var#}. Please add funds to avoid an RMS square-off. - Sapphire Broking',

    [SmsTemplateType.TERMINAL_PWD_RESET_OTP]:
        'Your OTP to reset your Sapphire Terminal password is {#var#}. Do not share this OTP. It is valid for 10 minutes. - Sapphire Broking',

    [SmsTemplateType.TWO_FACTOR_AUTHENTICATION_OTP]:
        'Your 2FA OTP for Sapphire Broking is {#var#}. Do not share this with anyone. - Sapphire Broking',

    [SmsTemplateType.PAYOUT_REJECTED]:
        'Dear {#var#}, your payout request of ₹{#var#} has been rejected due to {#var#}. Please check and retry. - Sapphire Broking',

    [SmsTemplateType.DOCUMENTS_REJECTED_NOTIFICATION]:
        'Dear {#var#}, your account opening documents have been rejected due to {#var#}. Please resubmit the correct documents to proceed. Upload here: https://www.sapphirebroking.com/signup - Sapphire Broking',

    [SmsTemplateType.KYC_UPDATE_REQUIRED]:
        'Dear {#var#}, your KYC details need to be updated to continue using our services. Update here: https://www.sapphirebroking.com/signup - Sapphire Broking',

    [SmsTemplateType.SAPPHIRE_SIGNUP]:
        'Welcome to Sapphire! Your OTP for signup is {#var#}. Do not share this OTP with anyone. It is valid for 10 minutes. - Sapphire Broking',

    [SmsTemplateType.PASSWORD_CHANGE_CONFIRMATION]:
        "Dear {#var#}, your Sapphire Broking password has been changed successfully. If this wasn't you, contact support immediately. - Sapphire Broking",

    [SmsTemplateType.FUNDS_ADDED]:
        'Dear {#var#}, ₹{#var#} has been successfully added to your trading account. Available balance: ₹{#var#}. - Sapphire Broking',

    [SmsTemplateType.ACCOUNT_SUSPENSION_NOTICE]:
        'Dear {#var#}, your account has been temporarily suspended due to {#var#}. Contact support for assistance. - Sapphire Broking',
};

export default templateContentMap;
