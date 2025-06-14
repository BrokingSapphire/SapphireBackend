import { Kysely } from 'kysely';
import { DB } from '@app/database/db';

// Generating 12 digit number
const generateOrderId = async (db: Kysely<DB>): Promise<string> => {
    // Format :  YYMMDD + 6 digit seq. Num.
    const now = new Date();
    const datePart =
        now.getFullYear().toString().slice(2) +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');

    // last seq number from the db
    const latestSequence = await db
        .selectFrom('order_sequences')
        .where('date_prefix', '=', datePart)
        .select('sequence_number')
        .orderBy('sequence_number', 'desc')
        .limit(1)
        .forUpdate()
        .executeTakeFirst();

    // Calculate next sequence number
    const nextSequence = latestSequence ? latestSequence.sequence_number + 1 : 1;

    // Insert or update the sequence record
    await db
        .insertInto('order_sequences')
        .values({
            date_prefix: datePart,
            sequence_number: nextSequence,
            updated_at: now,
        })
        .onConflict((oc) =>
            oc.constraint('uq_order_sequences_date_prefix').doUpdateSet({
                sequence_number: nextSequence,
                updated_at: now,
            }),
        )
        .execute();

    // Create the full order ID (YYMMDD + 6-digit sequence padded with zeros)
    const sequencePart = nextSequence.toString().padStart(6, '0');
    return datePart + sequencePart;
};
export default generateOrderId;
