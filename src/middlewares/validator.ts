import { BadRequestError } from '@app/apiError';
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';

const validate = (schema: Joi.ObjectSchema, validationSelector: 'body' | 'params' | 'query' = 'body') => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const { value, error } = schema.validate(req[validationSelector], { abortEarly: false });
        if (error) throw new BadRequestError(error.message);
        req[validationSelector] = value;
        next();
    };
};

export default validate;
