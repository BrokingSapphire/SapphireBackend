/**
 * src/types/watchlist.ts
 * Type definitions for watchlist functionality
 */

// Request types
export interface CreateWatchlistRequest {
    name: string;
    description?: string;
  }

  export interface AddToWatchlistRequest {
    symbol: string;
  }

  // Response types
  export interface WatchlistResponse {
    id: number;
    name: string;
    description: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
    items_count?: number;
  }

  export interface WatchlistItemResponse {
    id: number;
    symbol: string;
    added_at: string;
  }

  export interface WatchlistDetailResponse extends WatchlistResponse {
    items: WatchlistItemResponse[];
  }

  // Service response types with possible errors
  export interface ServiceResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
  }