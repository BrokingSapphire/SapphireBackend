// import { Pool } from 'pg';
// import { Kysely, PostgresDialect } from 'kysely';
// import dotenv from 'dotenv';
// import type { DB } from './db.d';

// dotenv.config();

// // For debugging
// console.log('Database Config:', {
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   database: process.env.DB_NAME,
//   user: process.env.DB_USER,
//   // Don't log the actual password in production
//   passwordExists: !!process.env.DB_PASSWORD
// });

// // Add this right before creating the dialect
// const password = process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD) : 'sapphire';
// console.log('Using password type:', typeof password);
// console.log('Password is empty string:', password === '');
// console.log('Password length:', password.length);

// const dialect = new PostgresDialect({
//   pool: new Pool({
//     host: process.env.DB_HOST || 'localhost',
//     port: Number(process.env.DB_PORT) || 5432,
//     database: process.env.DB_NAME || 'qrtest',
//     user: process.env.DB_USER || 'postgres',
//     password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : 'sapphire',
//     max: 10
//   })
// });

// export const db = new Kysely<DB>({
//   dialect,
// });

// // Test the connection
// db.selectFrom('user_funds')
//   .select('id')
//   .limit(1)
//   .execute()
//   .then(() => {
//     console.log('Database connection successful!');
//   })
//   .catch((error) => {
//     console.error('Database connection failed:', error);
//   }); 







import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import dotenv from 'dotenv';
import type { DB } from './db.d';

dotenv.config();

// Create pool with proper password handling
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'qrtest',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'sapphire', // Ensure password is string
  max: 10
});

// Test direct pool connection first
pool.connect()
  .then(() => {
    console.log('PostgreSQL connection pool established successfully');
  })
  .catch((err) => {
    console.error('Error establishing PostgreSQL connection:', err.message);
  });

const dialect = new PostgresDialect({ pool });

export const db = new Kysely<DB>({
  dialect,
});

// Test the Kysely connection
db.selectFrom('user_funds')
  .select('id')
  .limit(1)
  .execute()
  .then(() => {
    console.log('Kysely database connection successful!');
  })
  .catch((error) => {
    console.error('Kysely database connection failed:', error);
  });