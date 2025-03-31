// order.validator.ts

import Joi from 'joi';
import { 
  OrderSide, 
  ProductType, 
  OrderType, 
  OrderValidity, 
  OrderCategory, 
  OrderStatus 
} from './order.types';

/**
 * Validator for instant order requests
 */
export const InstantOrderSchema = Joi.object({
  symbol: Joi.string().required(),
  orderSide: Joi.string()
    .valid(...Object.values(OrderSide))
    .required(),
  quantity: Joi.number().integer().positive().required(),
  price: Joi.number().positive().when('orderType', {
    is: OrderType.LIMIT_ORDER,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  productType: Joi.string()
    .valid(...Object.values(ProductType))
    .required(),
  orderType: Joi.string()
    .valid(OrderType.MARKET_ORDER, OrderType.LIMIT_ORDER)
    .required()
});

/**
 * Validator for normal order requests
 */
export const NormalOrderSchema = Joi.object({
  symbol: Joi.string().required(),
  orderSide: Joi.string()
    .valid(...Object.values(OrderSide))
    .required(),
  quantity: Joi.number().integer().positive().required(),
  price: Joi.number().positive().when('orderType', {
    is: OrderType.LIMIT_ORDER,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  orderType: Joi.string()
    .valid(...Object.values(OrderType))
    .required(),
  triggerPrice: Joi.number().positive().when('orderType', {
    is: [OrderType.SL, OrderType.SL_M],
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  validity: Joi.string()
    .valid(...Object.values(OrderValidity))
    .required(),
  validityMinutes: Joi.number().integer().positive().when('validity', {
    is: OrderValidity.MINUTES,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  disclosedQuantity: Joi.number().integer().positive().max(Joi.ref('quantity')).optional()
});

/**
 * Validator for iceberg order requests
 */
export const IcebergOrderSchema = Joi.object({
  symbol: Joi.string().required(),
  orderSide: Joi.string()
    .valid(...Object.values(OrderSide))
    .required(),
  quantity: Joi.number().integer().positive().required(),
  price: Joi.number().positive().when('orderType', {
    is: OrderType.LIMIT_ORDER,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  orderType: Joi.string()
    .valid(...Object.values(OrderType))
    .required(),
  triggerPrice: Joi.number().positive().when('orderType', {
    is: [OrderType.SL, OrderType.SL_M],
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  validity: Joi.string()
    .valid(...Object.values(OrderValidity))
    .required(),
  validityMinutes: Joi.number().integer().positive().when('validity', {
    is: OrderValidity.MINUTES,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  disclosedQuantity: Joi.number().integer().positive().max(Joi.ref('quantity')).required(),
  numOfLegs: Joi.number().integer().positive().required(),
  productType: Joi.string()
    .valid(ProductType.INTRADAY, ProductType.DELIVERY)
    .required()
});

/**
 * Validator for cover order requests
 */
export const CoverOrderSchema = Joi.object({
  symbol: Joi.string().required(),
  orderSide: Joi.string()
    .valid(...Object.values(OrderSide))
    .required(),
  quantity: Joi.number().integer().positive().required(),
  price: Joi.number().positive().when('orderType', {
    is: OrderType.LIMIT_ORDER,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  orderType: Joi.string()
    .valid(OrderType.MARKET_ORDER, OrderType.LIMIT_ORDER)
    .required(),
  stopLossPrice: Joi.number().positive().required()
    .when('orderSide', {
      is: OrderSide.BUY,
      then: Joi.number().less(Joi.ref('price', {
        adjust: (value) => value || Number.MAX_SAFE_INTEGER
      })),
      otherwise: Joi.number().greater(Joi.ref('price', {
        adjust: (value) => value || 0
      }))
    })
});

/**
 * Validator for order ID parameter
 */
export const OrderIdSchema = Joi.object({
  orderId: Joi.number().integer().positive().required()
});

/**
 * Validator for user ID parameter
 */
export const UserIdSchema = Joi.object({
  userId: Joi.number().integer().positive().required()
});

/**
 * Validator for order query parameters
 */
export const OrderQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(OrderStatus))
    .optional(),
  category: Joi.string()
    .valid(...Object.values(OrderCategory))
    .optional(),
  page: Joi.number().integer().positive().optional(),
  limit: Joi.number().integer().positive().optional()
});

/**
 * Validator for recent orders query parameters
 */
export const OrderLimitSchema = Joi.object({
  limit: Joi.number().integer().positive().optional()
});