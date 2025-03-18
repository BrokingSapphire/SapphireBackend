import WebSocket from 'ws';

export interface Transaction {
    id: number;
    user_id: number;
    transaction_type: 'deposit' | 'withdrawal';
    amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    scheduled_processing_time: Date | null;
    remarks: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface Order {
    id: number;
    user_id: number;
    trade_type: string;
    total_value: number;
    settlement_id: number | null;
    updated_at: Date;
    created_at: Date;
}

export interface Settlement {
    id: number;
    order_id: number;
    user_id: number;
    trade_type: string;
    settlement_amount: number;
    status: 'scheduled' | 'processing' | 'completed' | 'failed';
    scheduled_settlement_time: Date;
    created_at: Date;
    updated_at?: Date;
}

export interface UserFunds {
    id: number;
    user_id: number;
    available_balance: number;
    locked_balance: number;
    total_balance: number;
    created_at: Date;
    updated_at: Date;
}

export interface SettlementDetail {
    id: number;
    transaction_id: number;
    settlement_status: string;
    settlement_date: Date;
    settlement_reference?: string;
    remarks?: string;
    created_at: Date;
    updated_at?: Date;
}

export interface TransactionWithSettlement extends Transaction {
    settlement_status?: string;
    settlement_date?: Date;
}

export interface ProcessingTimeInfo {
    nextProcessing: Date;
    windowDescription: string;
}

// Define the WebSocketClient interface to match the ws library
export interface WebSocketClient extends WebSocket {
    send: (data: string) => void;
}

// Define WebSocketManager interface based on your implementation
export interface WebSocketManager {
    getClient: (userId: string) => WebSocketClient | undefined;
    registerClient: (id: string, ws: WebSocket) => void;
    unregisterClient: (id: string, ws: WebSocket) => void;
    broadcastToId: (id: string, message: string) => void;
    broadcastToAll: (message: string) => void;
}

export interface SettlementWindow {
    start: string;
    end: string;
}

export interface ProcessingWindows {
    noon: SettlementWindow;
    evening: SettlementWindow;
}

export interface NextProcessingWindows {
    noon: SettlementWindow;
    evening: SettlementWindow;
}

export interface SettlementWindowResponse {
    success: boolean;
    data: {
        isWithinWindow: boolean;
        nextProcessing: ProcessingTimeInfo;
        currentTime: Date;
    };
}

export interface SettlementWindowsResponse {
    isWithinWindow: boolean;
    nextProcessing: ProcessingTimeInfo;
    currentTime: Date;
}

export interface ProcessingWindowsResponse {
    success: boolean;
    data: ProcessingWindows;
}

export interface TransactionResponse {
    success: boolean;
    data: TransactionWithSettlement | Transaction[] | null;
    message?: string;
    error?: string;
}

export interface SettlementResponse {
    success: boolean;
    data: Settlement[] | null;
    message?: string;
    error?: string;
}

export interface SettlementStatusResponse {
    id: number;
    status: string;
    scheduled_processing_time: Date | null;
    settlement_status: string | null;
    settlement_date: Date | null;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

// WebSocket message types
export interface SettlementWSMessage {
    type: string;
    data?: any;
    userId?: number;
    transactionId?: number;
    settlementId?: number;
}

// Database schema type definitions
export interface Database {
    users: {
        id: number;
        email: string;
        password: string;
        role: string;
        created_at: Date;
        updated_at: Date | null;
    };

    user_funds: UserFunds;

    trading_orders: {
        id: number;
        user_id: number;
        symbol: string;
        trade_type: string;
        order_type: string;
        price: number;
        quantity: number;
        status: string;
        total_value: number;
        settlement_id: number | null;
        created_at: Date;
        updated_at: Date | null;
    };

    trade_settlements: {
        id: number;
        order_id: number;
        user_id: number;
        trade_type: string;
        settlement_amount: number;
        status: string;
        scheduled_settlement_time: Date;
        created_at: Date;
        updated_at: Date | null;
    };

    fund_transactions: {
        id: number;
        user_id: number;
        transaction_type: string;
        amount: number;
        status: string;
        scheduled_processing_time: Date | null;
        remarks: string | null;
        created_at: Date;
        updated_at: Date | null;
    };

    settlement_details: {
        id: number;
        transaction_id: number;
        settlement_status: string;
        settlement_date: Date;
        settlement_reference: string | null;
        remarks: string | null;
        created_at: Date;
    };
}
