// // routes.ts
// import express from 'express';
// import { tradingController } from './rms.controller';
// import { TradingValidator } from './rms.validator';

// const router = express.Router();

// // Basic test route
// router.get('/trading/test', (req, res) => {
//   res.json({ success: true, message: 'Trading routes are working' });
// });

// // Core trading routes
// router.get('/trading/rules', tradingController.getTradingRules);
// router.get(
//   '/trading/rules/:segment',
//   TradingValidator.validateTradeSegment,
//   tradingController.getTradingRuleBySegment
// );

// // User margin and collateral routes
// router.get(
//   '/users/:userId/margin',
//   TradingValidator.validateUserId,
//   tradingController.getUserMargin
// );
// router.get(
//   '/users/:userId/collateral',
//   TradingValidator.validateUserId,
//   tradingController.getUserCollateral
// );

// // F&O margin routes
// router.post(
//   '/users/:userId/margin/process-m2m',
//   TradingValidator.validateUserId,
//   tradingController.processM2MLossesAndMargins
// );

// // Order management routes
// router.post(
//   '/users/:userId/orders',
//   TradingValidator.validateUserId,
//   TradingValidator.validateCreateOrder,
//   tradingController.createOrder
// );
// router.get(
//   '/users/:userId/orders',
//   TradingValidator.validateUserId,
//   TradingValidator.validatePagination,
//   tradingController.getUserOrders
// );
// router.get(
//   '/orders/:orderId',
//   TradingValidator.validateOrderId,
//   tradingController.getOrderById
// );
// router.post(
//   '/orders/:orderId/cancel',
//   TradingValidator.validateOrderId,
//   tradingController.cancelOrder
// );

// // Position management routes
// router.get(
//   '/users/:userId/positions',
//   TradingValidator.validateUserId,
//   tradingController.getUserPositions
// );
// router.post(
//   '/positions/:positionId/square-off',
//   TradingValidator.validatePositionId,
//   tradingController.squareOffPosition
// );

// export default router;
