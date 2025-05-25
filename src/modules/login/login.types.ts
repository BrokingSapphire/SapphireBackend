import { DefaultResponseData, Pretty } from '@app/types';

export type LoginResponseWithToken = DefaultResponseData<{
    isFirstLogin: boolean;
}> & {
    token: string;
};

export type EmailOrClientId = {
    clientId: string;
} | {
    email: string;
};

export type LoginRequestType = Pretty<EmailOrClientId & {
    password: string;
}>;

export type LoginOtpVerifyRequestType = Pretty<EmailOrClientId & {
    otp: string;
}>;

export type ResetPasswordRequestType = {
    currentPassword: string;
    newPassword: string;
};

export type ForgotPasswordInitiateRequestType = {
    panNumber: string;
    recaptchaToken: string;
};

export type ForgotPasswordInitiateResponseType = DefaultResponseData<{
    requestId: string;
}>;

export type ForgotPasswordVerifyOtpRequestType = {
    requestId: string;
    emailOtp: string;
    phoneOtp: string;
};

export type ForgotPasswordVerifyOtpResponseType = DefaultResponseData & {
    token: string;
};

export type ForgotPasswordResetRequestType = {
    newPassword: string;
};