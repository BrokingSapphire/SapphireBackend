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

export type Pretty<T> = {
    [K in keyof T]: T[K];
} & {};

export type ToDiscoUnion<T, N extends string = 'type'> = {
    [K in keyof T]: Pretty<
        {
            [P in N]: K;
        } & T[K]
    >;
}[keyof T];
