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
  categoryId?: number; // Optional category ID
}

export interface CreateCategoryRequest {
  name: string;
  order?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  order?: number;
}

export interface UpdateItemCategoryRequest {
  categoryId: number | null; // null means remove from any category
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
  categories_count?: number;
}

export interface WatchlistItemResponse {
  id: number;
  symbol: string;
  added_at: string;
  category_id: number | null;
}

export interface CategoryResponse {
  id: number;
  name: string;
  order: number;
  created_at: string;
  updated_at: string;
  items_count: number;
}

export interface WatchlistDetailResponse extends WatchlistResponse {
  categories: CategoryResponse[];
  categorized_items: {
    [categoryId: number]: WatchlistItemResponse[];
  };
  uncategorized_items: WatchlistItemResponse[];
}

// Service response types with possible errors
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}