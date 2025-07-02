import { ParamsDictionary } from 'express-serve-static-core';
import { Request, Response, DefaultResponseData } from '@app/types';
import { BAD_REQUEST, CREATED, NOT_FOUND, OK } from '@app/utils/httpstatus';
import { db } from '@app/database';
import { DB } from '@app/database/db.d';
import { SessionJwtType } from '@app/modules/common.types';
import {
    NamePayload,
    WatchlistCategoryCreate,
    WatchlistEntryCreate,
    WatchlistEntryUpdatePosition,
    MoveEntryPayload,
    DeleteCategoryOptions,
    GetEntriesQuery,
    UpdatePositionPayload,
    WatchlistItemPayload,
    WatchlistParam,
    WatchlistWithCategoryParam,
} from './watchlist.types';
import { ExpressionBuilder } from 'kysely';

// Watchlist Operations
const createWatchlist = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, NamePayload>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { name } = req.body;

    const result = await db.transaction().execute(async (tx) => {
        const wl = await tx
            .insertInto('watchlist')
            .values({
                name,
            })
            .onConflict((oc) =>
                oc.constraint('uq_watchlist').doUpdateSet((eb) => ({
                    name: eb.ref('excluded.name'),
                })),
            )
            .returning('id')
            .executeTakeFirstOrThrow();

        return await tx
            .insertInto('user_watchlist')
            .values((eb) => ({
                user_id: userId,
                watchlist_id: wl.id,
                position_index: eb
                    .selectFrom('user_watchlist')
                    .select(eb.fn.countAll<number>().as('all'))
                    .where('user_id', '=', userId),
            }))
            .onConflict((oc) => oc.constraint('uq_user_watchlist').doNothing())
            .returning(['id', 'position_index'])
            .executeTakeFirst();
    });

    if (result) {
        res.status(CREATED).json({
            message: 'Watchlist created successfully.',
            data: {
                id: result.id,
                name,
                positionIndex: result.position_index,
            },
        });
    } else {
        res.status(OK).json({
            message: 'Watchlist already exists.',
        });
    }
};

const getAllWatchlists = async (req: Request<SessionJwtType>, res: Response) => {
    const { userId } = req.auth!;
    const watchlists = await db
        .selectFrom('user_watchlist')
        .leftJoin('watchlist', 'watchlist.id', 'user_watchlist.watchlist_id')
        .select([
            'user_watchlist.id as watchlistId',
            'watchlist.name',
            'user_watchlist.position_index as positionIndex',
        ])
        .where('user_watchlist.user_id', '=', userId)
        .orderBy('user_watchlist.position_index', 'asc')
        .execute();

    res.status(OK).json({
        message: 'Watchlists fetched successfully.',
        data: watchlists,
    });
};

const updateWatchlistName = async (
    req: Request<SessionJwtType, WatchlistParam, DefaultResponseData, NamePayload>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId } = req.params;
    const { name } = req.body;

    const [update, alreadyFound] = await db.transaction().execute(async (tx) => {
        const { id } = await tx
            .insertInto('watchlist')
            .values({
                name,
            })
            .onConflict((oc) =>
                oc.constraint('uq_watchlist').doUpdateSet((eb) => ({
                    name: eb.ref('excluded.name'),
                })),
            )
            .returning('id')
            .executeTakeFirstOrThrow();

        const existingUserWatchlist = await tx
            .selectFrom('user_watchlist')
            .select('id')
            .where('user_id', '=', userId)
            .where('watchlist_id', '=', id)
            .executeTakeFirst();

        if (existingUserWatchlist) {
            return [false, true];
        }

        const updated = await tx
            .updateTable('user_watchlist')
            .set({
                watchlist_id: id,
            })
            .where('id', '=', watchlistId)
            .where('user_id', '=', userId)
            .returning('id')
            .executeTakeFirst();

        return [updated !== null, false];
    });

    if (alreadyFound) {
        res.status(BAD_REQUEST).json({
            message: 'Watchlist with this name already exists.',
        });
        return;
    }

    if (!update) {
        res.status(NOT_FOUND).json({ message: 'Watchlist not found.' });
        return;
    }

    res.status(OK).json({ message: 'Watchlist name updated successfully.' });
};

const updateWatchlistPosition = async (
    req: Request<SessionJwtType, WatchlistParam, DefaultResponseData, UpdatePositionPayload>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId } = req.params;
    const { newPosition } = req.body;

    await db.transaction().execute(async (tx) => {
        await tx
            .with('position', (qc) =>
                qc
                    .selectFrom('user_watchlist')
                    .select((eb) =>
                        eb.fn<number>('least', [eb.val(newPosition), eb(eb.fn.countAll<number>(), '-', 1)]).as('at'),
                    )
                    .where('user_id', '=', userId),
            )
            .with('index', (qc) =>
                qc
                    .selectFrom('user_watchlist')
                    .select('position_index')
                    .where('id', '=', watchlistId)
                    .where('user_id', '=', userId),
            )
            .with('updatedIndex', (qc) =>
                qc
                    .updateTable('user_watchlist')
                    .set((eb) => ({
                        position_index: eb
                            .selectFrom('user_watchlist')
                            .select(eb.fn.countAll<number>().as('count'))
                            .where('user_id', '=', userId),
                    }))
                    .where('id', '=', watchlistId)
                    .where('user_id', '=', userId)
                    .returning('position_index'),
            )
            .updateTable('user_watchlist')
            .set((eb) => ({
                position_index: eb
                    .case()
                    .when('id', '=', watchlistId)
                    .then(eb.selectFrom('position').select('at'))
                    .when(eb.selectFrom('index').select('position_index'), '<', eb.selectFrom('position').select('at'))
                    .then(eb('position_index', '-', 1))
                    .when(eb.selectFrom('index').select('position_index'), '>', eb.selectFrom('position').select('at'))
                    .then(eb('position_index', '+', 1))
                    .else(eb.ref('position_index'))
                    .end(),
            }))
            .where('user_id', '=', userId)
            .where((eb) =>
                eb.or([
                    eb.between(
                        'position_index',
                        eb.fn<number>('least', [
                            eb.selectFrom('position').select('at'),
                            eb.selectFrom('index').select('position_index'),
                        ]),
                        eb.fn<number>('greatest', [
                            eb.selectFrom('position').select('at'),
                            eb.selectFrom('index').select('position_index'),
                        ]),
                    ),
                    eb('id', '=', watchlistId),
                ]),
            )
            .executeTakeFirst();
    });

    res.status(OK).json({ message: 'Watchlist position updated successfully.' });
};

const deleteWatchlist = async (req: Request<SessionJwtType, WatchlistParam>, res: Response) => {
    const { userId } = req.auth!;
    const { watchlistId } = req.params;

    await db.transaction().execute(async (tx) => {
        await tx
            .deleteFrom('user_watchlist_entry')
            .using(['watchlist_category_map', 'user_watchlist'])
            .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .execute();

        const categories = (
            await tx
                .deleteFrom('watchlist_category_map')
                .using('user_watchlist')
                .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
                .where('user_watchlist.id', '=', watchlistId)
                .where('user_watchlist.user_id', '=', userId)
                .returning('category_id')
                .execute()
        ).filter((it) => it.category_id !== null) as { category_id: number }[];

        const watchlist = await tx
            .deleteFrom('user_watchlist')
            .where('id', '=', watchlistId)
            .where('user_id', '=', userId)
            .returning(['watchlist_id', 'position_index'])
            .executeTakeFirstOrThrow();

        await tx
            .updateTable('user_watchlist')
            .set((eb) => ({
                position_index: eb('user_watchlist.position_index', '-', 1),
            }))
            .where('user_watchlist.user_id', '=', userId)
            .where('user_watchlist.position_index', '>', watchlist.position_index)
            .execute();

        if (watchlist.watchlist_id) {
            await tx
                .deleteFrom('watchlist')
                .where('id', '=', watchlist.watchlist_id)
                .where((eb) =>
                    eb.not(
                        eb.exists(eb.selectFrom('user_watchlist').where('watchlist_id', '=', watchlist.watchlist_id)),
                    ),
                )
                .execute();
        }

        if (categories.length > 0) {
            await tx
                .deleteFrom('watchlist_category')
                .where(
                    'id',
                    'in',
                    categories.map((it) => it.category_id),
                )
                .where((eb) =>
                    eb.not(
                        eb.exists(
                            eb
                                .selectFrom('watchlist_category_map')
                                .whereRef('category_id', '=', 'watchlist_category.id'),
                        ),
                    ),
                )
                .execute();
        }
    });

    res.status(OK).json({ message: 'Watchlist deleted successfully.' });
};

// Category Operations
const createCategoryInWatchlist = async (
    req: Request<SessionJwtType, WatchlistParam, DefaultResponseData, NamePayload>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId } = req.params;
    const { name } = req.body;

    await db
        .selectFrom('user_watchlist')
        .select('id')
        .where('id', '=', watchlistId)
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow();

    const result = await db.transaction().execute(async (tx) => {
        const ct = await tx
            .insertInto('watchlist_category')
            .values({
                category: name,
            })
            .onConflict((oc) =>
                oc.constraint('uq_watchlist_category').doUpdateSet((eb) => ({
                    category: eb.ref('excluded.category'),
                })),
            )
            .returning('id')
            .executeTakeFirstOrThrow();

        return await tx
            .insertInto('watchlist_category_map')
            .values((eb) => ({
                user_watchlist_id: watchlistId,
                category_id: ct.id,
                position_index: eb
                    .selectFrom('watchlist_category_map')
                    .select(eb.fn.countAll<number>().as('all'))
                    .where('user_watchlist_id', '=', watchlistId),
            }))
            .onConflict((oc) => oc.constraint('uq_watchlist_category_map').doNothing())
            .returning(['id', 'position_index'])
            .executeTakeFirst();
    });

    if (result) {
        res.status(CREATED).json({
            message: 'Watchlist category created successfully.',
            data: {
                id: result.id,
                name,
                positionIndex: result.position_index,
            },
        });
    } else {
        res.status(OK).json({
            message: 'Watchlist category already exists.',
        });
    }
};

const getAllCategoriesOfWatchlist = async (req: Request<SessionJwtType, WatchlistParam>, res: Response) => {
    const { userId } = req.auth!;
    const { watchlistId } = req.params;

    const categoriesData = await db
        .selectFrom('user_watchlist')
        .innerJoin('watchlist_category_map', (join) =>
            join
                .onRef('watchlist_category_map.user_watchlist_id', '=', 'user_watchlist.id')
                .on('watchlist_category_map.category_id', 'is not', null),
        )
        .innerJoin('watchlist_category', 'watchlist_category.id', 'watchlist_category_map.category_id')
        .select([
            'watchlist_category_map.id as id',
            'watchlist_category.category as categoryName',
            'watchlist_category_map.position_index as positionIndex',
        ])
        .where('user_watchlist.id', '=', watchlistId)
        .where('user_watchlist.user_id', '=', userId)
        .orderBy('watchlist_category_map.position_index', 'asc')
        .execute();

    if (categoriesData.length === 0) {
        res.status(NOT_FOUND).json({ message: 'User watchlist not found.' });
        return;
    }

    res.status(OK).json({ message: 'Categories fetched successfully.', data: categoriesData });
};

const updateCategoryName = async (
    req: Request<SessionJwtType, WatchlistWithCategoryParam, DefaultResponseData, WatchlistCategoryCreate>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId, categoryId } = req.params;
    const { name } = req.body;

    const [update, alreadyFound] = await db.transaction().execute(async (tx) => {
        const { id } = await tx
            .insertInto('watchlist_category')
            .values({
                category: name,
            })
            .onConflict((oc) =>
                oc.constraint('uq_watchlist_category').doUpdateSet((eb) => ({
                    category: eb.ref('excluded.category'),
                })),
            )
            .returning('id')
            .executeTakeFirstOrThrow();

        const existingCategoryMap = await tx
            .selectFrom('watchlist_category_map')
            .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
            .select('watchlist_category_map.id')
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .where('watchlist_category_map.category_id', '=', id)
            .executeTakeFirst();

        if (existingCategoryMap) {
            return [false, true];
        }

        const updated = await tx
            .updateTable('watchlist_category_map')
            .from('user_watchlist')
            .set({
                category_id: id,
            })
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .where('watchlist_category_map.id', '=', categoryId)
            .returning('watchlist_category_map.id')
            .executeTakeFirst();

        return [updated !== null, false];
    });

    if (alreadyFound) {
        res.status(BAD_REQUEST).json({
            message: 'Category with this name already exists.',
        });
        return;
    }

    if (!update) {
        res.status(NOT_FOUND).json({ message: 'Category not found.' });
        return;
    }

    res.status(OK).json({ message: 'Category name updated successfully.' });
};

const updateCategoryPosition = async (
    req: Request<SessionJwtType, WatchlistWithCategoryParam, DefaultResponseData, UpdatePositionPayload>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId, categoryId } = req.params;
    const { newPosition } = req.body;

    await db.transaction().execute(async (tx) => {
        await tx
            .with('position', (qc) =>
                qc
                    .selectFrom('watchlist_category_map')
                    .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
                    .select((eb) =>
                        eb.fn<number>('least', [eb.val(newPosition), eb(eb.fn.countAll<number>(), '-', 1)]).as('at'),
                    )
                    .where('user_watchlist.id', '=', watchlistId)
                    .where('user_watchlist.user_id', '=', userId),
            )
            .with('index', (qc) =>
                qc
                    .selectFrom('watchlist_category_map')
                    .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
                    .select('watchlist_category_map.position_index')
                    .where('watchlist_category_map.id', '=', categoryId)
                    .where('user_watchlist.id', '=', watchlistId)
                    .where('user_watchlist.user_id', '=', userId),
            )
            .with('updatedIndex', (qc) =>
                qc
                    .updateTable('watchlist_category_map')
                    .from('user_watchlist')
                    .set((eb) => ({
                        position_index: eb
                            .selectFrom('watchlist_category_map')
                            .innerJoin(
                                'user_watchlist',
                                'user_watchlist.id',
                                'watchlist_category_map.user_watchlist_id',
                            )
                            .select(eb.fn.countAll<number>().as('count'))
                            .where('user_watchlist.id', '=', watchlistId)
                            .where('user_watchlist.user_id', '=', userId),
                    }))
                    .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
                    .where('watchlist_category_map.id', '=', categoryId)
                    .where('user_watchlist.id', '=', watchlistId)
                    .where('user_watchlist.user_id', '=', userId)
                    .returning('watchlist_category_map.position_index'),
            )
            .updateTable('watchlist_category_map')
            .from('user_watchlist')
            .set((eb) => ({
                position_index: eb
                    .case()
                    .when('watchlist_category_map.category_id', '=', categoryId)
                    .then(eb.selectFrom('position').select('at'))
                    .when(eb.selectFrom('index').select('position_index'), '<', eb.selectFrom('position').select('at'))
                    .then(eb('watchlist_category_map.position_index', '-', 1))
                    .when(eb.selectFrom('index').select('position_index'), '>', eb.selectFrom('position').select('at'))
                    .then(eb('watchlist_category_map.position_index', '+', 1))
                    .else(eb.ref('watchlist_category_map.position_index'))
                    .end(),
            }))
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .where((eb) =>
                eb.or([
                    eb.between(
                        'watchlist_category_map.position_index',
                        eb.fn<number>('least', [
                            eb.selectFrom('position').select('at'),
                            eb.selectFrom('index').select('position_index'),
                        ]),
                        eb.fn<number>('greatest', [
                            eb.selectFrom('position').select('at'),
                            eb.selectFrom('index').select('position_index'),
                        ]),
                    ),
                    eb('watchlist_category_map.category_id', '=', categoryId),
                ]),
            )
            .executeTakeFirst();
    });

    res.status(OK).json({ message: 'Category position updated successfully.' });
};

const deleteCategory = async (
    req: Request<SessionJwtType, WatchlistWithCategoryParam, DefaultResponseData, any, DeleteCategoryOptions>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId, categoryId } = req.params;
    const { moveElementsToUncategorized } = req.query;

    await db.transaction().execute(async (tx) => {
        if (moveElementsToUncategorized) {
            await tx
                .with('cte', (qc) =>
                    qc
                        .selectFrom('watchlist_category_map')
                        .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
                        .select('watchlist_category_map.id')
                        .where('user_watchlist.id', '=', watchlistId)
                        .where('user_watchlist.user_id', '=', userId)
                        .where('category_id', 'is', null),
                )
                .updateTable('user_watchlist_entry')
                .from(['watchlist_category_map', 'user_watchlist'])
                .set((eb) => ({
                    category_map_id: eb.selectFrom('cte').select('id'),
                }))
                .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
                .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
                .where('watchlist_category_map.id', '=', categoryId)
                .where('user_watchlist.id', '=', watchlistId)
                .where('user_watchlist.user_id', '=', userId)
                .execute();
        }

        await tx
            .deleteFrom('user_watchlist_entry')
            .using(['watchlist_category_map', 'user_watchlist'])
            .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('watchlist_category_map.id', '=', categoryId)
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .execute();

        const { category_id, position_index } = await tx
            .deleteFrom('watchlist_category_map')
            .using('user_watchlist')
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('watchlist_category_map.id', '=', categoryId)
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .returning(['watchlist_category_map.category_id', 'watchlist_category_map.position_index'])
            .executeTakeFirstOrThrow();

        await tx
            .updateTable('user_watchlist_entry')
            .from(['watchlist_category_map', 'user_watchlist'])
            .set((eb) => ({
                position_index: eb('user_watchlist_entry.position_index', '-', 1),
            }))
            .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .where('user_watchlist_entry.position_index', '>', position_index)
            .execute();

        if (category_id) {
            await tx
                .deleteFrom('watchlist_category')
                .where('id', '=', category_id)
                .where((eb) =>
                    eb.not(
                        eb.exists(
                            eb
                                .selectFrom('watchlist_category_map')
                                .whereRef('category_id', '=', 'watchlist_category.id'),
                        ),
                    ),
                )
                .execute();
        }
    });

    res.status(OK).json({ message: 'Category deleted successfully.' });
};

// Entry Operations
const addWatchlistEntries = async (
    req: Request<SessionJwtType, WatchlistWithCategoryParam, DefaultResponseData, WatchlistEntryCreate>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId, categoryId } = req.params;
    const { items } = req.body;

    await db
        .selectFrom('watchlist_category_map')
        .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
        .where('user_watchlist.user_id', '=', userId)
        .where('user_watchlist.id', '=', watchlistId)
        .where('watchlist_category_map.id', '=', categoryId)
        .executeTakeFirstOrThrow();

    await db.transaction().execute(async (tx) => {
        const { count } = await tx
            .selectFrom('user_watchlist_entry')
            .innerJoin('watchlist_category_map', 'user_watchlist_entry.category_map_id', 'watchlist_category_map.id')
            .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
            .select((eb) => eb.fn.countAll<number>().as('count'))
            .where('user_watchlist.user_id', '=', userId)
            .where('user_watchlist.id', '=', watchlistId)
            .where('watchlist_category_map.id', '=', categoryId)
            .executeTakeFirstOrThrow();

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
            const createIndexedCases = (
                eb: ExpressionBuilder<DB, 'user_watchlist' | 'watchlist_category_map' | 'user_watchlist_entry'>,
            ) => {
                let builder = eb
                    .case()
                    .when('user_watchlist_entry.position_index', '>=', indexed[offset - 1].index)
                    .then(eb('user_watchlist_entry.position_index', '+', offset));

                for (let i = indexed.length - 2; i >= 0; i--) {
                    const element = indexed[i];
                    builder = builder
                        .when('user_watchlist_entry.position_index', '>=', element.index)
                        .then(eb('user_watchlist_entry.position_index', '+', i + 1));
                }

                return builder.else(eb.ref('user_watchlist_entry.position_index')).end();
            };

            await tx
                .updateTable('user_watchlist_entry')
                .from(['watchlist_category_map', 'user_watchlist'])
                .set((eb) => ({
                    position_index: createIndexedCases(eb),
                }))
                .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
                .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
                .where('user_watchlist.user_id', '=', userId)
                .where('user_watchlist.id', '=', watchlistId)
                .where('watchlist_category_map.id', '=', categoryId)
                .where('user_watchlist_entry.position_index', '>=', indexed[0].index)
                .execute();
        }

        await tx
            .insertInto('user_watchlist_entry')
            .values([
                ...indexed.map((item) => ({
                    isin: item.isin,
                    category_map_id: categoryId,
                    exchange: item.exchange,
                    position_index: item.index,
                })),
                ...nonIndexed.map((item, index) => ({
                    isin: item.isin,
                    category_map_id: categoryId,
                    exchange: item.exchange,
                    position_index: count + offset + index + 1,
                })),
            ])
            .onConflict((oc) => oc.constraint('pk_user_watchlist_entry').doNothing())
            .execute();
    });

    res.status(CREATED).json({ message: 'Watchlist entries added successfully.' });
};

const getWatchlistEntries = async (
    req: Request<SessionJwtType, WatchlistWithCategoryParam, DefaultResponseData, any, GetEntriesQuery>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId, categoryId } = req.params;
    const { offset = 0, limit = 20 } = req.query;

    const entries = await db
        .selectFrom('user_watchlist_entry')
        .innerJoin('watchlist_category_map', 'user_watchlist_entry.category_map_id', 'watchlist_category_map.id')
        .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
        .select([
            'user_watchlist_entry.isin',
            'user_watchlist_entry.exchange',
            'user_watchlist_entry.position_index as positionIndex',
        ])
        .where('watchlist_category_map.id', '=', categoryId)
        .where('user_watchlist.id', '=', watchlistId)
        .where('user_watchlist.user_id', '=', userId)
        .orderBy('user_watchlist_entry.position_index', 'asc')
        .offset(offset)
        .limit(limit)
        .execute();

    res.status(OK).json({ message: 'Entries fetched successfully.', data: entries });
};

const updateEntryPosition = async (
    req: Request<SessionJwtType, WatchlistWithCategoryParam, DefaultResponseData, WatchlistEntryUpdatePosition>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId, categoryId } = req.params;
    const { isin, exchange, newPosition } = req.body;

    await db.transaction().execute(async (tx) => {
        await tx
            .with('position', (qc) =>
                qc
                    .selectFrom('user_watchlist_entry')
                    .innerJoin(
                        'watchlist_category_map',
                        'user_watchlist_entry.category_map_id',
                        'watchlist_category_map.id',
                    )
                    .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
                    .select((eb) =>
                        eb.fn<number>('least', [eb.val(newPosition), eb(eb.fn.countAll<number>(), '-', 1)]).as('at'),
                    )
                    .where('user_watchlist_entry.category_map_id', '=', categoryId)
                    .where('user_watchlist.id', '=', watchlistId)
                    .where('user_watchlist.user_id', '=', userId),
            )
            .with('index', (qc) =>
                qc
                    .selectFrom('user_watchlist_entry')
                    .innerJoin(
                        'watchlist_category_map',
                        'user_watchlist_entry.category_map_id',
                        'watchlist_category_map.id',
                    )
                    .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
                    .select('user_watchlist_entry.position_index')
                    .where('user_watchlist_entry.isin', '=', isin)
                    .where('user_watchlist_entry.exchange', '=', exchange)
                    .where('watchlist_category_map.id', '=', categoryId)
                    .where('user_watchlist.id', '=', watchlistId)
                    .where('user_watchlist.user_id', '=', userId),
            )
            .with('updatedIndex', (qc) =>
                qc
                    .updateTable('user_watchlist_entry')
                    .from(['watchlist_category_map', 'user_watchlist'])
                    .set((eb) => ({
                        position_index: eb
                            .selectFrom('user_watchlist_entry')
                            .innerJoin(
                                'watchlist_category_map',
                                'user_watchlist_entry.category_map_id',
                                'watchlist_category_map.id',
                            )
                            .innerJoin(
                                'user_watchlist',
                                'user_watchlist.id',
                                'watchlist_category_map.user_watchlist_id',
                            )
                            .select(eb.fn.countAll<number>().as('count'))
                            .where('watchlist_category_map.id', '=', categoryId)
                            .where('user_watchlist.id', '=', watchlistId)
                            .where('user_watchlist.user_id', '=', userId),
                    }))
                    .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
                    .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
                    .where('user_watchlist_entry.isin', '=', isin)
                    .where('user_watchlist_entry.exchange', '=', exchange)
                    .where('watchlist_category_map.id', '=', categoryId)
                    .where('user_watchlist.id', '=', watchlistId)
                    .where('user_watchlist.user_id', '=', userId)
                    .returning('user_watchlist_entry.position_index'),
            )
            .updateTable('user_watchlist_entry')
            .from(['watchlist_category_map', 'user_watchlist'])
            .set((eb) => ({
                position_index: eb
                    .case()
                    .when(
                        eb.and([
                            eb('user_watchlist_entry.isin', '=', isin),
                            eb('user_watchlist_entry.exchange', '=', exchange),
                        ]),
                    )
                    .then(eb.selectFrom('position').select('at'))
                    .when(eb.selectFrom('index').select('position_index'), '<', eb.selectFrom('position').select('at'))
                    .then(eb('user_watchlist_entry.position_index', '-', 1))
                    .when(eb.selectFrom('index').select('position_index'), '>', eb.selectFrom('position').select('at'))
                    .then(eb('user_watchlist_entry.position_index', '+', 1))
                    .else(eb.ref('user_watchlist_entry.position_index'))
                    .end(),
            }))
            .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('watchlist_category_map.id', '=', categoryId)
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .where((eb) =>
                eb.or([
                    eb.between(
                        'user_watchlist_entry.position_index',
                        eb.fn<number>('least', [
                            eb.selectFrom('position').select('at'),
                            eb.selectFrom('index').select('position_index'),
                        ]),
                        eb.fn<number>('greatest', [
                            eb.selectFrom('position').select('at'),
                            eb.selectFrom('index').select('position_index'),
                        ]),
                    ),
                    eb.and([
                        eb('user_watchlist_entry.isin', '=', isin),
                        eb('user_watchlist_entry.exchange', '=', exchange),
                    ]),
                ]),
            )
            .executeTakeFirst();
    });

    res.status(OK).json({ message: 'Entry position updated successfully.' });
};

const moveEntry = async (
    req: Request<SessionJwtType, WatchlistWithCategoryParam, DefaultResponseData, MoveEntryPayload>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId, categoryId } = req.params;
    const { isin, exchange, targetCategoryId, index: targetIndex } = req.body;

    await db.transaction().execute(async (tx) => {
        await tx
            .with('oldPosition', (qc) =>
                qc
                    .selectFrom('user_watchlist_entry')
                    .innerJoin(
                        'watchlist_category_map',
                        'user_watchlist_entry.category_map_id',
                        'watchlist_category_map.id',
                    )
                    .innerJoin('user_watchlist', 'user_watchlist.id', 'watchlist_category_map.user_watchlist_id')
                    .select('user_watchlist_entry.position_index as at')
                    .where('user_watchlist_entry.isin', '=', isin)
                    .where('user_watchlist_entry.exchange', '=', exchange)
                    .where('watchlist_category_map.id', '=', categoryId)
                    .where('user_watchlist.id', '=', watchlistId)
                    .where('user_watchlist.user_id', '=', userId),
            )
            .with('newPosition', (qc) =>
                qc
                    .selectFrom('oldPosition')
                    .select((eb) =>
                        eb.fn.coalesce(eb.val(targetIndex), eb.selectFrom('oldPosition').select('at')).as('at'),
                    ),
            )
            .updateTable('user_watchlist_entry')
            .from(['watchlist_category_map', 'user_watchlist'])
            .set((eb) => ({
                category_map_id: eb
                    .case()
                    .when(
                        eb.and([
                            eb('user_watchlist_entry.position_index', '=', eb.selectFrom('oldPosition').select('at')),
                            eb('watchlist_category_map.id', '=', categoryId),
                        ]),
                    )
                    .then(targetCategoryId)
                    .else(eb.ref('user_watchlist_entry.category_map_id'))
                    .end(),
                position_index: eb
                    .case()
                    .when('watchlist_category_map.id', '=', categoryId)
                    .then(
                        eb
                            .case()
                            .when('user_watchlist_entry.position_index', '>', eb.selectFrom('oldPosition').select('at'))
                            .then(eb('user_watchlist_entry.position_index', '-', 1))
                            .else(eb.selectFrom('newPosition').select('at'))
                            .end(),
                    )
                    .when('watchlist_category_map.id', '=', targetCategoryId)
                    .then(eb('user_watchlist_entry.position_index', '+', 1))
                    .else(eb.ref('user_watchlist_entry.position_index'))
                    .end(),
            }))
            .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .where((eb) =>
                eb.or([
                    eb.and([
                        eb('user_watchlist_entry.position_index', '>=', eb.selectFrom('oldPosition').select('at')),
                        eb('watchlist_category_map.id', '=', categoryId),
                    ]),
                    eb.and([
                        eb('user_watchlist_entry.position_index', '>', eb.selectFrom('newPosition').select('at')),
                        eb('watchlist_category_map.id', '=', targetCategoryId),
                    ]),
                ]),
            )
            .execute();
    });

    res.status(OK).json({ message: 'Entry moved successfully.' });
};

const removeEntry = async (
    req: Request<SessionJwtType, WatchlistWithCategoryParam, DefaultResponseData, any, WatchlistItemPayload>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { watchlistId, categoryId } = req.params;
    const { isin, exchange } = req.query;

    await db.transaction().execute(async (tx) => {
        const deleted = await tx
            .deleteFrom('user_watchlist_entry')
            .using(['watchlist_category_map', 'user_watchlist'])
            .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('user_watchlist_entry.isin', '=', isin)
            .where('user_watchlist_entry.exchange', '=', exchange)
            .where('watchlist_category_map.id', '=', categoryId)
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .returning('user_watchlist_entry.position_index')
            .executeTakeFirstOrThrow();

        await tx
            .updateTable('user_watchlist_entry')
            .from(['watchlist_category_map', 'user_watchlist'])
            .set((eb) => ({
                position_index: eb('user_watchlist_entry.position_index', '-', 1),
            }))
            .whereRef('user_watchlist_entry.category_map_id', '=', 'watchlist_category_map.id')
            .whereRef('user_watchlist.id', '=', 'watchlist_category_map.user_watchlist_id')
            .where('watchlist_category_map.id', '=', categoryId)
            .where('user_watchlist.id', '=', watchlistId)
            .where('user_watchlist.user_id', '=', userId)
            .where('user_watchlist_entry.position_index', '>', deleted.position_index)
            .execute();
    });

    res.status(OK).json({ message: 'Entry removed successfully.' });
};

export {
    // Watchlist operations
    createWatchlist,
    getAllWatchlists,
    updateWatchlistName,
    updateWatchlistPosition,
    deleteWatchlist,
    // Category operations
    createCategoryInWatchlist,
    getAllCategoriesOfWatchlist,
    updateCategoryName,
    updateCategoryPosition,
    deleteCategory,
    // Entry operations
    addWatchlistEntries,
    getWatchlistEntries,
    updateEntryPosition,
    moveEntry,
    removeEntry,
};
