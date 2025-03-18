import { DB } from '@app/database/db.d'; // this is the Database interface we defined earlier
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { env } from '@app/env';

const dialect = new PostgresDialect({
    pool: new Pool({
        database: env.db.name,
        host: env.db.host,
        user: env.db.user,
        port: Number(env.db.port),
        password: env.db.password,
        max: 10,
    }),
    // pool: new Pool({ connectionString: `postgres://${env.db.user}:${env.db.password}@${env.db.host}:${env.db.port}/${env.db.name}` }),
});

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<DB>({
    dialect,
});
