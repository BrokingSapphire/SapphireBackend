import Joi from 'joi';
import { Exchange } from '../common.types';

// --- PARAM SCHEMAS ---
export const WatchlistIdParamSchema = Joi.object({
    watchlistId: Joi.number().required(),
});

export const WatchlistCategoryParamSchema = Joi.object({
    watchlistId: Joi.number().required(),
    categoryId: Joi.number().required(),
});

// --- PAYLOAD SCHEMAS (BODY) ---
export const NamePayloadSchema = Joi.object({
    name: Joi.string().max(20).required(),
});

export const UpdatePositionPayloadSchema = Joi.object({
    newPosition: Joi.number().integer().min(0).required(),
});

export const WatchlistItemPayloadSchema = Joi.object({
    items: Joi.array()
        .items(
            Joi.object({
                isin: Joi.string().length(12).required(),
                exchange: Joi.string()
                    .valid(...Object.keys(Exchange))
                    .required(),
                index: Joi.number().integer().min(0).optional(),
            }),
        )
        .min(1)
        .required(),
});

export const WatchlistItemIdentifierSchema = Joi.object({
    isin: Joi.string().length(12).required(),
    exchange: Joi.string()
        .valid(...Object.keys(Exchange))
        .required(),
});

export const WatchlistEntryUpdatePositionSchema = WatchlistItemIdentifierSchema.keys({
    newPosition: Joi.number().integer().min(0).required(),
});

export const MoveEntryPayloadSchema = WatchlistItemIdentifierSchema.keys({
    targetCategoryId: Joi.number().required(),
    index: Joi.number().integer().min(0).optional(),
});

// --- QUERY SCHEMAS ---
export const GetEntriesQuerySchema = Joi.object({
    offset: Joi.number().integer().min(0).optional(),
    limit: Joi.number().integer().min(1).optional(),
});

export const DeleteCategoryOptionsSchema = Joi.object({
    moveElementsToUncategorized: Joi.boolean().optional(),
});
