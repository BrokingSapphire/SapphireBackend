/**
 * migrations/watchlist-tables.ts
 * Migration script to create watchlist tables
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create user_watchlist table as a separate table linked to users
  await db.schema
    .createTable('user_watchlist')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .execute();

  // Create watchlist table that references user_watchlist
  await db.schema
    .createTable('watchlist')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_watchlist_id', 'integer', (col) =>
      col.notNull().references('user_watchlist.id').onDelete('cascade')
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('is_default', 'boolean', (col) =>
      col.notNull().defaultTo(false)
    )
    .addColumn('created_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Create watchlist_item table
  await db.schema
    .createTable('watchlist_item')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('watchlist_id', 'integer', (col) =>
      col.notNull().references('watchlist.id').onDelete('cascade')
    )
    .addColumn('symbol', 'varchar(20)', (col) => col.notNull())
    .addColumn('added_at', 'timestamp', (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute();

  // Add indexes
  await db.schema
    .createIndex('user_watchlist_user_id_idx')
    .on('user_watchlist')
    .column('user_id')
    .unique()  // A user should only have one user_watchlist entry
    .execute();

  await db.schema
    .createIndex('watchlist_user_watchlist_id_idx')
    .on('watchlist')
    .column('user_watchlist_id')
    .execute();

  await db.schema
    .createIndex('watchlist_item_watchlist_id_idx')
    .on('watchlist_item')
    .column('watchlist_id')
    .execute();

  // Create a unique index to prevent duplicate symbols in the same watchlist
  await db.schema
    .createIndex('watchlist_item_unique_symbol')
    .on('watchlist_item')
    .columns(['watchlist_id', 'symbol'])
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order
  await db.schema.dropTable('watchlist_item').execute();
  await db.schema.dropTable('watchlist').execute();
  await db.schema.dropTable('user_watchlist').execute();
}