import { BadRequestError } from '@app/apiError';
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';

const validate = (schema: Joi.ObjectSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const { value, error } = await schema.validateAsync(req.body);
        if (error) throw new BadRequestError(error.message);
        req.body = value;
        next();
    };
};

export default validate;
