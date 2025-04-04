// src/config/db.config.ts
import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { Database } from './db.interface.js';

const { Pool } = pg;

// Configure database connection
const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'stockbroking',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 10,
    }),
  }),
});

export default db;