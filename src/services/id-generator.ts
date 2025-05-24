import { sql } from 'kysely';
import { db } from '@app/database';

const PREFIXES = {
    user_id: 'CLI',
} as const;

export type IdSequences = keyof typeof PREFIXES;

export default class IdGenerator {
    constructor(private readonly sequence: IdSequences) {}

    async nextValue(): Promise<string> {
        const seq = `${this.sequence}_seq`;
        const id = await sql<number>`SELECT NEXTVAL('${sql.raw(seq)}');`.execute(db);

        return this.modifyId(id.rows[0]);
    }

    private modifyId(id: number): string {
        let modified: string = '';
        switch (this.sequence) {
            case 'user_id':
                modified = id.toString().padStart(7, '0');
                break;
        }
        return PREFIXES[this.sequence] + modified;
    }
}
