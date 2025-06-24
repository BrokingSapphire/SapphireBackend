import { db } from '@app/database';

export default class AOFService {
    async generateNextAOFNumber(): Promise<string> {
        // format: AOF-YYYY-XXXXX
        const currentYear = new Date().getFullYear();

        // count existing AOFs Present
        const count = await db
            .selectFrom('account_openform')
            .select(db.fn.count('id').as('count'))
            .where('aof_number', 'like', `AOF-${currentYear}-%`)
            .executeTakeFirst();

        const nextSequence = Number(count?.count || 0) + 1;
        const aofNumber = `AOF-${currentYear}-${nextSequence.toString().padStart(5, '0')}`;

        await db
            .insertInto('account_openform')
            .values({
                aof_number: aofNumber,
            })
            .execute();

        return aofNumber;
    }
}
