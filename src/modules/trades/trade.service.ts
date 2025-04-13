import * as TradeModel from './trade.model';
import {
  TradeAdvice,
  InstrumentType,
  TradeStatus,
  StockTradeAdvice,
  FutureTradeAdvice,
  CommodityTradeAdvice,
  OptionTradeAdvice
} from './types';
import { getSocketServer } from './socket.config';

// Interface for create trade advice request
interface CreateTradeAdviceRequest {
  baseTradeAdvice: Omit<TradeAdvice, 'id' | 'posted_at'>;
  instrumentDetails: {
    quantity?: number;              // For stock
    lot_size?: number;              // For future, option, commodity
    expiry_date?: Date;             // For future, option, commodity
    strike_price?: number;          // For option
    option_type?: 'CALL' | 'PUT';   // For option
  };
}

// Create trade advice with the appropriate instrument details
export const createTradeAdvice = async (
  data: CreateTradeAdviceRequest,
  userId: number
): Promise<any> => {
  try {
    // Set posted_by to userId
    const baseTradeAdvice = {
      ...data.baseTradeAdvice,
      posted_by: userId
    };

    // Create base trade advice
    const newTradeAdvice = await TradeModel.createTradeAdvice(baseTradeAdvice);

    // Create instrument-specific details
    let instrumentDetails;

    switch (newTradeAdvice.instrument_type) {
      case 'stock':
        if (!data.instrumentDetails.quantity) {
          throw new Error('Quantity is required for stock trade advice');
        }

        instrumentDetails = await TradeModel.createStockTradeAdvice({
          trade_advice_id: newTradeAdvice.id,
          quantity: data.instrumentDetails.quantity
        });
        break;

      case 'future':
        if (!data.instrumentDetails.lot_size || !data.instrumentDetails.expiry_date) {
          throw new Error('Lot size and expiry date are required for future trade advice');
        }

        instrumentDetails = await TradeModel.createFutureTradeAdvice({
          trade_advice_id: newTradeAdvice.id,
          lot_size: data.instrumentDetails.lot_size,
          expiry_date: data.instrumentDetails.expiry_date
        });
        break;

      case 'commodity':
        if (!data.instrumentDetails.lot_size || !data.instrumentDetails.expiry_date) {
          throw new Error('Lot size and expiry date are required for commodity trade advice');
        }

        instrumentDetails = await TradeModel.createCommodityTradeAdvice({
          trade_advice_id: newTradeAdvice.id,
          lot_size: data.instrumentDetails.lot_size,
          expiry_date: data.instrumentDetails.expiry_date
        });
        break;

      case 'option':
        if (
          !data.instrumentDetails.lot_size ||
          !data.instrumentDetails.expiry_date ||
          !data.instrumentDetails.strike_price ||
          !data.instrumentDetails.option_type
        ) {
          throw new Error('Lot size, expiry date, strike price, and option type are required for option trade advice');
        }

        instrumentDetails = await TradeModel.createOptionTradeAdvice({
          trade_advice_id: newTradeAdvice.id,
          lot_size: data.instrumentDetails.lot_size,
          expiry_date: data.instrumentDetails.expiry_date,
          strike_price: data.instrumentDetails.strike_price,
          option_type: data.instrumentDetails.option_type
        });
        break;

      default:
        throw new Error(`Invalid instrument type: ${newTradeAdvice.instrument_type}`);
    }

    const result = {
      ...newTradeAdvice,
      instrumentDetails
    };

    // Emit to socket
    const io = getSocketServer();
    io.to(newTradeAdvice.instrument_type).emit('newTradeAdvice', result);

    return result;
  } catch (error) {
    throw error;
  }
};

// Get trade advice with instrument details
export const getTradeAdvice = async (id?: number, instrumentType?: InstrumentType): Promise<any> => {
  try {
    if (id) {
      // Get specific trade advice
      const tradeAdvice = await TradeModel.getTradeAdviceById(id);

      if (!tradeAdvice) {
        return null;
      }

      const instrumentDetails = await TradeModel.getInstrumentDetails(
        id, tradeAdvice.instrument_type
      );

      return {
        ...tradeAdvice,
        instrumentDetails
      };
    } else if (instrumentType) {
      // Get all trade advice by instrument type
      const tradeAdviceList = await TradeModel.getTradeAdviceByInstrumentType(instrumentType);

      // Get instrument details for each trade advice
      const resultPromises = tradeAdviceList.map(async (advice) => {
        const instrumentDetails = await TradeModel.getInstrumentDetails(
          advice.id, advice.instrument_type
        );

        return {
          ...advice,
          instrumentDetails
        };
      });

      return Promise.all(resultPromises);
    } else {
      // Get all trade advice
      const tradeAdviceList = await TradeModel.getAllTradeAdvice();

      // Get instrument details for each trade advice
      const resultPromises = tradeAdviceList.map(async (advice) => {
        const instrumentDetails = await TradeModel.getInstrumentDetails(
          advice.id, advice.instrument_type
        );

        return {
          ...advice,
          instrumentDetails
        };
      });

      return Promise.all(resultPromises);
    }
  } catch (error) {
    throw error;
  }
};