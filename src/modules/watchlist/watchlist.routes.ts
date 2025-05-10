import { Router } from 'express';
import { validate } from '@app/middlewares';
import { getWatchlist, putWatchlist, removeWatchlist, updateWatchlist } from './watchlist.controller';
import { DeleteWatchlistQuery, GetWatchlistQuery, UpdateWatchlistData, WatchlistData } from './watchlist.validator';

const router = Router();

router.get('/', validate(GetWatchlistQuery, 'query'), getWatchlist);

router.put('/', validate(WatchlistData), putWatchlist);

router.post('/', validate(UpdateWatchlistData), updateWatchlist);

router.delete('/', validate(DeleteWatchlistQuery, 'query'), removeWatchlist);

export default router;
