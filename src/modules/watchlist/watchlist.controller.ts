import { ParamsDictionary } from 'express-serve-static-core';
import { DefaultResponseData, Request, Response } from '@app/types.d';
import { SessionJwtType } from '../common.types';
import { DeleteWatchlistQuery, GetWatchlistQuery, WatchlistData } from './watchlist.types';
import { db } from '@app/database';
import { OK } from '@app/utils/httpstatus';

const getWatchlist = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, any, GetWatchlistQuery>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { offset = 0, limit = 20 } = req.query;

    const watchlist = await db
        .selectFrom('user_stock_watchlist')
        .select(['isin', 'exchange', 'position_index'])
        .where('user_id', '=', userId)
        .orderBy('position_index')
        .offset(offset)
        .limit(limit)
        .execute();

    res.status(OK).json({
        message: 'Watchlist retrieved successfully',
        data: watchlist,
    });
};

const putWatchlist = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, WatchlistData>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { items } = req.body;

    db.transaction().execute(async (tx) => {
        await tx
            .insertInto('user_stock_watchlist')
            .values(
                items.map((item) => ({
                    user_id: userId,
                    isin: item.isin,
                    exchange: item.exchange,
                    position_index: item.index,
                })),
            )
            .onConflict((oc) =>
                oc.constraint('PK_User_Stock_Watchlist').doUpdateSet((eb) => ({
                    position_index: eb.ref('excluded.position_index'),
                })),
            )
            .execute();
    });

    res.status(OK).json({
        message: 'Watchlist updated successfully',
    });
};

const removeWatchlist = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, any, DeleteWatchlistQuery>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { isin, exchange, updateOthers = 'false' } = req.query;

    db.transaction().execute(async (tx) => {
        const position = await tx
            .deleteFrom('user_stock_watchlist')
            .where('user_id', '=', userId)
            .where('isin', '=', isin)
            .where('exchange', '=', exchange)
            .returning('position_index')
            .executeTakeFirst();

        if (Boolean(updateOthers) && position) {
            await tx
                .updateTable('user_stock_watchlist')
                .set((eb) => ({
                    position_index: eb('position_index', '-', 1),
                }))
                .where('user_id', '=', userId)
                .where('position_index', '>', position.position_index)
                .execute();
        }
    });

    res.status(OK).json({
        message: 'Watchlist removed successfully',
    });
};

export { getWatchlist, putWatchlist, removeWatchlist };
