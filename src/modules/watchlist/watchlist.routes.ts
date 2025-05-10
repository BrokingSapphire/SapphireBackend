import { Router } from 'express';
import { validate } from '@app/middlewares';
import { getWatchlist, putWatchlist, removeWatchlist } from './watchlist.controller';
import { DeleteWatchlistQuery, GetWatchlistQuery, WatchlistData } from './watchlist.validator';

const router = Router();

router.get('/', validate(GetWatchlistQuery, 'query'), getWatchlist);

router.put('/', validate(WatchlistData), putWatchlist);

router.delete('/', validate(DeleteWatchlistQuery, 'query'), removeWatchlist);

export default router;
