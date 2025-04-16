import { Request, Response } from 'express';
import * as TradeService from './trade.service';

// Create trade advice
export const createTradeAdvice = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { baseTradeAdvice, instrumentDetails } = req.body;

    // Validate request
    if (!baseTradeAdvice || !instrumentDetails) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const result = await TradeService.createTradeAdvice(
      { baseTradeAdvice, instrumentDetails },
      userId
    );

    return res.status(201).json({
      success: true,
      message: 'Trade advice created successfully',
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create trade advice'
    });
  }
};

// Get trade advice
export const getTradeAdvice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { instrumentType } = req.query;

    let result;

    if (id) {
      result = await TradeService.getTradeAdvice(parseInt(id,10));

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Trade advice not found'
        });
      }
    } else if (instrumentType) {
      result = await TradeService.getTradeAdvice(
        undefined, instrumentType as any
      );
    } else {
      result = await TradeService.getTradeAdvice();
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get trade advice'
    });
  }
};