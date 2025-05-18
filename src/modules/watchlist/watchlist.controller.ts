import { ParamsDictionary } from 'express-serve-static-core';
import { DefaultResponseData, Request, Response } from '@app/types.d';
import { SessionJwtType } from '../common.types';
import {
    DeleteWatchlistQuery,
    GetWatchlistQuery,
    WatchlistCategory,
    WatchlistCategoryParam,
    WatchlistData,
    WatchlistIndexUpdate,
} from './watchlist.types';
import { db } from '@app/database';
import { NOT_FOUND, OK } from '@app/utils/httpstatus';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@app/database/db';

const createCategory = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, WatchlistCategory>,
    res: Response,
) => {
    const { id } = await db.transaction().execute(async (tx) => {
        return await tx
            .insertInto('user_watchlist_category')
            .values({
                user_id: req.auth!!.userId,
                category: req.body.category,
            })
            .returning('id')
            .executeTakeFirstOrThrow();
    });

    res.status(OK).json({
        message: 'Category created successfully.',
        data: {
            id,
        },
    });
};

const listCategories = async (req: Request<SessionJwtType>, res: Response) => {
    const result = await db
        .selectFrom('user_watchlist_category')
        .select(['id', 'category'])
        .where('user_id', '=', req.auth!!.userId)
        .execute();

    res.status(OK).json({
        message: 'Categories fetched successfully.',
        data: {
            result,
        },
    });
};

const getCategory = async (req: Request<SessionJwtType, WatchlistCategoryParam>, res: Response) => {
    const { category } = await db
        .selectFrom('user_watchlist_category')
        .select('category')
        .where('user_id', '=', req.auth!!.userId)
        .where('id', '=', req.params.categoryId)
        .executeTakeFirstOrThrow();

    res.status(OK).json({
        message: 'Category fetched successfully.',
        data: {
            name: category,
        },
    });
};

const removeCategory = async (req: Request<SessionJwtType, WatchlistCategoryParam>, res: Response) => {
    const result = await db.transaction().execute(async (tx) => {
        await tx
            .deleteFrom('user_stock_watchlist')
            .where('user_id', '=', req.auth!.userId)
            .where('category_id', '=', req.params.categoryId)
            .execute();

        return await tx
            .deleteFrom('user_watchlist_category')
            .where('user_id', '=', req.auth!.userId)
            .where('id', '=', req.params.categoryId)
            .execute();
    });

    if (result) {
        res.status(OK).json({
            message: 'Category deleted successfully.',
        });
    } else {
        res.status(NOT_FOUND).json({
            message: 'Category not found.',
        });
    }
};

const getWatchlist = async (
    req: Request<SessionJwtType, Partial<WatchlistCategoryParam>, DefaultResponseData, any, GetWatchlistQuery>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { offset = 0, limit = 20 } = req.query;

    const watchlist = await db
        .selectFrom('user_stock_watchlist')
        .select(['isin', 'exchange', 'position_index'])
        .where('user_id', '=', userId)
        .$if(req.params.categoryId === undefined, (qb) => qb.where('category_id', 'is', null))
        .$if(req.params.categoryId !== undefined, (qb) => qb.where('category_id', '=', req.params.categoryId!))
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
    req: Request<SessionJwtType, Partial<WatchlistCategoryParam>, DefaultResponseData, WatchlistData>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { categoryId } = req.params;
    const { items } = req.body;

    await db.transaction().execute(async (tx) => {
        const { count } = (await tx
            .selectFrom('user_stock_watchlist')
            .select('position_index as count')
            .where('user_id', '=', userId)
            .$if(categoryId === undefined, (qb) => qb.where('category_id', 'is', null))
            .$if(categoryId !== undefined, (qb) => qb.where('category_id', '=', req.params.categoryId!))
            .orderBy('position_index', 'desc')
            .limit(1)
            .executeTakeFirst()) || { count: -1 };

        const [indexed, nonIndexed] = items.reduce<[Required<(typeof items)[number]>[], typeof items]>(
            (acc, item) => {
                if (item.index !== undefined && item.index <= count) {
                    acc[0].push({ ...item, index: item.index });
                } else {
                    acc[1].push(item);
                }
                return acc;
            },
            [[], []],
        );

        const offset = indexed.length;

        if (indexed.length > 0) {
            indexed.sort((a, b) => a.index - b.index);
            const createIndexedCases = (eb: ExpressionBuilder<DB, 'user_stock_watchlist'>) => {
                let builder = eb
                    .case()
                    .when('position_index', '>=', indexed[offset - 1].index)
                    .then(eb('position_index', '+', offset));

                for (let i = indexed.length - 2; i >= 0; i--) {
                    const element = indexed[i];
                    builder = builder
                        .when('position_index', '>=', element.index)
                        .then(eb('position_index', '+', i + 1));
                }

                return builder.else(eb.ref('position_index')).end();
            };

            await tx
                .updateTable('user_stock_watchlist')
                .set((eb) => ({
                    position_index: createIndexedCases(eb),
                }))
                .where('user_id', '=', userId)
                .where('position_index', '>', indexed[0].index)
                .$if(categoryId === undefined, (qb) => qb.where('category_id', 'is', null))
                .$if(categoryId !== undefined, (qb) => qb.where('category_id', '=', categoryId!))
                .execute();
        }

        await tx
            .insertInto('user_stock_watchlist')
            .values([
                ...indexed.map((item) => ({
                    user_id: userId,
                    isin: item.isin,
                    category_id: categoryId,
                    exchange: item.exchange,
                    position_index: item.index,
                })),
                ...nonIndexed.map((item, index) => ({
                    user_id: userId,
                    isin: item.isin,
                    category_id: categoryId,
                    exchange: item.exchange,
                    position_index: count + offset + index + 1,
                })),
            ])
            .onConflict((oc) => oc.constraint('PK_User_Stock_Watchlist').doNothing())
            .execute();
    });

    res.status(OK).json({
        message: 'Watchlist updated successfully',
    });
};

const updateWatchlist = async (
    req: Request<SessionJwtType, Partial<WatchlistCategoryParam>, DefaultResponseData, WatchlistIndexUpdate>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { index, newIndex } = req.body;

    await db.transaction().execute(async (tx) => {
        await tx
            .with('cte', (qc) =>
                qc
                    .selectFrom('user_stock_watchlist')
                    .select((eb) =>
                        eb.fn<number>('least', [eb.val(newIndex), eb(eb.fn.countAll<number>(), '-', 1)]).as('at'),
                    )
                    .where('user_id', '=', userId),
            )
            .updateTable('user_stock_watchlist')
            .set((eb) => ({
                position_index: eb
                    .case()
                    .when('position_index', '=', index)
                    .then(eb.selectFrom('cte').select('at'))
                    .when(
                        eb.and([
                            eb('position_index', '>', index),
                            eb('position_index', '<=', eb.selectFrom('cte').select('at')),
                        ]),
                    )
                    .then(eb('position_index', '-', 1))
                    .else(eb.ref('position_index'))
                    .end(),
            }))
            .where('user_id', '=', userId)
            .where('position_index', '>=', index)
            .$if(req.params.categoryId === undefined, (qb) => qb.where('category_id', 'is', null))
            .$if(req.params.categoryId !== undefined, (qb) => qb.where('category_id', '=', req.params.categoryId!))
            .returning('position_index')
            .executeTakeFirst();
    });

    res.status(OK).json({
        message: 'Watchlist updated successfully',
    });
};

const removeWatchlist = async (
    req: Request<SessionJwtType, Partial<WatchlistCategoryParam>, DefaultResponseData, any, DeleteWatchlistQuery>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { isin, exchange } = req.query;
    const { categoryId } = req.params;

    await db.transaction().execute(async (tx) => {
        const position = await tx
            .deleteFrom('user_stock_watchlist')
            .where('user_id', '=', userId)
            .where('isin', '=', isin)
            .where('exchange', '=', exchange)
            .$if(categoryId === undefined, (qb) => qb.where('category_id', 'is', null))
            .$if(categoryId !== undefined, (qb) => qb.where('category_id', '=', categoryId!))
            .returning('position_index')
            .executeTakeFirst();

        if (position) {
            await tx
                .updateTable('user_stock_watchlist')
                .set((eb) => ({
                    position_index: eb('position_index', '-', 1),
                }))
                .where('user_id', '=', userId)
                .where('position_index', '>', position.position_index)
                .$if(categoryId === undefined, (qb) => qb.where('category_id', 'is', null))
                .$if(categoryId !== undefined, (qb) => qb.where('category_id', '=', categoryId!))
                .execute();
        }
    });

    res.status(OK).json({
        message: 'Watchlist removed successfully',
    });
};

export {
    createCategory,
    listCategories,
    getCategory,
    removeCategory,
    getWatchlist,
    putWatchlist,
    updateWatchlist,
    removeWatchlist,
};
