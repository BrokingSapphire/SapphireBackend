import db from '../../../config/db.config';
import {
  TradeAdvice,
  StockTradeAdvice,
  FutureTradeAdvice,
  CommodityTradeAdvice,
  OptionTradeAdvice,
  InstrumentType
} from './types';

// Create base trade advice
export const createTradeAdvice = async (tradeAdvice: Omit<TradeAdvice, 'id' | 'posted_at'>): Promise<TradeAdvice> => {
  return await db.transaction().execute(async (trx) => {
    const result = await trx
      .insertInto('trade_advice')
      .values({
        ...tradeAdvice,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return result;
  });
};

// Create instrument-specific models
export const createStockTradeAdvice = async (stockDetails: Omit<StockTradeAdvice, 'id'>): Promise<StockTradeAdvice> => {
  const result = await db
    .insertInto('stock_trade_advice')
    .values(stockDetails)
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
};

export const createFutureTradeAdvice = async (futureDetails: Omit<FutureTradeAdvice, 'id'>): Promise<FutureTradeAdvice> => {
  const result = await db
    .insertInto('future_trade_advice')
    .values(futureDetails)
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
};

export const createCommodityTradeAdvice = async (commodityDetails: Omit<CommodityTradeAdvice, 'id'>): Promise<CommodityTradeAdvice> => {
  const result = await db
    .insertInto('commodity_trade_advice')
    .values(commodityDetails)
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
};

export const createOptionTradeAdvice = async (optionDetails: Omit<OptionTradeAdvice, 'id'>): Promise<OptionTradeAdvice> => {
  const result = await db
    .insertInto('option_trade_advice')
    .values(optionDetails)
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
};

// Get trade advice
export const getTradeAdviceById = async (id: number): Promise<TradeAdvice | undefined> => {
  return await db
    .selectFrom('trade_advice')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst();
};

export const getTradeAdviceByInstrumentType = async (instrumentType: InstrumentType): Promise<TradeAdvice[]> => {
  return await db
    .selectFrom('trade_advice')
    .where('instrument_type', '=', instrumentType)
    .selectAll()
    .execute();
};

export const getAllTradeAdvice = async (): Promise<TradeAdvice[]> => {
  return await db
    .selectFrom('trade_advice')
    .selectAll()
    .orderBy('posted_at', 'desc')
    .execute();
};

// Get instrument-specific details
export const getInstrumentDetails = async (tradeAdviceId: number, instrumentType: InstrumentType): Promise<any> => {
  switch (instrumentType) {
    case 'stock':
      return await db
        .selectFrom('stock_trade_advice')
        .where('trade_advice_id', '=', tradeAdviceId)
        .selectAll()
        .executeTakeFirst();
    case 'future':
      return await db
        .selectFrom('future_trade_advice')
        .where('trade_advice_id', '=', tradeAdviceId)
        .selectAll()
        .executeTakeFirst();
    case 'commodity':
      return await db
        .selectFrom('commodity_trade_advice')
        .where('trade_advice_id', '=', tradeAdviceId)
        .selectAll()
        .executeTakeFirst();
    case 'option':
      return await db
        .selectFrom('option_trade_advice')
        .where('trade_advice_id', '=', tradeAdviceId)
        .selectAll()
        .executeTakeFirst();
    default:
      throw new Error(`Invalid instrument type: ${instrumentType}`);
  }
};