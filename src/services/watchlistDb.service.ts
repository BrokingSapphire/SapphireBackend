/**
 * src/services/watchlistDb.ts
 * Database operations for watchlist functionality
 */

import { Kysely } from 'kysely';
import { DB } from '../database/db';
import { ServiceResponse, WatchlistDetailResponse, WatchlistResponse, WatchlistItemResponse } from '../modules/watchlist/watchlist.types';
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
            // Convert Date objects to ISO strings
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
   * Add a stock symbol to a watchlist
   */
  async addToWatchlist(
    watchlistId: number,
    userId: number,
    symbol: string
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

      // Add the stock symbol to watchlist
      const newItem = await this.db
        .insertInto('watchlist_item')
        .values({
          watchlist_id: watchlistId,
          symbol,
        })
        .returning(['id', 'symbol', 'added_at'])
        .executeTakeFirst();

      if (!newItem) {
        return { success: false, error: 'Failed to add symbol to watchlist' };
      }

      // Format the response to match WatchlistItemResponse type
      const response: WatchlistItemResponse = {
        id: newItem.id,
        symbol: newItem.symbol,
        added_at: newItem.added_at instanceof Date
          ? newItem.added_at.toISOString()
          : String(newItem.added_at),
      };

      return { success: true, data: response };
    } catch (error) {
      logger.error('Error adding to watchlist:', error);
      return { success: false, error: 'Failed to add symbol to watchlist' };
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
  }
}

export default WatchlistDbService;