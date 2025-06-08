import { BadRequestError } from '@app/apiError';
import { NextFunction } from 'express';
import { DefaultResponseData, Request, Response } from '@app/types.d';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import * as core from 'express-serve-static-core';

const validate = <
    A = jwt.JwtPayload | undefined,
    P = core.ParamsDictionary,
    ResBody = DefaultResponseData,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>,
>(
    schema: Joi.ObjectSchema,
    validationSelector: 'body' | 'params' | 'query' = 'body',
) => {
    return (
        req: Request<A, P, ResBody, ReqBody, ReqQuery, Locals>,
        _res: Response<ResBody, Locals>,
        next: NextFunction,
    ) => {
        const { value, error } = schema.validate(req[validationSelector], { abortEarly: false });
        if (error) throw new BadRequestError(error.message);
        req[validationSelector] = value;
        next();
    };
};

export default validate;
