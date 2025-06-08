import { DB } from '@app/database/db.d'; // this is the Database interface we defined earlier
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { env } from '@app/env';
import logger from '@app/logger';

const dialect = new PostgresDialect({
    pool: new Pool({ connectionString: env.database }),
});

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<DB>({
    dialect,
    log(event): void {
        if (env.env !== 'development') return;

        if (event.level === 'error') {
            logger.error(`Query: ${event.query.sql}`);
            logger.error(`Parameters: ${event.query.parameters}`);
            logger.error('Database error:', event.error);
        } else if (event.level === 'query') {
            logger.info(`Query: ${event.query.sql}`);
            logger.info(`Parameters: ${event.query.parameters}`);
            logger.info(`Duration: ${event.queryDurationMillis}ms`);
        }
    },
});
