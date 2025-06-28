import Joi from 'joi';
import { env } from '@app/env';

const DepositCallbackBody = Joi.object({
    merchId: Joi.string().equal(env.ntt.userId).required().messages({
        'any.only': 'Invalid merchant ID.',
    }),
    encData: Joi.string().required(),
});

const DepositCallbackQuery = Joi.object({
    redirect: Joi.string().uri().optional(),
});

export { DepositCallbackBody, DepositCallbackQuery };
