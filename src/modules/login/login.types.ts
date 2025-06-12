import { DefaultResponseData, Pretty } from '@app/types';

// export type LoginResponseWithToken = DefaultResponseData<{
//     isFirstLogin: boolean;
// }> & {
//     token: string;
// };

export type EmailOrClientId =
    | {
          clientId: string;
      }
    | {
          email: string;
      };

export type LoginRequestType = Pretty<
    EmailOrClientId & {
        password: string;
    }
>;

export type LoginOtpVerifyRequestType = Pretty<
    EmailOrClientId & {
        otp: string;
        sessionId: string;
    }
>;

export type ResetPasswordRequestType = {
    currentPassword: string;
    newPassword: string;
};

export type ForgotPasswordRequestType = {
    panNumber: string;
};

export type ForgotOTPVerifyRequestType = {
    requestId: string;
    emailOtp: string;
};

export type ResendForgotPasswordOtpRequestType = {
    requestId: string;
};

export type NewPasswordRequestType = {
    requestId: string;
    newPassword: string;
    confirmPassword: string;
};

export type MpinVerifyRequestType = {
    sessionId: string;
    mpin: string;
};

export type ForgotMpinRequestType = EmailOrClientId;

export type ForgotMpinOtpVerifyRequestType = {
    requestId: string;
    emailOtp: string;
};

export type ResendForgotMpinOtpRequestType = {
    requestId: string;
};

export type NewMpinRequestType = {
    requestId: string;
    newMpin: string;
};

// 2FA Types
export type Setup2FARequestType = {
    password: string;
};

export type Setup2FAResponseType = DefaultResponseData<{
    secret: string;
    qrCodeUrl: string;
    manualEntryKey: string;
}>;

export type Verify2FASetupRequestType = {
    secret: string;
    token: string;
};

export type Verify2FARequestType = {
    sessionId: string;
    token: string;
};

export type Disable2FARequestType = {
    password: string;
    token: string;
};
