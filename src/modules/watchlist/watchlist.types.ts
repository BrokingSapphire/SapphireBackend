import { StockExchange } from '@app/database/db';

export type WatchlistCategoryParam = {
    categoryId: number;
};

export type WatchlistCategory = {
    category: string;
};

export type GetWatchlistQuery = {
    limit?: number;
    offset?: number;
};

export type WatchlistData = {
    items: {
        isin: string;
        exchange: StockExchange;
        index?: number;
    }[];
};

export type WatchlistIndexUpdate = {
    index: number;
    newIndex: number;
};

export type DeleteWatchlistQuery = {
    isin: string;
    exchange: StockExchange;
};
