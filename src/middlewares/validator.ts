import { BadRequestError } from '@app/apiError';
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';

const validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const { value, error } = schema.validate(req.body);
        if (error) throw new BadRequestError(error.message);
        req.body = value;
        next();
    };
};

export default validate;
