import { Kysely, UpdateQueryBuilder, UpdateResult } from 'kysely';
import { DB } from './db';
import { UpdateObjectExpression } from 'kysely/dist/cjs/parser/update-set-parser';
import countries from '@app/services/i18n-countries';

export interface AddressInput {
    line_1: string | null;
    line_2: string | null;
    line_3: string | null;
    city: string;
    state: string;
    country: string;
    postalCode: string;
}

export interface Name {
    firstName: string;
    middleName: string | null;
    lastName: string | null;
}

export interface HashedCredential {
    hashedPassword: string;
    salt: string;
    hashAlgo: string;
}

export async function insertNameGetId<T extends Kysely<DB>>(tx: T, name: Name): Promise<number>;

export async function insertNameGetId<T extends Kysely<DB>>(tx: T, name: Name[]): Promise<number[]>;

export async function insertNameGetId<T extends Kysely<DB>>(tx: T, name: Name | Name[]): Promise<number | number[]> {
    if (Array.isArray(name)) {
        if (name.length === 0) return [];

        const ids = await tx
            .insertInto('user_name')
            .values(
                name.map((it) => ({
                    first_name: it.firstName,
                    middle_name: it.middleName,
                    last_name: it.lastName,
                })),
            )
            .onConflict((oc) =>
                oc.constraint('uq_user_name').doUpdateSet((eb) => ({
                    first_name: eb.ref('excluded.first_name'),
                    middle_name: eb.ref('excluded.middle_name'),
                    last_name: eb.ref('excluded.last_name'),
                })),
            )
            .returning('id')
            .execute();

        return ids.map((item) => item.id);
    } else {
        const nameId = await tx
            .insertInto('user_name')
            .values({
                first_name: name.firstName,
                middle_name: name.middleName,
                last_name: name.lastName,
            })
            .onConflict((oc) =>
                oc.constraint('uq_user_name').doUpdateSet((eb) => ({
                    first_name: eb.ref('excluded.first_name'),
                    middle_name: eb.ref('excluded.middle_name'),
                    last_name: eb.ref('excluded.last_name'),
                })),
            )
            .returning('id')
            .executeTakeFirstOrThrow();

        return nameId.id;
    }
}

export async function insertAddressGetId<T extends Kysely<DB>>(tx: T, address: AddressInput): Promise<number> {
    const iso = countries.alpha2ToNumeric(countries.getAlpha2Code(address.country, 'en')!!)!!;
    await tx
        .insertInto('country')
        .values({
            iso,
            name: address.country,
        })
        .onConflict((oc) => oc.constraint('pk_country_iso').doNothing())
        .execute();

    const stateId = await tx
        .insertInto('state')
        .values({
            name: address.state,
            country_id: iso,
        })
        .onConflict((oc) =>
            oc.constraint('uq_state_country').doUpdateSet((eb) => ({
                name: eb.ref('excluded.name'),
            })),
        )
        .returning('id')
        .executeTakeFirstOrThrow();

    const cityId = await tx
        .insertInto('city')
        .values({
            name: address.city,
            state_id: stateId.id,
        })
        .onConflict((oc) =>
            oc.constraint('uq_city_state').doUpdateSet((eb) => ({
                name: eb.ref('excluded.name'),
            })),
        )
        .returning('id')
        .executeTakeFirstOrThrow();

    const postalId = await tx
        .insertInto('postal_code')
        .values({
            postal_code: address.postalCode,
            country_id: iso,
        })
        .onConflict((oc) =>
            oc.constraint('uq_postal_country').doUpdateSet((eb) => ({
                postal_code: eb.ref('excluded.postal_code'),
            })),
        )
        .returning('id')
        .executeTakeFirstOrThrow();

    const addressId = await tx
        .insertInto('address')
        .values({
            line_1: address.line_1,
            line_2: address.line_2,
            line_3: address.line_3,
            city_id: cityId.id,
            state_id: stateId.id,
            country_id: iso,
            postal_id: postalId.id,
            address_type: 'Residential',
        })
        .onConflict((oc) =>
            oc.constraint('uq_address').doUpdateSet((eb) => ({
                line_1: eb.ref('excluded.line_1'),
            })),
        )
        .returning('id')
        .executeTakeFirstOrThrow();

    return addressId.id;
}

export function updateCheckpoint<T extends Kysely<DB>>(
    tx: T,
    email: string,
    phone: string,
    update: UpdateObjectExpression<DB, 'signup_checkpoints', 'signup_checkpoints'>,
): UpdateQueryBuilder<DB, 'signup_checkpoints', 'signup_checkpoints', UpdateResult> {
    return tx
        .updateTable('signup_checkpoints')
        .set(update)
        .where('email', '=', email)
        .where(({ eb, selectFrom }) =>
            eb('phone_id', '=', selectFrom('phone_number').select('phone_number.id').where('phone', '=', phone)),
        );
}

async function getOrCreateHashAlgorithm<T extends Kysely<DB>>(tx: T, hashAlgo: string): Promise<number> {
    const existingHashAlgo = await tx
        .selectFrom('hashing_algorithm')
        .select('id')
        .where('name', '=', hashAlgo)
        .executeTakeFirst();

    if (existingHashAlgo) {
        return existingHashAlgo.id;
    }

    const insertedHashAlgo = await tx
        .insertInto('hashing_algorithm')
        .values({ name: hashAlgo })
        .returning('id')
        .executeTakeFirst();

    if (!insertedHashAlgo) {
        throw new Error('Failed to insert hashing algorithm');
    }

    return insertedHashAlgo.id;
}

export async function insertCredentialDetails<T extends Kysely<DB>>(
    tx: T,
    userId: string,
    hashedCredential: HashedCredential,
    credentialType: 'password' | 'mpin',
): Promise<void> {
    const hashAlgoId = await getOrCreateHashAlgorithm(tx, hashedCredential.hashAlgo);

    if (credentialType === 'password') {
        await tx
            .insertInto('user_password_details')
            .values({
                user_id: userId,
                password_hash: hashedCredential.hashedPassword,
                password_salt: hashedCredential.salt,
                hash_algo_id: hashAlgoId,
            })
            .onConflict((oc) =>
                oc.column('user_id').doUpdateSet({
                    password_hash: hashedCredential.hashedPassword,
                    password_salt: hashedCredential.salt,
                    hash_algo_id: hashAlgoId,
                }),
            )
            .execute();
    } else {
        await tx
            .insertInto('user_mpin')
            .values({
                client_id: userId,
                mpin_hash: hashedCredential.hashedPassword,
                mpin_salt: hashedCredential.salt,
                hash_algo_id: hashAlgoId,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true,
                failed_attempts: 0,
            })
            .onConflict((oc) =>
                oc.column('client_id').doUpdateSet({
                    mpin_hash: hashedCredential.hashedPassword,
                    mpin_salt: hashedCredential.salt,
                    hash_algo_id: hashAlgoId,
                    failed_attempts: 0,
                    last_failed_attempt: null,
                    is_active: true,
                    updated_at: new Date(),
                }),
            )
            .execute();
    }
}
