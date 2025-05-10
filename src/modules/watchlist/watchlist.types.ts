import { StockExchange } from '@app/database/db';

export type GetWatchlistQuery = {
    limit?: number;
    offset?: number;
};

export type WatchlistData = {
    items: {
        isin: string;
        exchange: StockExchange;
        index: number;
    }[];
};

export type DeleteWatchlistQuery = {
    isin: string;
    exchange: StockExchange;
    updateOthers?: string;
};
