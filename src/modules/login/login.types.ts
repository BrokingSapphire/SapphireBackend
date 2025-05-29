import { DefaultResponseData, Pretty } from '@app/types';

export type LoginResponseWithToken = DefaultResponseData<{
    isFirstLogin: boolean;
}> & {
    token: string;
};

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
