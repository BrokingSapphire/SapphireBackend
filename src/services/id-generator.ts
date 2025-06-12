import { sql } from 'kysely';
import { db } from '@app/database';

const ID_TYPES = ['user_id'] as const;

export type IdSequences = (typeof ID_TYPES)[number];

export default class IdGenerator {
    constructor(private readonly sequence: IdSequences) {}

    async nextValue(): Promise<string> {
        const id = await sql<{ id: string }>`SELECT generate_next_${sql.raw(this.sequence)}() AS id;`.execute(db);

        return id.rows[0].id;
    }

    async peekValue(): Promise<string> {
        const id = await sql<{ id: string }>`SELECT peek_next_${sql.raw(this.sequence)}() AS id;`.execute(db);

        return id.rows[0].id;
    }
}
