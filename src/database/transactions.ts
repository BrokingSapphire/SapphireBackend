import { Transaction, UpdateQueryBuilder, UpdateResult } from 'kysely';
import { DB } from './db';
import countries from 'i18n-iso-countries';
import { UpdateObjectExpression } from 'kysely/dist/cjs/parser/update-set-parser';

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

const insertNameGetId = async (tx: Transaction<DB>, name: Name): Promise<number> => {
    const nameId = await tx
        .insertInto('user_name')
        .values({
            first_name: name.firstName,
            middle_name: name.middleName,
            last_name: name.lastName,
        })
        .onConflict((oc) => oc.constraint('uq_user_name').doNothing())
        .returning('id')
        .executeTakeFirstOrThrow();

    return nameId.id;
};

const insertAddresGetId = async (tx: Transaction<DB>, address: Address): Promise<number> => {
    const countryIso = await tx
        .insertInto('country')
        .values({
            iso: countries.alpha2ToNumeric(countries.getAlpha2Code(address.country, 'en') as string) as string,
            name: address.country,
        })
        .onConflict((oc) => oc.constraint('pk_country_iso').doNothing())
        .returning('iso')
        .executeTakeFirstOrThrow();

    const stateId = await tx
        .insertInto('state')
        .values({
            name: address.state,
            country_id: countryIso.iso,
        })
        .onConflict((oc) => oc.constraint('uq_state_country').doNothing())
        .returning('id')
        .executeTakeFirstOrThrow();

    const cityId = await tx
        .insertInto('city')
        .values({
            name: address.city,
            state_id: stateId.id,
        })
        .onConflict((oc) => oc.constraint('uq_city_state').doNothing())
        .returning('id')
        .executeTakeFirstOrThrow();

    const postalId = await tx
        .insertInto('postal_code')
        .values({
            postal_code: address.postalCode,
            country_id: countryIso.iso,
        })
        .onConflict((oc) => oc.constraint('uq_postal_country').doNothing())
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
            country_id: countryIso.iso,
            postal_id: postalId.id,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

    return addressId.id;
};

const updateCheckpoint = (
    tx: Transaction<DB>,
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
