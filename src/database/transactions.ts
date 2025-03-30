import { Kysely, UpdateQueryBuilder, UpdateResult } from 'kysely';
import { DB } from './db';
import { UpdateObjectExpression } from 'kysely/dist/cjs/parser/update-set-parser';
import countries from '@app/services/i18n-countries';

interface Address {
    address1: string;
    address2: string | null;
    streetName: string | null;
    city: string;
    state: string;
    country: string;
    postalCode: string;
}

interface Name {
    firstName: string;
    middleName: string | null;
    lastName: string | null;
}

const insertNameGetId = async <T extends Kysely<DB>>(tx: T, name: Name): Promise<number> => {
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
};

const insertAddresGetId = async <T extends Kysely<DB>>(tx: T, address: Address): Promise<number> => {
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
            address1: address.address1,
            address2: address.address2,
            street_name: address.streetName,
            city_id: cityId.id,
            state_id: stateId.id,
            country_id: iso,
            postal_id: postalId.id,
        })
        .onConflict((oc) =>
            oc.constraint('uq_address').doUpdateSet((eb) => ({
                address1: eb.ref('excluded.address1'),
            })),
        )
        .returning('id')
        .executeTakeFirstOrThrow();

    return addressId.id;
};

const updateCheckpoint = <T extends Kysely<DB>>(
    tx: T,
    email: string,
    phone: string,
    update: UpdateObjectExpression<DB, 'signup_checkpoints', 'signup_checkpoints'>,
): UpdateQueryBuilder<DB, 'signup_checkpoints', 'signup_checkpoints', UpdateResult> => {
    return tx
        .updateTable('signup_checkpoints')
        .set(update)
        .where('email', '=', email)
        .where(({ eb, selectFrom }) =>
            eb('phone_id', '=', selectFrom('phone_number').select('phone_number.id').where('phone', '=', phone)),
        );
};

export { Address, Name, insertAddresGetId, insertNameGetId, updateCheckpoint };
