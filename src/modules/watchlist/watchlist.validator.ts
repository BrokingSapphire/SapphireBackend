import Joi from 'joi';
import { Exchange } from '../common.types';

export const GetWatchlistQuery = Joi.object({
    limit: Joi.number().integer().min(1).optional(),
    offset: Joi.number().integer().min(0).optional(),
});

export const WatchlistData = Joi.object({
    items: Joi.array()
        .items(
            Joi.object({
                isin: Joi.string().length(12).required(),
                exchange: Joi.string()
                    .valid(...Object.values(Exchange))
                    .required(),
                index: Joi.number().integer().min(0).required(),
            }),
        )
        .required(),
});

export const DeleteWatchlistQuery = Joi.object({
    isin: Joi.string().length(12).required(),
    exchange: Joi.string()
        .valid(...Object.values(Exchange))
        .required(),
    updateOthers: Joi.boolean().optional(),
});
