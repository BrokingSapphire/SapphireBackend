// db-helper.ts

import { Kysely, sql, RawBuilder } from 'kysely';
import type { DB } from '../database/db.d';
import { db as kysely } from '@app/database';

/**
 * Extended database interface with expression builders
 */
export interface ExtendedDB extends Kysely<DB> {
    eb: {
        add: (column: string, value: number) => RawBuilder<number>;
        subtract: (column: string, value: number) => RawBuilder<number>;
        multiply: (column: string, value: number) => RawBuilder<number>;
        divide: (column: string, value: number) => RawBuilder<number>;
    };
}

type ValueExpression = RawBuilder<number>;

/**
 * Create and return an extended database interface with common expression builders
 */
export function createExtendedDB(db: Kysely<DB>) {
    return Object.assign(db, {
        eb: {
            add: (column: string, value: number): ValueExpression => sql<number>`${sql.ref(column)} + ${value}`,
            subtract: (column: string, value: number): ValueExpression => sql<number>`${sql.ref(column)} - ${value}`,
            multiply: (column: string, value: number): ValueExpression => sql<number>`${sql.ref(column)} * ${value}`,
            divide: (column: string, value: number): ValueExpression => sql<number>`${sql.ref(column)} / ${value}`,
        },
    });
}

// Create and export an extended version with expression builders
export const db = createExtendedDB(kysely);
