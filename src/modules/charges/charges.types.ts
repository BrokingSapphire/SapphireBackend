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