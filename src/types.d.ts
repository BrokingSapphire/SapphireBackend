import * as express from 'express';
import * as core from 'express-serve-static-core';
import jwt from 'jsonwebtoken';

export type DefaultResponseData<Data = any> = {
    message: string;
    data?: Data;
};

export type Request<
    A = jwt.JwtPayload | undefined,
    P = core.ParamsDictionary,
    ResBody = DefaultResponseData,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>,
> = express.Request<P, ResBody, ReqBody, ReqQuery, Locals> & {
    auth?: A;
};

export type Response<
    ResBody = DefaultResponseData,
    Locals extends Record<string, any> = Record<string, any>,
> = express.Response<ResBody, Locals>;

export type JwtPayloadWithoutWildcard = Omit<jwt.JwtPayload, keyof any>;

export type NonNullableFields<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};

export type LoginResponseWithToken = DefaultResponseData & {
    token: string;
    isFirstLogin: boolean;
};

export type LoginRequestType = {
    clientId: string;
    password: string;
};

export type ResetPasswordRequestType = {
    currentPassword: string;
    newPassword: string;
};

export type ForgotPasswordInitiateRequestType = {
    panNumber: string;
    recaptchaToken: string;
}

export type ForgotPasswordInitiateResponseType = DefaultResponseData & {
    requestId: string;
};

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

export type LoginInitiateResponseType = DefaultResponseData & {
    requestId: string;
    isFirstLogin: boolean;
};

// Request type for OTP verification
export type LoginOtpVerifyRequestType = {
    requestId: string;
    otp: string;
};