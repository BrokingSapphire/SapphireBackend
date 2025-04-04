/**
 * src/routes/watchlistRoutes.ts
 * API routes for watchlist functionality
 */

import express from 'express';
import { WatchlistController } from './watchlist.controller';
import { db } from '@app/database';



const router = express.Router();
const watchlistController = new WatchlistController(db);

/**
 * @route   GET /api/watchlists
 * @desc    Get all user's watchlists
 * @access  Private
 */
router.get('/',watchlistController.getUserWatchlists);

/**
 * @route   GET /api/watchlists/:id
 * @desc    Get a specific watchlist by ID with all its items
 * @access  Private
 */
router.get('/:id',  watchlistController.getWatchlistById);

/**
 * @route   POST /api/watchlists
 * @desc    Create a new watchlist
 * @access  Private
 */
router.post('/',  watchlistController.createWatchlist);

/**
 * @route   POST /api/watchlists/:id/items
 * @desc    Add a stock symbol to a watchlist
 * @access  Private
 */
router.post('/:id/items',  watchlistController.addToWatchlist);

/**
 * @route   DELETE /api/watchlists/:watchlistId/items/:itemId
 * @desc    Remove a stock symbol from a watchlist
 * @access  Private
 */
router.delete('/:watchlistId/items/:itemId',  watchlistController.removeFromWatchlist);

/**
 * @route   DELETE /api/watchlists/:id
 * @desc    Delete a watchlist
 * @access  Private
 */
router.delete('/:id',  watchlistController.deleteWatchlist);

export default router;