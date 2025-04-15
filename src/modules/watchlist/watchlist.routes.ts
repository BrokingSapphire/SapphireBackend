// /**
//  * src/routes/watchlistRoutes.ts
//  * API routes for watchlist functionality
//  */

// import express from 'express';
// import { WatchlistController } from './watchlist.controller';
// import { db } from '@app/database';



// const router = express.Router();
// const watchlistController = new WatchlistController(db);

// /**
//  * @route   GET /api/watchlists
//  * @desc    Get all user's watchlists
//  * @access  Private
//  */
// router.get('/',watchlistController.getUserWatchlists);

// /**
//  * @route   GET /api/watchlists/:id
//  * @desc    Get a specific watchlist by ID with all its items
//  * @access  Private
//  */
// router.get('/:id',  watchlistController.getWatchlistById);

// /**
//  * @route   POST /api/watchlists
//  * @desc    Create a new watchlist
//  * @access  Private
//  */
// router.post('/',  watchlistController.createWatchlist);

// /**
//  * @route   POST /api/watchlists/:id/items
//  * @desc    Add a stock symbol to a watchlist
//  * @access  Private
//  */
// router.post('/:id/items',  watchlistController.addToWatchlist);

// /**
//  * @route   DELETE /api/watchlists/:watchlistId/items/:itemId
//  * @desc    Remove a stock symbol from a watchlist
//  * @access  Private
//  */
// router.delete('/:watchlistId/items/:itemId',  watchlistController.removeFromWatchlist);

// /**
//  * @route   DELETE /api/watchlists/:id
//  * @desc    Delete a watchlist
//  * @access  Private
//  */
// router.delete('/:id',  watchlistController.deleteWatchlist);

// /**
//  * @route  UPDATE /api/watchlists/:id
//  * @desc   Update a watchlist name
//  * @access Private
//  */
// router.put('/:id', watchlistController.updateWatchlist);

// export default router;
/**
 * src/routes/watchlistRoutes.ts
 * API routes for watchlist functionality
 */

import express from 'express';
import * as watchlistController from './watchlist.controller';

const router = express.Router();

/**
 * @route   GET /api/watchlists
 * @desc    Get all user's watchlists
 * @access  Private
 */
router.get('/', watchlistController.getUserWatchlists);

/**
 * @route   GET /api/watchlists/:id
 * @desc    Get a specific watchlist by ID with all its items
 * @access  Private
 */
router.get('/:id', watchlistController.getWatchlistById);

/**
 * @route   GET /api/watchlists/:id/categories
 * @desc    Get a watchlist with categories and categorized items
 * @access  Private
 */
router.get('/:id/categories', watchlistController.getWatchlistWithCategories);

/**
 * @route   POST /api/watchlists
 * @desc    Create a new watchlist
 * @access  Private
 */
router.post('/', watchlistController.createWatchlist);

/**
 * @route   POST /api/watchlists/:id/items
 * @desc    Add a stock symbol to a watchlist
 * @access  Private
 */
router.post('/:id/items', watchlistController.addToWatchlist);

/**
 * @route   POST /api/watchlists/:watchlistId/categories
 * @desc    Create a new category in a watchlist
 * @access  Private
 */
router.post('/:watchlistId/categories', watchlistController.createCategory);

/**
 * @route   PUT /api/watchlists/:id
 * @desc    Update a watchlist name and/or description
 * @access  Private
 */
router.put('/:id', watchlistController.updateWatchlist);

/**
 * @route   PUT /api/watchlists/:watchlistId/categories/:categoryId
 * @desc    Update a category name and/or order
 * @access  Private
 */
router.put('/:watchlistId/categories/:categoryId', watchlistController.updateCategory);

/**
 * @route   PUT /api/watchlists/:watchlistId/items/:itemId/category
 * @desc    Update an item's category
 * @access  Private
 */
router.put('/:watchlistId/items/:itemId/category', watchlistController.updateItemCategory);

/**
 * @route   PUT /api/watchlists/:watchlistId/items/:itemId/order
 * @desc    Update a single watchlist item's order
 * @access  Private
 */
router.put('/:watchlistId/items/:itemId/order', watchlistController.updateItemOrder);

/**
 * @route   PUT /api/watchlists/:watchlistId/items/:itemId/move
 * @desc    Move an item to a different category and update its order
 * @access  Private
 */
router.put('/:watchlistId/items/:itemId/move', watchlistController.moveItem);

/**
 * @route   PUT /api/watchlists/:watchlistId/items/batch-order
 * @desc    Batch update multiple watchlist items' orders
 * @access  Private
 */
router.put('/:watchlistId/items/batch-order', watchlistController.batchUpdateItemsOrder);

/**
 * @route   PUT /api/watchlists/:watchlistId/categories/batch-order
 * @desc    Batch update category orders
 * @access  Private
 */
router.put('/:watchlistId/categories/batch-order', watchlistController.batchUpdateCategoriesOrder);

/**
 * @route   DELETE /api/watchlists/:watchlistId/items/:itemId
 * @desc    Remove a stock symbol from a watchlist
 * @access  Private
 */
router.delete('/:watchlistId/items/:itemId', watchlistController.removeFromWatchlist);

/**
 * @route   DELETE /api/watchlists/:id
 * @desc    Delete a watchlist
 * @access  Private
 */
router.delete('/:id', watchlistController.deleteWatchlist);

/**
 * @route   DELETE /api/watchlists/:watchlistId/categories/:categoryId
 * @desc    Delete a category
 * @access  Private
 */
router.delete('/:watchlistId/categories/:categoryId', watchlistController.deleteCategory);

export default router;