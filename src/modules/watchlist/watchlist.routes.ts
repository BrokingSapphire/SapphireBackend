import { Router } from 'express';
import { validate } from '@app/middlewares';
import {
    createWatchlist,
    getAllWatchlists,
    updateWatchlistName,
    updateWatchlistPosition,
    deleteWatchlist,
    createCategoryInWatchlist,
    getAllCategoriesOfWatchlist,
    updateCategoryName,
    updateCategoryPosition,
    deleteCategory,
    addWatchlistEntries,
    getWatchlistEntries,
    updateEntryPosition,
    moveEntry,
    removeEntry,
} from './watchlist.controller';
import {
    WatchlistIdParamSchema,
    NamePayloadSchema,
    UpdatePositionPayloadSchema,
    WatchlistCategoryParamSchema,
    DeleteCategoryOptionsSchema,
    GetEntriesQuerySchema,
    WatchlistItemPayloadSchema,
    WatchlistEntryUpdatePositionSchema,
    MoveEntryPayloadSchema,
    WatchlistItemIdentifierSchema,
} from './watchlist.validator';

const router = Router();

// Watchlist operations
router.post('/', validate(NamePayloadSchema), createWatchlist);
router.get('/', getAllWatchlists);
router.put(
    '/:watchlistId/name',
    validate(WatchlistIdParamSchema, 'params'),
    validate(NamePayloadSchema),
    updateWatchlistName,
);
router.put(
    '/:watchlistId/position',
    validate(WatchlistIdParamSchema, 'params'),
    validate(UpdatePositionPayloadSchema),
    updateWatchlistPosition,
);
router.delete('/:watchlistId', validate(WatchlistIdParamSchema, 'params'), deleteWatchlist);

// Category operations
router.post(
    '/:watchlistId/categories',
    validate(WatchlistIdParamSchema, 'params'),
    validate(NamePayloadSchema),
    createCategoryInWatchlist,
);
router.get('/:watchlistId/categories', validate(WatchlistIdParamSchema, 'params'), getAllCategoriesOfWatchlist);
router.put(
    '/:watchlistId/categories/:categoryId/name',
    validate(WatchlistCategoryParamSchema, 'params'),
    validate(NamePayloadSchema),
    updateCategoryName,
);
router.put(
    '/:watchlistId/categories/:categoryId/position',
    validate(WatchlistCategoryParamSchema, 'params'),
    validate(UpdatePositionPayloadSchema),
    updateCategoryPosition,
);
router.delete(
    '/:watchlistId/categories/:categoryId',
    validate(WatchlistCategoryParamSchema, 'params'),
    validate(DeleteCategoryOptionsSchema, 'query'),
    deleteCategory,
);

// Entry operations
router.get(
    '/:watchlistId/entries/:categoryId',
    validate(WatchlistCategoryParamSchema, 'params'),
    validate(GetEntriesQuerySchema, 'query'),
    getWatchlistEntries,
);
router.post(
    '/:watchlistId/entries/:categoryId',
    validate(WatchlistCategoryParamSchema, 'params'),
    validate(WatchlistItemPayloadSchema),
    addWatchlistEntries,
);
router.put(
    '/:watchlistId/entries/:categoryId/position',
    validate(WatchlistCategoryParamSchema, 'params'),
    validate(WatchlistEntryUpdatePositionSchema),
    updateEntryPosition,
);
router.post(
    '/:watchlistId/entries/:categoryId/move',
    validate(WatchlistCategoryParamSchema, 'params'),
    validate(MoveEntryPayloadSchema),
    moveEntry,
);
router.delete(
    '/:watchlistId/entries/:categoryId',
    validate(WatchlistCategoryParamSchema, 'params'),
    validate(WatchlistItemIdentifierSchema, 'query'),
    removeEntry,
);

export default router;
