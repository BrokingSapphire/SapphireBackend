/**
 * src/services/watchlistDb.ts
 * Database operations for watchlist functionality
 */

import { Kysely } from 'kysely';
import { DB } from '../database/db';
import { ServiceResponse, WatchlistDetailResponse, WatchlistResponse, WatchlistItemResponse, CategoryResponse } from '../modules/watchlist/watchlist.types';
import logger from '@app/logger';

export class WatchlistDbService {
  constructor(private db: Kysely<DB>) {}

  /**
   * Initialize user_watchlist if not exists
   */
  private async ensureUserWatchlistExists(userId: number): Promise<number> {
    // Check if user already has a watchlist entry
    const existingUserWatchlist = await this.db
      .selectFrom('user_watchlist')
      .where('user_id', '=', userId)
      .select(['id'])
      .executeTakeFirst();

    if (existingUserWatchlist) {
      return existingUserWatchlist.id;
    }

    // Create new user_watchlist entry
    const newUserWatchlist = await this.db
      .insertInto('user_watchlist')
      .values({
        user_id: userId
      })
      .returning(['id'])
      .executeTakeFirst();

    if (!newUserWatchlist) {
      throw new Error('Failed to create user watchlist entry');
    }

    return newUserWatchlist.id;
  }

  /**
   * Get all watchlists for a user with count of items in each
   */
  async getUserWatchlists(userId: number): Promise<ServiceResponse<WatchlistResponse[]>> {
    try {
      // Get user_watchlist ID for this user
      const userWatchlistId = await this.ensureUserWatchlistExists(userId);

      // Get all watchlists for this user_watchlist
      const watchlists = await this.db
        .selectFrom('watchlist')
        .where('user_watchlist_id', '=', userWatchlistId)
        .select([
          'watchlist.id',
          'watchlist.name',
          'watchlist.description',
          'watchlist.is_default',
          'watchlist.created_at',
          'watchlist.updated_at',
        ])
        .execute();

      // Get count of items for each watchlist and format the response
      const watchlistsWithCount: WatchlistResponse[] = await Promise.all(
        watchlists.map(async (watchlist) => {
          const count = await this.db
            .selectFrom('watchlist_item')
            .where('watchlist_id', '=', watchlist.id)
            .select(({ fn }) => [fn.count('id').as('count')])
            .executeTakeFirst();

          return {
            id: watchlist.id,
            name: watchlist.name,
            description: watchlist.description,
            is_default: watchlist.is_default,
            created_at: watchlist.created_at instanceof Date
              ? watchlist.created_at.toISOString()
              : String(watchlist.created_at),
            updated_at: watchlist.updated_at instanceof Date
              ? watchlist.updated_at.toISOString()
              : String(watchlist.updated_at),
            items_count: Number(count?.count || 0),
          };
        })
      );

      return { success: true, data: watchlistsWithCount };
    } catch (error) {
      logger.error('Error getting user watchlists:', error);
      return { success: false, error: 'Failed to retrieve watchlists' };
    }
  }

  /**
   * Get a single watchlist with all its items
   */
  async getWatchlistById(
    watchlistId: number,
    userId: number
  ): Promise<ServiceResponse<WatchlistDetailResponse>> {
    try {
      // Get user_watchlist ID for this user
      const userWatchlistId = await this.ensureUserWatchlistExists(userId);

      // Get watchlist details if it belongs to this user
      const watchlist = await this.db
        .selectFrom('watchlist')
        .where('id', '=', watchlistId)
        .where('user_watchlist_id', '=', userWatchlistId)
        .select([
          'id',
          'name',
          'description',
          'is_default',
          'created_at',
          'updated_at',
        ])
        .executeTakeFirst();

      if (!watchlist) {
        return { success: false, error: 'Watchlist not found' };
      }

      // Get all items in the watchlist
      const items = await this.db
        .selectFrom('watchlist_item')
        .where('watchlist_id', '=', watchlistId)
        .select(['id', 'symbol', 'added_at'])
        .execute();

      // Format the items to match WatchlistItemResponse type
      const formattedItems: WatchlistItemResponse[] = items.map((item) => ({
        id: item.id,
        symbol: item.symbol,
        added_at: item.added_at instanceof Date
          ? item.added_at.toISOString()
          : String(item.added_at),
      }));

      // Format the response to match WatchlistDetailResponse type
      const response: WatchlistDetailResponse = {
        id: watchlist.id,
        name: watchlist.name,
        description: watchlist.description,
        is_default: watchlist.is_default,
        created_at: watchlist.created_at instanceof Date
          ? watchlist.created_at.toISOString()
          : String(watchlist.created_at),
        updated_at: watchlist.updated_at instanceof Date
          ? watchlist.updated_at.toISOString()
          : String(watchlist.updated_at),
        items: formattedItems,
      };

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      logger.error('Error getting watchlist details:', error);
      return { success: false, error: 'Failed to retrieve watchlist details' };
    }
  }

  /**
   * Create a new watchlist for a user
   */
  async createWatchlist(
    userId: number,
    name: string,
    description: string | null = null
  ): Promise<ServiceResponse<WatchlistResponse>> {
    try {
      // Get user_watchlist ID for this user
      const userWatchlistId = await this.ensureUserWatchlistExists(userId);

      // Check if default watchlist should be created
      const existingWatchlists = await this.db
        .selectFrom('watchlist')
        .where('user_watchlist_id', '=', userWatchlistId)
        .select(['id'])
        .execute();

      const isDefault = existingWatchlists.length === 0;

      const newWatchlist = await this.db
        .insertInto('watchlist')
        .values({
          user_watchlist_id: userWatchlistId,
          name,
          description,
          is_default: isDefault,
        })
        .returning([
          'id',
          'name',
          'description',
          'is_default',
          'created_at',
          'updated_at',
        ])
        .executeTakeFirst();

      if (!newWatchlist) {
        return { success: false, error: 'Failed to create watchlist' };
      }

      // Format the response to match WatchlistResponse type
      const response: WatchlistResponse = {
        id: newWatchlist.id,
        name: newWatchlist.name,
        description: newWatchlist.description,
        is_default: newWatchlist.is_default,
        created_at: newWatchlist.created_at instanceof Date
          ? newWatchlist.created_at.toISOString()
          : String(newWatchlist.created_at),
        updated_at: newWatchlist.updated_at instanceof Date
          ? newWatchlist.updated_at.toISOString()
          : String(newWatchlist.updated_at),
        items_count: 0,
      };

      return { success: true, data: response };
    } catch (error) {
      logger.error('Error creating watchlist:', error);
      return { success: false, error: 'Failed to create watchlist' };
    }
  }

  /**
   * Remove a stock symbol from a watchlist
   */
  async removeFromWatchlist(
    watchlistId: number,
    userId: number,
    itemId: number
  ): Promise<ServiceResponse<{ success: boolean }>> {
    try {
      // Get user_watchlist ID for this user
      const userWatchlistId = await this.ensureUserWatchlistExists(userId);

      // Check if watchlist exists and belongs to user
      const watchlist = await this.db
        .selectFrom('watchlist')
        .where('id', '=', watchlistId)
        .where('user_watchlist_id', '=', userWatchlistId)
        .select(['id'])
        .executeTakeFirst();

      if (!watchlist) {
        return { success: false, error: 'Watchlist not found or does not belong to user' };
      }

      // Remove the item
      const result = await this.db
        .deleteFrom('watchlist_item')
        .where('id', '=', itemId)
        .where('watchlist_id', '=', watchlistId)
        .executeTakeFirst();

      // Check if any rows were affected
      if (!result || result.numDeletedRows === BigInt(0)) {
        return { success: false, error: 'Item not found in watchlist' };
      }

      return { success: true, data: { success: true } };
    } catch (error) {
      logger.error('Error removing from watchlist:', error);
      return { success: false, error: 'Failed to remove symbol from watchlist' };
    }
  }

  /**
   * Delete a watchlist
   */
  async deleteWatchlist(
    watchlistId: number,
    userId: number
  ): Promise<ServiceResponse<{ success: boolean }>> {
    try {
      // Get user_watchlist ID for this user
      const userWatchlistId = await this.ensureUserWatchlistExists(userId);

      // Check if watchlist exists and belongs to user
      const watchlist = await this.db
        .selectFrom('watchlist')
        .where('id', '=', watchlistId)
        .where('user_watchlist_id', '=', userWatchlistId)
        .select(['id', 'is_default'])
        .executeTakeFirst();

      if (!watchlist) {
        return { success: false, error: 'Watchlist not found or does not belong to user' };
      }

      // Don't allow deletion of default watchlist
      if (watchlist.is_default) {
        return { success: false, error: 'Cannot delete default watchlist' };
      }

      // Delete all items in the watchlist first
      await this.db
        .deleteFrom('watchlist_item')
        .where('watchlist_id', '=', watchlistId)
        .execute();

      // Delete the watchlist
      const result = await this.db
        .deleteFrom('watchlist')
        .where('id', '=', watchlistId)
        .where('user_watchlist_id', '=', userWatchlistId)
        .executeTakeFirst();

      // Check if any rows were affected
      if (!result || result.numDeletedRows === BigInt(0)) {
        return { success: false, error: 'Failed to delete watchlist' };
      }

      return { success: true, data: { success: true } };
    } catch (error) {
      logger.error('Error deleting watchlist:', error);
      return { success: false, error: 'Failed to delete watchlist' };
    }
  };
  
  async updateWatchlist(
    watchlistId: number,
    userId: number,
    updateData: { name?: string; description?: string | null }
  ): Promise<ServiceResponse<WatchlistResponse>> {
    try {
      // Get user_watchlist ID for this user
      const userWatchlistId = await this.ensureUserWatchlistExists(userId);
  
      // Check if watchlist exists and belongs to user
      const watchlist = await this.db
        .selectFrom('watchlist')
        .where('id', '=', watchlistId)
        .where('user_watchlist_id', '=', userWatchlistId)
        .select(['id'])
        .executeTakeFirst();
  
      if (!watchlist) {
        return { success: false, error: 'Watchlist not found or does not belong to user' };
      }
  
      // Prepare update object with only the fields that were provided
      const updateObject: any = {
        updated_at: new Date()
      };
  
      if (updateData.name !== undefined) {
        updateObject.name = updateData.name;
      }
  
      if (updateData.description !== undefined) {
        updateObject.description = updateData.description;
      }
  
      // Update the watchlist
      await this.db
        .updateTable('watchlist')
        .set(updateObject)
        .where('id', '=', watchlistId)
        .execute();
  
      // Get the updated watchlist to return
      const updatedWatchlist = await this.db
        .selectFrom('watchlist')
        .where('id', '=', watchlistId)
        .select([
          'id',
          'name',
          'description',
          'is_default',
          'created_at',
          'updated_at',
        ])
        .executeTakeFirst();
  
      if (!updatedWatchlist) {
        return { success: false, error: 'Failed to retrieve updated watchlist' };
      }
  
      // Count the items in the watchlist
      const count = await this.db
        .selectFrom('watchlist_item')
        .where('watchlist_id', '=', watchlistId)
        .select(({ fn }) => [fn.count('id').as('count')])
        .executeTakeFirst();
  
      // Format the response to match WatchlistResponse type
      const response: WatchlistResponse = {
        id: updatedWatchlist.id,
        name: updatedWatchlist.name,
        description: updatedWatchlist.description,
        is_default: updatedWatchlist.is_default,
        created_at: updatedWatchlist.created_at instanceof Date
          ? updatedWatchlist.created_at.toISOString()
          : String(updatedWatchlist.created_at),
        updated_at: updatedWatchlist.updated_at instanceof Date
          ? updatedWatchlist.updated_at.toISOString()
          : String(updatedWatchlist.updated_at),
        items_count: Number(count?.count || 0),
      };
  
      return { success: true, data: response };
    } catch (error) {
      logger.error('Error updating watchlist:', error);
      return { success: false, error: 'Failed to update watchlist' };
    }
  };
/**
 * Get watchlist by ID with categories and categorized/uncategorized items
 */
async getWatchlistWithCategories(
  watchlistId: number,
  userId: number
): Promise<ServiceResponse<WatchlistDetailResponse>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Get watchlist details if it belongs to this user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select([
        'id',
        'name',
        'description',
        'is_default',
        'created_at',
        'updated_at',
      ])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found' };
    }

    // Get all categories for this watchlist
    const categories = await this.db
      .selectFrom('watchlist_category')
      .where('watchlist_id', '=', watchlistId)
      .select(['id', 'name', 'order', 'created_at', 'updated_at'])
      .orderBy('order', 'asc')
      .execute();

    // Format the categories and count items in each
    const formattedCategories: CategoryResponse[] = await Promise.all(
      categories.map(async (category) => {
        const count = await this.db
          .selectFrom('watchlist_item')
          .where('watchlist_id', '=', watchlistId)
          .where('category_id', '=', category.id)
          .select(({ fn }) => [fn.count('id').as('count')])
          .executeTakeFirst();

        return {
          id: category.id,
          name: category.name,
          order: category.order,
          created_at: category.created_at instanceof Date
            ? category.created_at.toISOString()
            : String(category.created_at),
          updated_at: category.updated_at instanceof Date
            ? category.updated_at.toISOString()
            : String(category.updated_at),
          items_count: Number(count?.count || 0),
        };
      })
    );

    // Get all items in the watchlist
    const items = await this.db
      .selectFrom('watchlist_item')
      .where('watchlist_id', '=', watchlistId)
      .select(['id', 'symbol', 'added_at', 'category_id'])
      .execute();

    // Format the items and organize by category
    const formattedItems: WatchlistItemResponse[] = items.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      added_at: item.added_at instanceof Date
        ? item.added_at.toISOString()
        : String(item.added_at),
      category_id: item.category_id,
    }));

    // Separate items into categorized and uncategorized
    const categorizedItems: { [categoryId: number]: WatchlistItemResponse[] } = {};
    const uncategorizedItems: WatchlistItemResponse[] = [];

    formattedItems.forEach(item => {
      if (item.category_id) {
        if (!categorizedItems[item.category_id]) {
          categorizedItems[item.category_id] = [];
        }
        categorizedItems[item.category_id].push(item);
      } else {
        uncategorizedItems.push(item);
      }
    });

    // Format the response
    const response: WatchlistDetailResponse = {
      id: watchlist.id,
      name: watchlist.name,
      description: watchlist.description,
      is_default: watchlist.is_default,
      created_at: watchlist.created_at instanceof Date
        ? watchlist.created_at.toISOString()
        : String(watchlist.created_at),
      updated_at: watchlist.updated_at instanceof Date
        ? watchlist.updated_at.toISOString()
        : String(watchlist.updated_at),
      categories: formattedCategories,
      categorized_items: categorizedItems,
      uncategorized_items: uncategorizedItems,
    };

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    logger.error('Error getting watchlist with categories:', error);
    return { success: false, error: 'Failed to retrieve watchlist details' };
  }
}

/**
 * Create a new category in a watchlist
 */
async createCategory(
  watchlistId: number,
  userId: number,
  name: string,
  order: number | null = null
): Promise<ServiceResponse<CategoryResponse>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Check if watchlist exists and belongs to user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found or does not belong to user' };
    }

    // If order is not provided, get the highest current order and add 1
    let categoryOrder = order;
    if (categoryOrder === null) {
      const highestOrder = await this.db
        .selectFrom('watchlist_category')
        .where('watchlist_id', '=', watchlistId)
        .select(({ fn }) => [fn.max('order').as('max_order')])
        .executeTakeFirst();

      categoryOrder = (highestOrder?.max_order || 0) + 1;
    }

    // Create the new category
    const newCategory = await this.db
      .insertInto('watchlist_category')
      .values({
        watchlist_id: watchlistId,
        name,
        order: categoryOrder,
      })
      .returning(['id', 'name', 'order', 'created_at', 'updated_at'])
      .executeTakeFirst();

    if (!newCategory) {
      return { success: false, error: 'Failed to create category' };
    }

    // Format the response
    const response: CategoryResponse = {
      id: newCategory.id,
      name: newCategory.name,
      order: newCategory.order,
      created_at: newCategory.created_at instanceof Date
        ? newCategory.created_at.toISOString()
        : String(newCategory.created_at),
      updated_at: newCategory.updated_at instanceof Date
        ? newCategory.updated_at.toISOString()
        : String(newCategory.updated_at),
      items_count: 0,
    };

    return { success: true, data: response };
  } catch (error) {
    logger.error('Error creating category:', error);
    return { success: false, error: 'Failed to create category' };
  }
}

/**
 * Update a category
 */
async updateCategory(
  categoryId: number,
  watchlistId: number,
  userId: number,
  updateData: { name?: string; order?: number }
): Promise<ServiceResponse<CategoryResponse>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Check if watchlist exists and belongs to user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found or does not belong to user' };
    }

    // Check if category exists and belongs to this watchlist
    const category = await this.db
      .selectFrom('watchlist_category')
      .where('id', '=', categoryId)
      .where('watchlist_id', '=', watchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!category) {
      return { success: false, error: 'Category not found or does not belong to this watchlist' };
    }

    // Prepare update object
    const updateObject: any = {
      updated_at: new Date()
    };

    if (updateData.name !== undefined) {
      updateObject.name = updateData.name;
    }

    if (updateData.order !== undefined) {
      updateObject.order = updateData.order;
    }

    // Update the category
    await this.db
      .updateTable('watchlist_category')
      .set(updateObject)
      .where('id', '=', categoryId)
      .execute();

    // Get the updated category
    const updatedCategory = await this.db
      .selectFrom('watchlist_category')
      .where('id', '=', categoryId)
      .select(['id', 'name', 'order', 'created_at', 'updated_at'])
      .executeTakeFirst();

    if (!updatedCategory) {
      return { success: false, error: 'Failed to retrieve updated category' };
    }

    // Count items in this category
    const count = await this.db
      .selectFrom('watchlist_item')
      .where('watchlist_id', '=', watchlistId)
      .where('category_id', '=', categoryId)
      .select(({ fn }) => [fn.count('id').as('count')])
      .executeTakeFirst();

    // Format the response
    const response: CategoryResponse = {
      id: updatedCategory.id,
      name: updatedCategory.name,
      order: updatedCategory.order,
      created_at: updatedCategory.created_at instanceof Date
        ? updatedCategory.created_at.toISOString()
        : String(updatedCategory.created_at),
      updated_at: updatedCategory.updated_at instanceof Date
        ? updatedCategory.updated_at.toISOString()
        : String(updatedCategory.updated_at),
      items_count: Number(count?.count || 0),
    };

    return { success: true, data: response };
  } catch (error) {
    logger.error('Error updating category:', error);
    return { success: false, error: 'Failed to update category' };
  }
}

/**
 * Delete a category
 */
async deleteCategory(
  categoryId: number,
  watchlistId: number,
  userId: number
): Promise<ServiceResponse<{ success: boolean }>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Check if watchlist exists and belongs to user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found or does not belong to user' };
    }

    // Check if category exists and belongs to this watchlist
    const category = await this.db
      .selectFrom('watchlist_category')
      .where('id', '=', categoryId)
      .where('watchlist_id', '=', watchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!category) {
      return { success: false, error: 'Category not found or does not belong to this watchlist' };
    }

    // Update items in this category to have null category_id
    await this.db
      .updateTable('watchlist_item')
      .set({ category_id: null })
      .where('category_id', '=', categoryId)
      .execute();

    // Delete the category
    const result = await this.db
      .deleteFrom('watchlist_category')
      .where('id', '=', categoryId)
      .executeTakeFirst();

    if (!result || result.numDeletedRows === BigInt(0)) {
      return { success: false, error: 'Failed to delete category' };
    }

    return { success: true, data: { success: true } };
  } catch (error) {
    logger.error('Error deleting category:', error);
    return { success: false, error: 'Failed to delete category' };
  }
}

/**
 * Update the category of a watchlist item
 */
async updateItemCategory(
  watchlistId: number,
  userId: number,
  itemId: number,
  categoryId: number | null
): Promise<ServiceResponse<WatchlistItemResponse>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Check if watchlist exists and belongs to user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found or does not belong to user' };
    }

    // Check if item exists and belongs to this watchlist
    const item = await this.db
      .selectFrom('watchlist_item')
      .where('id', '=', itemId)
      .where('watchlist_id', '=', watchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!item) {
      return { success: false, error: 'Item not found or does not belong to this watchlist' };
    }

    // If categoryId is provided, check if it exists and belongs to this watchlist
    if (categoryId !== null) {
      const category = await this.db
        .selectFrom('watchlist_category')
        .where('id', '=', categoryId)
        .where('watchlist_id', '=', watchlistId)
        .select(['id'])
        .executeTakeFirst();

      if (!category) {
        return { success: false, error: 'Category not found or does not belong to this watchlist' };
      }
    }

    // Update the item's category
    await this.db
      .updateTable('watchlist_item')
      .set({ category_id: categoryId })
      .where('id', '=', itemId)
      .execute();

    // Get the updated item
    const updatedItem = await this.db
      .selectFrom('watchlist_item')
      .where('id', '=', itemId)
      .select(['id', 'symbol', 'added_at', 'category_id'])
      .executeTakeFirst();

    if (!updatedItem) {
      return { success: false, error: 'Failed to retrieve updated item' };
    }

    // Format the response
    const response: WatchlistItemResponse = {
      id: updatedItem.id,
      symbol: updatedItem.symbol,
      added_at: updatedItem.added_at instanceof Date
        ? updatedItem.added_at.toISOString()
        : String(updatedItem.added_at),
      category_id: updatedItem.category_id,
    };

    return { success: true, data: response };
  } catch (error) {
    logger.error('Error updating item category:', error);
    return { success: false, error: 'Failed to update item category' };
    }
  }

  // Update the order 
  async updateItemOrder(
  watchlistId: number,
  userId: number,
  itemId: number,
  newOrder: number
  ):Promise<ServiceResponse<WatchlistItemResponse>>{
    try {
      // Get user_watchlist ID for this user
      const userWatchlistId = await this.ensureUserWatchlistExists(userId);
  
      // Check if watchlist exists and belongs to user
      const watchlist = await this.db
        .selectFrom('watchlist')
        .where('id', '=', watchlistId)
        .where('user_watchlist_id', '=', userWatchlistId)
        .select(['id'])
        .executeTakeFirst();
  
      if (!watchlist) {
        return { success: false, error: 'Watchlist not found or does not belong to user' };
      }
  
      // Check if item exists and belongs to this watchlist
      const item = await this.db
        .selectFrom('watchlist_item')
        .where('id', '=', itemId)
        .where('watchlist_id', '=', watchlistId)
        .select(['id', 'category_id', 'order'])
        .executeTakeFirst();
  
      if (!item) {
        return { success: false, error: 'Item not found or does not belong to this watchlist' };
      }
  
      // Update the item's order
      await this.db
        .updateTable('watchlist_item')
        .set({ 
          order: newOrder,
          updated_at: new Date() 
        })
        .where('id', '=', itemId)
        .execute();
  
      // Get the updated item
      const updatedItem = await this.db
        .selectFrom('watchlist_item')
        .where('id', '=', itemId)
        .select(['id', 'symbol', 'added_at', 'category_id', 'order'])
        .executeTakeFirst();
  
      if (!updatedItem) {
        return { success: false, error: 'Failed to retrieve updated item' };
      }
  
      // Format the response
      const response: WatchlistItemResponse = {
        id: updatedItem.id,
        symbol: updatedItem.symbol,
        added_at: updatedItem.added_at instanceof Date
          ? updatedItem.added_at.toISOString()
          : String(updatedItem.added_at),
        category_id: updatedItem.category_id,
        order: updatedItem.order ?? undefined
      };
  
      return { success: true, data: response };
    } catch (error) {
      logger.error('Error updating item order:', error);
      return { success: false, error: 'Failed to update item order' };
    }
  };
/**
 * Batch update orders of multiple watchlist items
 */
async batchUpdateItemsOrder(
  watchlistId: number,
  userId: number,
  items: { id: number; order: number }[]
): Promise<ServiceResponse<{ success: boolean }>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Check if watchlist exists and belongs to user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found or does not belong to user' };
    }

    // Get all valid item IDs in this watchlist
    const watchlistItems = await this.db
      .selectFrom('watchlist_item')
      .where('watchlist_id', '=', watchlistId)
      .select(['id'])
      .execute();
    
    const validItemIds = new Set(watchlistItems.map(item => item.id));
    
    // Check if all items in the request belong to this watchlist
    const invalidItems = items.filter(item => !validItemIds.has(item.id));
    if (invalidItems.length > 0) {
      return { 
        success: false, 
        error: `Items with IDs ${invalidItems.map(item => item.id).join(', ')} not found or do not belong to this watchlist` 
      };
    }

    // Use a transaction to update all items at once
    await this.db.transaction().execute(async (trx) => {
      const now = new Date();
      
      // Update each item's order
      const updatePromises = items.map(item => {
        return trx
          .updateTable('watchlist_item')
          .set({ 
            order: item.order,
            updated_at: now 
          })
          .where('id', '=', item.id)
          .where('watchlist_id', '=', watchlistId)
          .execute();
      });
      
      await Promise.all(updatePromises);
    });

    return { success: true, data: { success: true } };
  } catch (error) {
    logger.error('Error batch updating items order:', error);
    return { success: false, error: 'Failed to update items order' };
  }
}

/**
 * Batch update orders of multiple categories
 */
async batchUpdateCategoriesOrder(
  watchlistId: number,
  userId: number,
  categories: { id: number; order: number }[]
): Promise<ServiceResponse<{ success: boolean }>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Check if watchlist exists and belongs to user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found or does not belong to user' };
    }

    // Get all valid category IDs in this watchlist
    const watchlistCategories = await this.db
      .selectFrom('watchlist_category')
      .where('watchlist_id', '=', watchlistId)
      .select(['id'])
      .execute();
    
    const validCategoryIds = new Set(watchlistCategories.map(category => category.id));
    
    // Check if all categories in the request belong to this watchlist
    const invalidCategories = categories.filter(category => !validCategoryIds.has(category.id));
    if (invalidCategories.length > 0) {
      return { 
        success: false, 
        error: `Categories with IDs ${invalidCategories.map(category => category.id).join(', ')} not found or do not belong to this watchlist` 
      };
    }

    // Use a transaction to update all categories at once
    await this.db.transaction().execute(async (trx) => {
      const now = new Date();
      
      // Update each category's order
      const updatePromises = categories.map(category => {
        return trx
          .updateTable('watchlist_category')
          .set({ 
            order: category.order,
            updated_at: now 
          })
          .where('id', '=', category.id)
          .where('watchlist_id', '=', watchlistId)
          .execute();
      });
      
      await Promise.all(updatePromises);
    });

    return { success: true, data: { success: true } };
  } catch (error) {
    logger.error('Error batch updating categories order:', error);
    return { success: false, error: 'Failed to update categories order' };
  }
}

/**
 * Move an item to a different category and update its order
 */
async moveItem(
  watchlistId: number,
  userId: number,
  itemId: number,
  categoryId: number | null,
  newOrder: number
): Promise<ServiceResponse<WatchlistItemResponse>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Check if watchlist exists and belongs to user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found or does not belong to user' };
    }

    // Check if item exists and belongs to this watchlist
    const item = await this.db
      .selectFrom('watchlist_item')
      .where('id', '=', itemId)
      .where('watchlist_id', '=', watchlistId)
      .select(['id', 'category_id'])
      .executeTakeFirst();

    if (!item) {
      return { success: false, error: 'Item not found or does not belong to this watchlist' };
    }

    // If categoryId is provided, check if it exists and belongs to this watchlist
    if (categoryId !== null) {
      const category = await this.db
        .selectFrom('watchlist_category')
        .where('id', '=', categoryId)
        .where('watchlist_id', '=', watchlistId)
        .select(['id'])
        .executeTakeFirst();

      if (!category) {
        return { success: false, error: 'Category not found or does not belong to this watchlist' };
      }
    }

    await this.db.transaction().execute(async (trx) => {
      // Step 1: If moving to a different category, update the category assignment
      if (item.category_id !== categoryId) {
        await trx
          .updateTable('watchlist_item')
          .set({ 
            category_id: categoryId,
            updated_at: new Date()
          })
          .where('id', '=', itemId)
          .execute();
      }

      // Step 2: Update the order of the item
      await trx
        .updateTable('watchlist_item')
        .set({ 
          order: newOrder,
          updated_at: new Date()
        })
        .where('id', '=', itemId)
        .execute();

      // Step 3: Reorder other items in the source and destination categories if needed
      if (item.category_id !== categoryId) {
        // If the item was moved from one category to another, adjust items in both categories
        
        // Update orders in source category (compact the gap)
        if (item.category_id !== null) {
          const sourceItems = await trx
            .selectFrom('watchlist_item')
            .where('watchlist_id', '=', watchlistId)
            .where('category_id', '=', item.category_id)
            .where('id', '!=', itemId)
            .select(['id', 'order'])
            .orderBy('order', 'asc')
            .execute();
          
          // Compact the order gap by updating each item
          for (let i = 0; i < sourceItems.length; i++) {
            await trx
              .updateTable('watchlist_item')
              .set({ order: i + 1 }) // Reorder starting from 1
              .where('id', '=', sourceItems[i].id)
              .execute();
          }
        } else {
          // Update orders in uncategorized items
          const uncategorizedItems = await trx
            .selectFrom('watchlist_item')
            .where('watchlist_id', '=', watchlistId)
            .where('category_id', 'is', null)
            .where('id', '!=', itemId)
            .select(['id', 'order'])
            .orderBy('order', 'asc')
            .execute();
          
          for (let i = 0; i < uncategorizedItems.length; i++) {
            await trx
              .updateTable('watchlist_item')
              .set({ order: i + 1 })
              .where('id', '=', uncategorizedItems[i].id)
              .execute();
          }
        }
        
        // Update orders in destination category (make space for the inserted item)
        if (categoryId !== null) {
          const destItems = await trx
            .selectFrom('watchlist_item')
            .where('watchlist_id', '=', watchlistId)
            .where('category_id', '=', categoryId)
            .where('id', '!=', itemId)
            .where('order', '>=', newOrder)
            .select(['id', 'order'])
            .orderBy('order', 'asc')
            .execute();
          
          // Shift items to make space for the inserted item
          for (const destItem of destItems) {
            await trx
              .updateTable('watchlist_item')
              .set({ order: (destItem.order ?? 0) + 1 })
              .where('id', '=', destItem.id)
              .execute();
          }
        } else {
          // Update orders in uncategorized items
          const uncategorizedItems = await trx
            .selectFrom('watchlist_item')
            .where('watchlist_id', '=', watchlistId)
            .where('category_id', 'is', null)
            .where('id', '!=', itemId)
            .where('order', '>=', newOrder)
            .select(['id', 'order'])
            .orderBy('order', 'asc')
            .execute();
          
          for (const uncatItem of uncategorizedItems) {
            await trx
              .updateTable('watchlist_item')
              .set({ order: (uncatItem.order ?? 0) + 1 })
              .where('id', '=', uncatItem.id)
              .execute();
          }
        }
      } else {
        // If item stayed in the same category but changed order
        // Get items in the same category with orders that need adjustment
        const sameCategory = item.category_id !== null 
          ? await trx
              .selectFrom('watchlist_item')
              .where('watchlist_id', '=', watchlistId)
              .where('category_id', '=', item.category_id)
              .where('id', '!=', itemId)
              .select(['id', 'order'])
              .orderBy('order', 'asc')
              .execute()
          : await trx
              .selectFrom('watchlist_item')
              .where('watchlist_id', '=', watchlistId)
              .where('category_id', 'is', null)
              .where('id', '!=', itemId)
              .select(['id', 'order'])
              .orderBy('order', 'asc')
              .execute();
        
        // Find the old order of the moved item
        const oldOrder = await trx
          .selectFrom('watchlist_item')
          .where('id', '=', itemId)
          .select(['order'])
          .executeTakeFirst()
          .then(result => result?.order || 0);
        
        // Adjust orders based on whether the item moved up or down
        if (oldOrder < newOrder) {
          // Moving down: items between old and new position move up
          for (const sameCatItem of sameCategory) {
            if (sameCatItem.order !== null && sameCatItem.order > oldOrder && sameCatItem.order <= newOrder) {
              await trx
                .updateTable('watchlist_item')
                .set({ order: sameCatItem.order - 1 })
                .where('id', '=', sameCatItem.id)
                .execute();
            }
          }
        } else if (oldOrder > newOrder) {
          // Moving up: items between new and old position move down
          for (const sameCatItem of sameCategory) {
            if (sameCatItem.order !== null && sameCatItem.order >= newOrder && sameCatItem.order < oldOrder) {
              await trx
                .updateTable('watchlist_item')
                .set({ order: sameCatItem.order + 1 })
                .where('id', '=', sameCatItem.id)
                .execute();
            }
          }
        }
      }
    });

    // Get the updated item
    const updatedItem = await this.db
      .selectFrom('watchlist_item')
      .where('id', '=', itemId)
      .select(['id', 'symbol', 'added_at', 'category_id', 'order'])
      .executeTakeFirst();

    if (!updatedItem) {
      return { success: false, error: 'Failed to retrieve updated item' };
    }

    // Format the response
    const response: WatchlistItemResponse = {
      id: updatedItem.id,
      symbol: updatedItem.symbol,
      added_at: updatedItem.added_at instanceof Date
        ? updatedItem.added_at.toISOString()
        : String(updatedItem.added_at),
      category_id: updatedItem.category_id,
      order: updatedItem.order ?? undefined
    };

    return { success: true, data: response };
  } catch (error) {
    logger.error('Error moving item:', error);
    return { success: false, error: 'Failed to move item' };
  }
}

/**
 * Update the order field when adding a new item to watchlist 
 */
async addToWatchlist(
  watchlistId: number,
  userId: number,
  symbol: string,
  categoryId: number | null = null,
  order: number | null = null
): Promise<ServiceResponse<WatchlistItemResponse>> {
  try {
    // Get user_watchlist ID for this user
    const userWatchlistId = await this.ensureUserWatchlistExists(userId);

    // Check if watchlist exists and belongs to user
    const watchlist = await this.db
      .selectFrom('watchlist')
      .where('id', '=', watchlistId)
      .where('user_watchlist_id', '=', userWatchlistId)
      .select(['id'])
      .executeTakeFirst();

    if (!watchlist) {
      return { success: false, error: 'Watchlist not found or does not belong to user' };
    }

    // If categoryId is provided, check if it exists and belongs to this watchlist
    if (categoryId !== null) {
      const category = await this.db
        .selectFrom('watchlist_category')
        .where('id', '=', categoryId)
        .where('watchlist_id', '=', watchlistId)
        .select(['id'])
        .executeTakeFirst();

      if (!category) {
        return { success: false, error: 'Category not found or does not belong to this watchlist' };
      }
    }

    // Check if symbol already exists in this watchlist
    const existingItem = await this.db
      .selectFrom('watchlist_item')
      .where('watchlist_id', '=', watchlistId)
      .where('symbol', '=', symbol)
      .select(['id'])
      .executeTakeFirst();

    if (existingItem) {
      return { success: false, error: 'Symbol already exists in this watchlist' };
    }

    // If order is not provided, get the highest current order in the category and add 1
    let itemOrder = order;
    if (itemOrder === null) {
      const highestOrder = await this.db
        .selectFrom('watchlist_item')
        .where('watchlist_id', '=', watchlistId)
        .where(qb => 
          categoryId === null 
            ? qb.where('category_id', 'is', null) 
            : qb.where('category_id', '=', categoryId)
        )
        .select(({ fn }) => [fn.max('order').as('max_order')])
        .executeTakeFirst();

      itemOrder = (highestOrder?.max_order || 0) + 1;
    }

    // If specific order is provided, shift existing items to make space
    if (order !== null) {
      await this.db.transaction().execute(async (trx) => {
        // Get all items that need to be shifted
        const itemsToShift = await trx
          .selectFrom('watchlist_item')
          .where('watchlist_id', '=', watchlistId)
          .where(qb => 
            categoryId === null 
              ? qb.where('category_id', 'is', null) 
              : qb.where('category_id', '=', categoryId)
          )
          .where('order', '>=', order)
          .select(['id', 'order'])
          .orderBy('order', 'desc')
          .execute();

        // Shift each item's order up by 1
        for (const item of itemsToShift) {
          await trx
            .updateTable('watchlist_item')
            .set({ order: (item.order ?? 0) + 1 })
            .where('id', '=', item.id)
            .execute();
        }
      });
    }

    // Add the stock symbol to watchlist with category and order
    const newItem = await this.db
      .insertInto('watchlist_item')
      .values({
        watchlist_id: watchlistId,
        symbol,
        category_id: categoryId,
        order: itemOrder,
      })
      .returning(['id', 'symbol', 'added_at', 'category_id', 'order'])
      .executeTakeFirst();

    if (!newItem) {
      return { success: false, error: 'Failed to add symbol to watchlist' };
    }

    // Format the response
    const response: WatchlistItemResponse = {
      id: newItem.id,
      symbol: newItem.symbol,
      added_at: newItem.added_at instanceof Date
        ? newItem.added_at.toISOString()
        : String(newItem.added_at),
      category_id: newItem.category_id,
      order: newItem.order ?? undefined,
    };

    return { success: true, data: response };
  } catch (error) {
    logger.error('Error adding to watchlist:', error);
    return { success: false, error: 'Failed to add symbol to watchlist' };
    }
  }
}

export default WatchlistDbService;