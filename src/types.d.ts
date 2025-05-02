import * as express from 'express';
import * as core from 'express-serve-static-core';
import jwt from 'jsonwebtoken';

export type Request<
    A = jwt.JwtPayload | undefined,
    P = core.ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>,
> = express.Request<P, ResBody, ReqBody, ReqQuery, Locals> & {
    auth?: A;
};

export type JwtPayloadWithoutWildcard = Omit<jwt.JwtPayload, keyof any>;

export type NonNullableFields<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};
