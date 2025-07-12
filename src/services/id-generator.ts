import { RawBuilder, sql } from 'kysely';
import { db } from '@app/database';

const ID_TYPES = ['user_id', 'transaction_ref'] as const;

export type IdSequences = (typeof ID_TYPES)[number];

type SequenceParams = {
    user_id: never;
    transaction_ref: {
        mode: 'DP' | 'WD';
    };
};

// Conditional type to make params optional for sequences that don't need them
type NextValueParams<T extends IdSequences> = SequenceParams[T] extends never ? [] : [params: SequenceParams[T]];

export default class IdGenerator<T extends IdSequences> {
    constructor(private readonly sequence: T) {}

    async nextValue(...args: NextValueParams<T>): Promise<string> {
        return this.executeSequenceQuery('generate_next', args[0]);
    }

    async peekValue(...args: NextValueParams<T>): Promise<string> {
        return this.executeSequenceQuery('peek_next', args[0]);
    }

    private async executeSequenceQuery(
        operation: 'generate_next' | 'peek_next',
        params: SequenceParams[T] | undefined,
    ): Promise<string> {
        const sqlParams = this.buildSqlParams(params);

        const query =
            sqlParams.length > 0
                ? sql<{
                      id: string;
                  }>`SELECT ${sql.raw(operation)}_${sql.raw(this.sequence)}(${sql.join(sqlParams)}) AS id;`
                : sql<{ id: string }>`SELECT ${sql.raw(operation)}_${sql.raw(this.sequence)}() AS id;`;

        const id = await query.execute(db);
        return id.rows[0].id;
    }

    private buildSqlParams(params: SequenceParams[T] | undefined): RawBuilder<any>[] {
        if (!params) {
            return [];
        }

        // Convert params object to array of SQL values based on sequence type
        return Object.values(params).map((value) => sql.lit(value));
    }
}
