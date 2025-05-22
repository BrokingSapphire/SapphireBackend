import { StockExchange } from '@app/database/db';

// General Params
export type WatchlistParam = {
    watchlistId: number;
};

export type WatchlistCategoryParam = {
    categoryId: number;
};

export type WatchlistWithCategoryParam = WatchlistParam & WatchlistCategoryParam;

// Watchlist Operations
export type NamePayload = {
    name: string;
};

export type UpdatePositionPayload = {
    newPosition: number;
};

// Category Operations
export type WatchlistCategoryCreate = {
    categoryName: string;
};

export type DeleteCategoryOptions = {
    moveElementsToUncategorized?: boolean;
};

// Entry Operations
export type WatchlistItem = {
    isin: string;
    exchange: StockExchange;
    index?: number;
};

export type WatchlistEntryCreate = {
    items: WatchlistItem[];
};

export type WatchlistItemPayload = {
    isin: string;
    exchange: StockExchange;
};

export type WatchlistEntryUpdatePosition = WatchlistItemPayload & UpdatePositionPayload;

export type MoveEntryPayload = WatchlistItemPayload & {
    targetCategoryId: number;
    index?: number;
};

export type GetEntriesQuery = {
    offset?: number;
    limit?: number;
};
