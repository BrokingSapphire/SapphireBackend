import { db } from "@app/database";
import {
    OrderSide,
    ProductType
} from "../orders/order.types";

import {
    ChargesSegmentType,
    ChargesDirection,
    ChargeType,
    ExchangeType,
} from "./charges.types";
import { ChargeCalculationResult,
    EquityDeliveryCharges,
    CurrencyCharges} from "@app/database/db"
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
): Promise<CurrencyCharges> => {
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

// Helper function to determine brokerage percentage based on segment
const getBrokeragePercentage = (segment: ChargesSegmentType): number => {
    switch (segment) {
        case ChargesSegmentType.EQUITY_DELIVERY:
            return 0.5;
        case ChargesSegmentType.EQUITY_INTRADAY:
        case ChargesSegmentType.EQUITY_FUTURES:
            return 0.05;
        case ChargesSegmentType.CURRENCY_FUTURES:
            return 0.02;
        default:
            return 0;
    }
};

// determining exchange charge percentage
const getExchangeChargePercentage = (
    segment: ChargesSegmentType, 
    direction: ChargesDirection, 
    exchange: ExchangeType
): number => {
    if (segment === ChargesSegmentType.CURRENCY_FUTURES) {
        return direction === ChargesDirection.BUY_SELL ? 
            (exchange === ExchangeType.NSE ? 0.00035 : 0.00045) : 0;
    } else {
        return exchange === ExchangeType.NSE ? 0.00297 : 0.00375;
    }
};

// determining IPFT percentage
const getIpftPercentage = (segment: ChargesSegmentType, exchange: ExchangeType): number => {
    if (segment === ChargesSegmentType.CURRENCY_FUTURES) {
        return 0.00005;
    } else {
        return exchange === ExchangeType.NSE ? 0.0001 : 0;
    }
};

// determining STT percentage based on segment and direction
const getSttPercentage = (direction: ChargesDirection, segment: ChargesSegmentType): number => {
    if (segment === ChargesSegmentType.EQUITY_DELIVERY) {
        return 0.1;
    } else if (segment === ChargesSegmentType.EQUITY_INTRADAY) {
        return (direction === ChargesDirection.SELL || direction === ChargesDirection.BUY_SELL) ? 0.025 : 0;
    }
    return 0;
};

// determining stamp duty percentage based on segment and direction
const getStampDutyPercentage = (direction: ChargesDirection, segment: ChargesSegmentType): number => {
    if (segment === ChargesSegmentType.EQUITY_DELIVERY) {
        return direction === ChargesDirection.BUY ? 0.015 : 0;
    } else if (segment === ChargesSegmentType.EQUITY_INTRADAY || segment === ChargesSegmentType.EQUITY_FUTURES) {
        return direction === ChargesDirection.BUY ? 0.003 : 0;
    } else if (segment === ChargesSegmentType.CURRENCY_FUTURES) {
        return (direction === ChargesDirection.BUY || direction === ChargesDirection.SELL) ? 0.001 : 0;
    }
    return 0;
};

// create applied charges array
const createAppliedCharges = (
    charges: EquityDeliveryCharges | CurrencyCharges,
    quantity: number,
    price: number,
    direction: ChargesDirection,
    exchange: ExchangeType,
    segment: ChargesSegmentType
): any[] => {
    const baseAmount = quantity * price;
    const appliedCharges = [];
    
    // Add brokerage charge for all segments
    appliedCharges.push({
        type: ChargeType.BROKERAGE,
        description: "Brokerage",
        value: charges.brokerage,
        percentage: getBrokeragePercentage(segment),
        baseAmount
    });
    
    // Add segment-specific charges
    if (segment === ChargesSegmentType.EQUITY_DELIVERY || segment === ChargesSegmentType.EQUITY_INTRADAY) {
        // STT for equity delivery and intraday
        appliedCharges.push({
            type: ChargeType.STT,
            description: "Securities Transaction Tax",
            value: 'stt' in charges ? charges.stt : 0,
            percentage: getSttPercentage(direction, segment),
            baseAmount
        });
    } else if (segment === ChargesSegmentType.EQUITY_FUTURES) {
        // CTT for equity futures
        appliedCharges.push({
            type: ChargeType.CTT,
            description: "Commodity Transaction Tax",
            value: 'stt' in charges ? charges.stt : 0, // Using stt field for CTT
            percentage: direction === ChargesDirection.SELL ? 0.01 : 0,
            baseAmount
        });
    }
    
    // Add exchange charges for all segments
    appliedCharges.push({
        type: ChargeType.EXCHANGE,
        description: `${exchange.toUpperCase()} Transaction Charges`,
        value: charges.exchangeCharges,
        percentage: getExchangeChargePercentage(segment, direction, exchange),
        baseAmount
    });
    
    // Add SEBI charges for all segments
    appliedCharges.push({
        type: ChargeType.SEBI,
        description: "SEBI Charges",
        value: charges.sebiCharges,
        percentage: 0.000001,
        baseAmount
    });
    
    // Add stamp duty for all segments
    appliedCharges.push({
        type: ChargeType.STAMP_DUTY,
        description: "Stamp Duty",
        value: charges.stampDuty,
        percentage: getStampDutyPercentage(direction, segment),
        baseAmount
    });
    
    // Add IPFT for all segments
    appliedCharges.push({
        type: ChargeType.IPFT,
        description: "Investor Protection Fund",
        value: charges.ipft,
        percentage: getIpftPercentage(segment, exchange),
        baseAmount
    });
    
    // Add GST for all segments
    appliedCharges.push({
        type: ChargeType.GST,
        description: "GST",
        value: charges.gst,
        percentage: 18,
        baseAmount: charges.brokerage + charges.exchangeCharges + charges.sebiCharges + charges.ipft
    });
    
    return appliedCharges;
};

// calculate charges and return detailed breakdown
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
        appliedCharges = createAppliedCharges(charges, quantity, price, direction, exchange, segment);
    } else if (segment === ChargesSegmentType.EQUITY_INTRADAY) {
        charges = await calculateEquityIntradayCharges(quantity, price, direction, exchange);
        appliedCharges = createAppliedCharges(charges, quantity, price, direction, exchange, segment);
    } else if (segment === ChargesSegmentType.EQUITY_FUTURES) {
        charges = await calculateEquityFuturesCharges(quantity, price, direction, exchange);
        appliedCharges = createAppliedCharges(charges, quantity, price, direction, exchange, segment);
    } else if (segment === ChargesSegmentType.CURRENCY_FUTURES) {
        charges = await calculateCurrencyFutureCharges(quantity, price, direction, exchange);
        appliedCharges = createAppliedCharges(charges, quantity, price, direction, exchange, segment);
    } else if (segment === ChargesSegmentType.EQUITY_OPTIONS) {
        // Options charges calculation not implemented yet
        throw new Error(`Charges calculation for EQUITY_OPTIONS not implemented yet`);
    } else if (segment === ChargesSegmentType.CURRENCY_OPTIONS) {
        // Currency Options charges calculation not implemented yet
        throw new Error(`Charges calculation for CURRENCY_OPTIONS not implemented yet`);
    } else {
        throw new Error(`Charges calculation for segment ${segment} not implemented yet`);
    }
    
    // Store the charges calculation
    try {
        const chargeTypes = await db
            .selectFrom('charge_types')
            .where('name', 'in', appliedCharges.map(charge => charge.type))
            .select(['id', 'name'])
            .execute();
        
        const chargeTypeMap = new Map(
            chargeTypes.map(record => [record.name, record.id])
        );
        
        // Log any charge types not found in the database
        appliedCharges
            .filter(charge => !chargeTypeMap.has(charge.type))
            .forEach(charge => {
                logger.error(`Charge type ${charge.type} not found in database`);
            });

        const orderChargesValues = appliedCharges
            .filter(charge => chargeTypeMap.has(charge.type)) 
            .map(charge => {
                const chargeTypeId = chargeTypeMap.get(charge.type);
                // Only proceed if we have a valid ID
                if (chargeTypeId === undefined) {
                    return null;
                }
                
                return {
                    order_id: orderId,
                    charge_type_id: chargeTypeId, 
                    charge_amount: charge.value,
                    is_percentage: charge.percentage !== undefined,
                    percentage_value: charge.percentage || null,
                    transaction_value: charge.baseAmount || (quantity * price),
                    created_at: new Date()
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null); 
            
        await db.transaction().execute(async (trx) => {
            // Update total charges in the orders table
            await trx
                .updateTable('orders')
                .set({ total_charges: charges.total })
                .where('id', '=', orderId)
                .execute();
            
            if (orderChargesValues.length > 0) {
                await trx
                    .insertInto('order_charges')
                    .values(orderChargesValues)
                    .execute();
            }
        });
    } catch (error) {
        logger.error(`Failed to store charges for order ${orderId}:`, error);
    }
    
    return {
        order_id: orderId,
        total_charges: charges.total,
        applied_charges: appliedCharges
    };
};

export const applyOrderCharges = async (
    orderId: number,
    userId: number
): Promise<ChargeCalculationResult> => {
    // Get order details
    const order = await db
        .selectFrom('orders')
        .where('id', '=', orderId)
        .selectAll()
        .executeTakeFirst();
    
    if (!order) {
        throw new Error(`Order not found: ${orderId}`);
    }
    
    // get the type of product
    let productType: ProductType;

    // implementing switch case
    switch(order.order_category){
        case 'instant':
            const instantOrder = await db
                .selectFrom('instant_orders')
                .where('order_id', '=', orderId)
                .select(['product_type'])
                .executeTakeFirst();
            
            productType = instantOrder?.product_type as ProductType || ProductType.DELIVERY;
            break;
        
        case 'normal':
            // Normal orders are always delivery
            productType = ProductType.DELIVERY;
            break;
        
        case 'iceberg':
            const icebergOrder = await db
                .selectFrom('iceberg_orders')
                .where('order_id', '=', orderId)
                .select(['product_type'])
                .executeTakeFirst();
            
            productType = icebergOrder?.product_type as ProductType || ProductType.DELIVERY;
            break;
        
        case 'cover_order':
            // Cover orders are always intraday
            productType = ProductType.INTRADAY;
            break;
        
        default:
            productType = ProductType.DELIVERY;
    }

    // Identifying the direct (BUY OR SELL)
    let direction: ChargesDirection;
    switch (order.order_side) {
        case OrderSide.BUY:
            direction = ChargesDirection.BUY;
            break;
        case OrderSide.SELL:
            direction = ChargesDirection.SELL;
            break;
        default:
            direction = ChargesDirection.BUY; 
    }

    // calculating charges with the help of calculateCharges function above
    const chargesResult = await calculateCharges(
        orderId,
        order.quantity,
        order.price || 0,
        direction,
        order.exchange as ExchangeType || ExchangeType.NSE,
        productType
    );

    return chargesResult;
};