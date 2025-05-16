import { Router } from 'express';
import { validate } from '@app/middlewares';
import {
    createCategory,
    getCategory,
    getWatchlist,
    listCategories,
    putWatchlist,
    removeCategory,
    removeWatchlist,
    updateWatchlist,
} from './watchlist.controller';
import {
    DeleteWatchlistQuery,
    GetWatchlistQuery,
    UpdateWatchlistData,
    WatchlistCategoryIdParam,
    WatchlistCategoryIdParamRequired,
    WatchlistCategoryName,
    WatchlistData,
} from './watchlist.validator';

const router = Router();

router.post('/category/create', validate(WatchlistCategoryName), createCategory);

router.get('/category/list', listCategories);

router.get('/category/:categoryId', validate(WatchlistCategoryIdParamRequired, 'params'), getCategory);

router.delete('/category/:categoryId', validate(WatchlistCategoryIdParamRequired, 'params'), removeCategory);

router.get(
    '/:categoryId?',
    validate(WatchlistCategoryIdParam, 'params'),
    validate(GetWatchlistQuery, 'query'),
    getWatchlist,
);

router.put('/:categoryId?', validate(WatchlistCategoryIdParam, 'params'), validate(WatchlistData), putWatchlist);

router.post(
    '/:categoryId?',
    validate(WatchlistCategoryIdParam, 'params'),
    validate(UpdateWatchlistData),
    updateWatchlist,
);

router.delete(
    '/:categoryId?',
    validate(WatchlistCategoryIdParam, 'params'),
    validate(DeleteWatchlistQuery, 'query'),
    removeWatchlist,
);

export default router;
