import { DB } from '@/database/db.d'; // this is the Database interface we defined earlier
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { env } from '@/env';

const dialect = new PostgresDialect({
    pool: new Pool({
        database: env.db.name,
        host: env.db.host,
        user: env.db.user,
        port: env.db.port,
        max: 10,
    }),
});

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<DB>({
    dialect,
});
