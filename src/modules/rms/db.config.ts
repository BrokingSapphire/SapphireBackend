// config/db.config.ts
import { Kysely, PostgresDialect, Generated } from 'kysely';
import pg from 'pg';

// Define database interfaces for table schemas
export interface Tables {
    trading_rules: {
        id: Generated<number>; // Use Generated to mark as auto-generated
        trade_segment: string;
        margin_percentage: number;
        max_leverage: number;
        is_active: boolean;
        created_at: Date;
        updated_at: Date | null;
    };

    user_margin: {
        id: Generated<number>;
        user_id: number;
        cash_margin: number;
        pledge_margin: number;
        total_margin: number;
        available_margin: number;
        used_margin: number;
        blocked_margin: number | null;
        negative_cash_limit: number | null;
        is_negative_cash_allowed: boolean | null;
        created_at: Date;
        updated_at: Date | null;
    };

    user_funds: {
        id: Generated<number>;
        user_id: number;
        total_funds: number;
        available_funds: number;
        used_funds: number;
        created_at: Date;
        updated_at: Date | null;
    };

    trading_orders: {
        id: Generated<number>;
        user_id: number;
        trade_type: string;
        order_side: string;
        order_type: string;
        symbol: string;
        quantity: number;
        price: number | null;
        trigger_price: number | null;
        status: string;
        margin_used: number;
        margin_source: string;
        order_date: Date;
        execution_date: Date | null;
        remarks: string | null;
        created_at: Date;
        updated_at: Date | null;
    };

    trading_positions: {
        id: Generated<number>;
        user_id: number;
        trade_type: string;
        order_side: string;
        symbol: string;
        quantity: number;
        entry_price: number;
        current_price: number;
        margin_used: number;
        margin_source: string;
        mtm_profit: number;
        mtm_loss: number;
        created_at: Date;
        updated_at: Date | null;
    };

    user_collateral: {
        id: Generated<number>;
        user_id: number;
        security_id: string;
        security_name: string;
        quantity: number;
        value: number;
        haircut_percentage: number;
        margin_value: number;
        status: string;
        created_at: Date;
        updated_at: Date | null;
    };

    margin_transactions: {
        id: Generated<number>;
        user_id: number;
        transaction_type: string;
        amount: number;
        reason: string;
        created_at: Date;
    };
}

// Database type using the Tables interface
export type Database = {
    [K in keyof Tables]: Tables[K];
};

// Database connection
const db = new Kysely<Database>({
    dialect: new PostgresDialect({
        pool: new pg.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'trading_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
        }),
    }),
});

export default db;
