// charges.types.ts

export enum ChargesSegmentType {
    EQUITY_DELIVERY = 'Equity Delivery',
    EQUITY_INTRADAY = 'Equity Intraday',
    EQUITY_FUTURES = 'Equity Futures',
    EQUITY_OPTIONS = 'Equity Options',
    CURRENCY_FUTURES = 'Currency Futures',
    CURRENCY_OPTIONS = 'Currency Options'
  }
  
  export enum ChargesDirection {
    BUY = 'Buy',
    SELL = 'Sell',
    BUY_SELL = 'Buy&Sell'
  }
  
  export enum ExchangeType {
    NSE = 'nse',
    BSE = 'bse',
    MCX = 'mcx',
    NCDEX = 'ncdex'
  }
  
  export enum ChargeType {
    BROKERAGE = 'brokerage',
    STT = 'stt',
    CTT = 'ctt',
    EXCHANGE = 'exchange',
    GST = 'gst',
    SEBI = 'sebi',
    STAMP_DUTY = 'stamp_duty',
    IPFT = 'ipft'
  }
  
  export interface BrokerageCharge {
    id: number;
    percent: number;
    upperLimit: number;
    lowerLimit: number;
    createdAt: Date;
  }
  
  export interface CttSttCharge {
    id: number;
    charge: number;
    direction: ChargesDirection;
  }
  
  export interface StampDutyCharge {
    id: number;
    charge: number;
    direction: ChargesDirection;
  }
  
  export interface NSEExchangeCharge {
    id: number;
    charge: number;
  }
  
  export interface BSEExchangeCharge {
    id: number;
    charge: number;
  }
  
  export interface MCXExchangeCharge {
    id: number;
    charge: number;
  }
  
  export interface NCDEXExchangeCharge {
    id: number;
    charge: number;
  }
  
  export interface ExchangeCharges {
    id: number;
    chargeNse?: NSEExchangeCharge;
    chargeBse?: BSEExchangeCharge;
    chargeMcx?: MCXExchangeCharge;
    chargeNcdex?: NCDEXExchangeCharge;
    createdAt: Date;
  }
  
  export interface GSTCharge {
    id: number;
    rate: number;
    createdAt: Date;
  }
  
  export interface SegmentCharges {
    id: number;
    segment: ChargesSegmentType;
    brokerage: BrokerageCharge;
    sttCttCharges: CttSttCharge;
    exchangeCharges: ExchangeCharges;
    gst: GSTCharge;
    sebiCharges: number;
    stampDuty: StampDutyCharge;
    createdAt: Date;
  }
  
  export interface ChargesHistoryRecord {
    id: number;
    transactionChargesId: number;
    segment: ChargesSegmentType;
    brokerageId: number;
    sttCttChargesId: number;
    exchangeChargesId: number;
    gstId: number;
    sebiCharges: number;
    stampDutyId: number;
    effectiveFrom: Date;
    changedAt: Date;
  }
  
  // Request/Response interfaces for charges calculation
  
  export interface CalculateChargesRequest {
    segment: ChargesSegmentType;
    exchange: ExchangeType;
    tradeValue: number;
    quantity: number;
    price: number;
    direction: ChargesDirection;
  }
  
  export interface ChargeBreakdown {
    type: ChargeType;
    description: string;
    value: number;
    percentage?: number;
    baseAmount?: number;
  }
  
  export interface CalculateChargesResponse {
    totalCharges: number;
    netAmount: number;
    breakdown: ChargeBreakdown[];
  }
  
  // Equity Delivery specific charges
  export interface EquityDeliveryCharges {
    brokerage: number;
    stt: number;
    exchangeCharges: number;
    sebiCharges: number;
    stampDuty: number;
    ipft: number;
    gst: number;
    total: number;
  }

  // Currency specific charges
  export interface CurrencyCharges {
    brokerage: number;
    exchangeCharges: number;
    sebiCharges: number;
    stampDuty: number;
    ipft: number;
    gst: number;
    total: number;
  }
  
  // Not adding COmmodity charges for now

  // Specific config for Equity Delivery as requested
  export interface EquityDeliveryConfig {
    brokerage: {
      percent: number;    
      maxCap: number;
      minCap: number;    
    };
    stt: {
      buy: number;        
      sell: number;     
    };
    exchangeCharges: {
      nse: number;        
      bse: number;      
    };
    sebi: {
      rate: number;    
    };
    stampDuty: {
      buy: number;       
      sell: number;       
    };
    ipft: {
      nse: number;        
      bse: number;        
    };
    gst: {
      rate: number;      
      appliesTo: ChargeType[]; // [BROKERAGE, SEBI, EXCHANGE, IPFT]
    };
}

export interface CurrencyFuturesConfig {
    brokerage: {
      percent: number;    // 0.02%
      maxCap: number;     // 20 rupees
      minCap: number;     // 2.5 rupees
    };
    exchangeCharges: {
      nse: number;
      bse: number       // 0.001%
    };
    sebi: {
      rate: number;       // 10 rupees per crore
    };
    stampDuty: {
      buy: number;        // 0.001%
      sell: number;       // 0%
    };
    ipft:{
      rate: number;       // 0.00005%
    }
    gst: {
      rate: number;       // 18%
      appliesTo: ChargeType[]; // [BROKERAGE, SEBI, EXCHANGE , IPFT]
    };
}

export interface ChargeCalculationResult {
    order_id: number;
    total_charges: number;
    applied_charges: any[];
}

