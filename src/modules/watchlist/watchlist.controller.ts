/**
 * src/controllers/watchlistController.ts
 * Controller for watchlist functionality
 */

import { Request, Response } from 'express';
import WatchlistDbService from '../../services/watchlistDb.service';
import { Kysely } from 'kysely';
import { DB } from '../../database/db';
import { AddToWatchlistRequest, CreateWatchlistRequest } from './watchlist.types';
import logger from '@app/logger';


export class WatchlistController {
  private watchlistService: WatchlistDbService;

  constructor(db: Kysely<DB>) {
    this.watchlistService = new WatchlistDbService(db);
  }

  /**
   * Get all watchlists for a user
   */
  getUserWatchlists = async (req: Request, res: Response): Promise<void> => {
    try {
      // For now, hardcode a userId or get it from query params
      // Later this will come from authentication middleware
      const userId = parseInt(req.query.userId as string,10) || 1;

      const result = await this.watchlistService.getUserWatchlists(userId);

      if (result.success) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logger.error('Error in getUserWatchlists controller:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /**
   * Get a specific watchlist by ID with all its items
   */
  getWatchlistById = async (req: Request, res: Response): Promise<void> => {
    try {
      // For now, hardcode a userId or get it from query params
      const userId = parseInt(req.query.userId as string,10) || 1;
      const watchlistId = parseInt(req.params.id,10);

      if (isNaN(watchlistId)) {
        res.status(400).json({ success: false, error: 'Invalid watchlist ID' });
        return;
      }

      const result = await this.watchlistService.getWatchlistById(watchlistId, userId);

      if (result.success) {
        res.status(200).json({ success: true, data: result.data });
      } else {
        const status = result.error === 'Watchlist not found' ? 404 : 400;
        res.status(status).json({ success: false, error: result.error });
      }
    } catch (error) {
      logger.error('Error in getWatchlistById controller:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /**
   * Create a new watchlist
   */
  createWatchlist = async (req: Request, res: Response): Promise<void> => {
    try {
      // For now, hardcode a userId or get it from query params
      const userId = parseInt(req.query.userId as string,10) || 1;
      const { name, description } = req.body as CreateWatchlistRequest;

      if (!name) {
        res.status(400).json({ success: false, error: 'Watchlist name is required' });
        return;
      }

      const result = await this.watchlistService.createWatchlist(userId, name, description || null);

      if (result.success) {
        res.status(201).json({ success: true, data: result.data });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logger.error('Error in createWatchlist controller:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /**
   * Add a stock symbol to a watchlist
   */
  addToWatchlist = async (req: Request, res: Response): Promise<void> => {
    try {
      // For now, hardcode a userId or get it from query params
      const userId = parseInt(req.query.userId as string,10) || 1;
      const watchlistId = parseInt(req.params.id,10);
      const { symbol } = req.body as AddToWatchlistRequest;

      if (isNaN(watchlistId)) {
        res.status(400).json({ success: false, error: 'Invalid watchlist ID' });
        return;
      }

      if (!symbol) {
        res.status(400).json({ success: false, error: 'Stock symbol is required' });
        return;
      }

      const result = await this.watchlistService.addToWatchlist(watchlistId, userId, symbol);

      if (result.success) {
        res.status(201).json({ success: true, data: result.data });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logger.error('Error in addToWatchlist controller:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /**
   * Remove a stock symbol from a watchlist
   */
  removeFromWatchlist = async (req: Request, res: Response): Promise<void> => {
    try {
      // For now, hardcode a userId or get it from query params
      const userId = parseInt(req.query.userId as string,10) || 1;
      const watchlistId = parseInt(req.params.watchlistId,10);
      const itemId = parseInt(req.params.itemId,10);

      if (isNaN(watchlistId) || isNaN(itemId)) {
        res.status(400).json({ success: false, error: 'Invalid ID parameters' });
        return;
      }

      const result = await this.watchlistService.removeFromWatchlist(watchlistId, userId, itemId);

      if (result.success) {
        res.status(200).json({ success: true, message: 'Item removed from watchlist' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logger.error('Error in removeFromWatchlist controller:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  /**
   * Delete a watchlist
   */
  deleteWatchlist = async (req: Request, res: Response): Promise<void> => {
    try {
      // For now, hardcode a userId or get it from query params
      const userId = parseInt(req.query.userId as string,10) || 1;
      const watchlistId = parseInt(req.params.id,10);

      if (isNaN(watchlistId)) {
        res.status(400).json({ success: false, error: 'Invalid watchlist ID' });
        return;
      }

      const result = await this.watchlistService.deleteWatchlist(watchlistId, userId);

      if (result.success) {
        res.status(200).json({ success: true, message: 'Watchlist deleted successfully' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      logger.error('Error in deleteWatchlist controller:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export default WatchlistController;