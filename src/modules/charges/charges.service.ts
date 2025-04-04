import { db } from "@app/database";
import {
    OrderSide,
    ProductType,
    OrderCategory,
} from "../orders/order.types";

import {
    ChargesSegmentType,
    ChargesDirection,
    ChargeType,
    ExchangeType,
    ChargeCalculationResult,
    EquityDeliveryCharges,
    CurrencyCharges
} from "./charges.types";
import logger from '@app/logger';

// Calculate charges for Equity Delivery
const calculateEquityDeliveryCharges = async (
    quantity: number, 
    price: number, 
    direction: ChargesDirection, 
    exchange: ExchangeType
): Promise<EquityDeliveryCharges> => {
    
    const transaction = quantity * price;
    
    // Calculate brokerage
    const brokerage = Math.max(Math.min((0.5 / 100) * transaction, 20), 2.5);
    
    // Calculate STT
    const stt = (0.1 / 100) * transaction;
    
    // Calculate exchange transaction charges
    let txnCharges = 0;
    if (exchange === ExchangeType.NSE) {
        txnCharges = (0.00297 / 100) * transaction;
    } else if (exchange === ExchangeType.BSE) {
        txnCharges = (0.00375 / 100) * transaction;
    }
    
    // Calculate SEBI charges
    const sebi = (10 / 10000000) * transaction; // 10 rupees per crore
    
    // Calculate stamp duty (only applicable on buy)
    let stampDuty = 0;
    if (direction === ChargesDirection.BUY) {
        stampDuty = (0.015 / 100) * transaction;
    }
    
    // Calculate IPFT (only for NSE)
    let ipft = 0;
    if (exchange === ExchangeType.NSE) {
        ipft = (0.0001 / 100) * transaction;
    }
    
    // Calculate GST (18% on brokerage, exchange, SEBI, and IPFT charges)
    const gst = (18 / 100) * (brokerage + txnCharges + sebi + ipft);
    
    // Calculate total charges
    const total = brokerage + stt + txnCharges + sebi + stampDuty + ipft + gst;
    
    return {
        brokerage,
        stt,
        exchangeCharges: txnCharges,
        sebiCharges: sebi,
        stampDuty,
        ipft,
        gst,
        total
    };
};

// Calculate charges for Equity Intraday
const calculateEquityIntradayCharges = async (
    quantity: number, 
    price: number, 
    direction: ChargesDirection, 
    exchange: ExchangeType
): Promise<EquityDeliveryCharges> => {
    
    const transaction = quantity * price;
    
    // Calculate brokerage - 0.05% with max cap of 20 and min cap of 2.5
    const brokerage = Math.max(Math.min((0.05 / 100) * transaction, 20), 2.5);
    
    // Calculate STT - 0.025% only on sell side
    let stt = 0;
    if (direction === ChargesDirection.SELL || direction === ChargesDirection.BUY_SELL) {
        stt = (0.025 / 100) * transaction;
    }
    
    // Calculate exchange transaction charges
    let txnCharges = 0;
    if (exchange === ExchangeType.NSE) {
        txnCharges = (0.00297 / 100) * transaction;
    } else if (exchange === ExchangeType.BSE) {
        txnCharges = (0.00375 / 100) * transaction;
    }
    
    // Calculate SEBI charges - same as delivery
    const sebi = (10 / 10000000) * transaction; // 10 rupees per crore
    
    // Calculate stamp duty - 0.003% on buy side
    let stampDuty = 0;
    if (direction === ChargesDirection.BUY) {
        stampDuty = (0.003 / 100) * transaction;
    }
    
    // Calculate IPFT (only for NSE) - same as delivery
    let ipft = 0;
    if (exchange === ExchangeType.NSE) {
        ipft = (0.0001 / 100) * transaction;
    }
    
    // Calculate GST (18% on brokerage, exchange, SEBI, and IPFT charges)
    const gst = (18 / 100) * (brokerage + txnCharges + sebi + ipft);
    
    // Calculate total charges
    const total = brokerage + stt + txnCharges + sebi + stampDuty + ipft + gst;
    
    return {
        brokerage,
        stt,
        exchangeCharges: txnCharges,
        sebiCharges: sebi,
        stampDuty,
        ipft,
        gst,
        total
    };
};

const calculateEquityFuturesCharges = async (
    quantity: number,
    price: number,
    direction: ChargesDirection,
    exchange: ExchangeType
) : Promise<EquityDeliveryCharges> => {

    const transaction = quantity * price;
    const brokerage = Math.max(Math.min((0.05 / 100) * transaction, 20), 2.5);
    let ctt = 0;
    if(direction === ChargesDirection.SELL) {
        ctt = (0.01 / 100) * transaction;
    }
    let txnCharges = 0;
    if (exchange === ExchangeType.NSE) {
        txnCharges = (0.00297 / 100) * transaction;
    }
    else if (exchange === ExchangeType.BSE) {
        txnCharges = (0.00375 / 100) * transaction;
    }
    const sebi = (10 / 10000000) * transaction; // 10 rupees per crore
    let stampDuty = 0;
    if (direction === ChargesDirection.BUY) {
        stampDuty = (0.003 / 100) * transaction;
    }
    let ipft = 0;
    if (exchange === ExchangeType.NSE) {
        ipft = (0.0001 / 100) * transaction;
    }
    const gst = (18 / 100) * (brokerage + txnCharges + sebi + ipft);
    const total = brokerage + ctt + txnCharges + sebi + stampDuty + ipft + gst;
    return {
        brokerage,
        stt: ctt,
        exchangeCharges: txnCharges,
        sebiCharges: sebi,
        stampDuty,
        ipft,
        gst,
        total
    };
}

const calculateCurrencyFutureCharges = async (
    quantity: number, 
    price: number, 
    direction: ChargesDirection, 
    exchange: ExchangeType
): Promise<CurrencyCharges> =>{
    const transaction = quantity * price;
    const brokerage = Math.max(Math.min((0.02 / 100) * transaction, 20), 2.5);

    let txnCharges = 0;
    if(direction === ChargesDirection.BUY_SELL && exchange === ExchangeType.NSE){
        txnCharges = (0.00035 / 100) * transaction;
    }
    else if(direction === ChargesDirection.BUY_SELL && exchange === ExchangeType.BSE){
        txnCharges = (0.00045 / 100) * transaction;
    }

    const sebi = (10 / 10000000) * transaction; //  rupees10/crore

    let stampDuty = 0;
    if (direction === ChargesDirection.BUY || direction === ChargesDirection.SELL) {
        stampDuty = (0.001 / 100) * transaction;
    }
    const ipft = (0.00005 / 100) * transaction;
    const gst = (18 / 100) * (brokerage + txnCharges + sebi + ipft);
    
    // Calculate total charges
    const total = brokerage + txnCharges + sebi + stampDuty + gst;
    
    return {
        brokerage,
        exchangeCharges: txnCharges,
        sebiCharges: sebi,
        stampDuty,
        ipft,
        gst,
        total
    };
}

// Function to calculate charges and return detailed breakdown
export const calculateCharges = async (
    orderId: number,
    quantity: number,
    price: number,
    direction: ChargesDirection,
    exchange: ExchangeType,
    productType: ProductType
): Promise<ChargeCalculationResult> => {
        let segment: ChargesSegmentType;
        
        // Map product type to segment type
        switch (productType) {
            case ProductType.DELIVERY:
                segment = ChargesSegmentType.EQUITY_DELIVERY;
                break;
            case ProductType.INTRADAY:
                segment = ChargesSegmentType.EQUITY_INTRADAY;
                break;
            case ProductType.FUTURES:
                segment = ChargesSegmentType.EQUITY_FUTURES;
                break;
            case ProductType.OPTIONS:
                segment = ChargesSegmentType.EQUITY_OPTIONS;
                break;
            case ProductType.CURRENCY:
                segment = ChargesSegmentType.CURRENCY_FUTURES;
                break;
            default:
                throw new Error(`Unsupported product type: ${productType}`);
        }
        
        let charges;
        let appliedCharges = [];
        
        if (segment === ChargesSegmentType.EQUITY_DELIVERY) {
            charges = await calculateEquityDeliveryCharges(quantity, price, direction, exchange);
            
            // Create breakdown of applied charges for Equity Delivery
            appliedCharges = [
                {
                    type: ChargeType.BROKERAGE,
                    description: "Brokerage",
                    value: charges.brokerage,
                    percentage: 0.5,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.STT,
                    description: "Securities Transaction Tax",
                    value: charges.stt,
                    percentage: 0.1,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.EXCHANGE,
                    description: `${exchange.toUpperCase()} Transaction Charges`,
                    value: charges.exchangeCharges,
                    percentage: exchange === ExchangeType.NSE ? 0.00297 : 0.00375,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.SEBI,
                    description: "SEBI Charges",
                    value: charges.sebiCharges,
                    percentage: 0.000001,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.STAMP_DUTY,
                    description: "Stamp Duty",
                    value: charges.stampDuty,
                    percentage: direction === ChargesDirection.BUY ? 0.015 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.IPFT,
                    description: "Investor Protection Fund",
                    value: charges.ipft,
                    percentage: exchange === ExchangeType.NSE ? 0.0001 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.GST,
                    description: "GST",
                    value: charges.gst,
                    percentage: 18,
                    baseAmount: charges.brokerage + charges.exchangeCharges + charges.sebiCharges + charges.ipft
                }
            ];
        } else if (segment === ChargesSegmentType.EQUITY_INTRADAY) {
            charges = await calculateEquityIntradayCharges(quantity, price, direction, exchange);
            
            // Create breakdown of applied charges for Equity Intraday
            appliedCharges = [
                {
                    type: ChargeType.BROKERAGE,
                    description: "Brokerage",
                    value: charges.brokerage,
                    percentage: 0.05,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.STT,
                    description: "Securities Transaction Tax",
                    value: charges.stt,
                    percentage: direction === ChargesDirection.SELL || direction === ChargesDirection.BUY_SELL ? 0.025 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.EXCHANGE,
                    description: `${exchange.toUpperCase()} Transaction Charges`,
                    value: charges.exchangeCharges,
                    percentage: exchange === ExchangeType.NSE ? 0.00297 : 0.00375,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.SEBI,
                    description: "SEBI Charges",
                    value: charges.sebiCharges,
                    percentage: 0.000001,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.STAMP_DUTY,
                    description: "Stamp Duty",
                    value: charges.stampDuty,
                    percentage: direction === ChargesDirection.BUY ? 0.003 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.IPFT,
                    description: "Investor Protection Fund",
                    value: charges.ipft,
                    percentage: exchange === ExchangeType.NSE ? 0.0001 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.GST,
                    description: "GST",
                    value: charges.gst,
                    percentage: 18,
                    baseAmount: charges.brokerage + charges.exchangeCharges + charges.sebiCharges + charges.ipft
                }
            ];
        } else if (segment === ChargesSegmentType.EQUITY_FUTURES) {
            charges = await calculateEquityFuturesCharges(quantity, price, direction, exchange);
            
            // Create breakdown of applied charges for Equity Futures
            appliedCharges = [
                {
                    type: ChargeType.BROKERAGE,
                    description: "Brokerage",
                    value: charges.brokerage,
                    percentage: 0.05,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.CTT,
                    description: "Commodity Transaction Tax",
                    value: charges.stt, // Note: using stt field for CTT
                    percentage: direction === ChargesDirection.SELL ? 0.01 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.EXCHANGE,
                    description: `${exchange.toUpperCase()} Transaction Charges`,
                    value: charges.exchangeCharges,
                    percentage: exchange === ExchangeType.NSE ? 0.00297 : 0.00375,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.SEBI,
                    description: "SEBI Charges",
                    value: charges.sebiCharges,
                    percentage: 0.000001,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.STAMP_DUTY,
                    description: "Stamp Duty",
                    value: charges.stampDuty,
                    percentage: direction === ChargesDirection.BUY ? 0.003 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.IPFT,
                    description: "Investor Protection Fund",
                    value: charges.ipft,
                    percentage: exchange === ExchangeType.NSE ? 0.0001 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.GST,
                    description: "GST",
                    value: charges.gst,
                    percentage: 18,
                    baseAmount: charges.brokerage + charges.exchangeCharges + charges.sebiCharges + charges.ipft
                }
            ];
        } else if (segment === ChargesSegmentType.CURRENCY_FUTURES) {
            // Note: Using the updated function name
            charges = await calculateCurrencyFutureCharges(quantity, price, direction, exchange);
            
            // Create breakdown of applied charges for Currency
            appliedCharges = [
                {
                    type: ChargeType.BROKERAGE,
                    description: "Brokerage",
                    value: charges.brokerage,
                    percentage: 0.02,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.EXCHANGE,
                    description: `${exchange.toUpperCase()} Transaction Charges`,
                    value: charges.exchangeCharges,
                    percentage: direction === ChargesDirection.BUY_SELL ? 
                        (exchange === ExchangeType.NSE ? 0.00035 : 0.00045) : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.SEBI,
                    description: "SEBI Charges",
                    value: charges.sebiCharges,
                    percentage: 0.000001,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.STAMP_DUTY,
                    description: "Stamp Duty",
                    value: charges.stampDuty,
                    percentage: (direction === ChargesDirection.BUY || direction === ChargesDirection.SELL) ? 0.001 : 0,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.IPFT,
                    description: "Investor Protection Fund",
                    value: charges.ipft,
                    percentage: 0.00005,
                    baseAmount: quantity * price
                },
                {
                    type: ChargeType.GST,
                    description: "GST",
                    value: charges.gst,
                    percentage: 18,
                    baseAmount: charges.brokerage + charges.exchangeCharges + charges.sebiCharges + charges.ipft
                }
            ];
        } else if (segment === ChargesSegmentType.EQUITY_OPTIONS) {
            // Options charges calculation not implemented yet
            throw new Error(`Charges calculation for EQUITY_OPTIONS not implemented yet`);
        } else if (segment === ChargesSegmentType.CURRENCY_OPTIONS) {
            // Currency Options charges calculation not implemented yet
            throw new Error(`Charges calculation for CURRENCY_OPTIONS not implemented yet`);
        } else {
            throw new Error(`Charges calculation for segment ${segment} not implemented yet`);
        }
        
        // Store the charges calculation in the database using Kysely
        try {
            // First update the total charges in the orders table
            await db
                .updateTable('orders')
                .set({ total_charges: charges.total })
                .where('id', '=', orderId)
                .execute();
            
            // Then store individual charge breakdowns using the order_charges table
            for (const charge of appliedCharges) {
                // First need to get charge_type_id from charge_types table
                const chargeTypeRecord = await db
                    .selectFrom('charge_types')
                    .where('name', '=', charge.type)
                    .select(['id'])
                    .executeTakeFirst();
                
                if (!chargeTypeRecord) {
                    logger.error(`Charge type ${charge.type} not found in database`);
                    continue;
                }
                
                // Store the charge breakdown
                await db
                    .insertInto('order_charges')
                    .values({
                        order_id: orderId,
                        charge_type_id: chargeTypeRecord.id,
                        charge_amount: charge.value,
                        is_percentage: charge.percentage !== undefined,
                        percentage_value: charge.percentage || null,
                        transaction_value: charge.baseAmount || (quantity * price),
                        created_at: new Date()
                    })
                    .execute();
            }
        } catch (error) {
            // Log the error but don't fail the entire charge calculation
            logger.error(`Failed to store charges for order ${orderId}:`, error);
        }
        
        return {
            order_id: orderId,
            total_charges: charges.total,
            applied_charges: appliedCharges
        };
};