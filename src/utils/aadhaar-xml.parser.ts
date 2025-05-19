import { Address } from '@app/database/transactions';
import { XMLParser } from 'fast-xml-parser';
import logger from '@app/logger';

export const AADHAAR_REGEX: RegExp = /^[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}$/;

class AadhaarXMLParser {
    private readonly data: string;
    private loadedData: any;

    constructor(data: string) {
        this.data = data;
    }

    load() {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '__',
        });
        this.loadedData = parser.parse(this.data);
    }

    uid(): string {
        return this.loadedData.Certificate.CertificateData.KycRes.UidData.__uid;
    }

    name(): string {
        return this.loadedData.Certificate.CertificateData.KycRes.UidData.Poi.__name;
    }

    gender(): string {
        return this.loadedData.Certificate.CertificateData.KycRes.UidData.Poi.__gender;
    }

    dob(): Date | null {
        const dob = this.loadedData.Certificate.CertificateData.KycRes.UidData.Poi.__dob;
        if (dob == null) {
            return null;
        }

        const [day, month, year] = dob.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    co(): string {
        return this.loadedData.Certificate.CertificateData.KycRes.UidData.Poa.__co;
    }

    address(): Address {
        const poa = this.loadedData.Certificate.CertificateData.KycRes.UidData.Poa;
        return {
            address1: poa.__house,
            address2: poa.__lm + ', ' + poa.__dist,
            streetName: poa.__street,
            city: poa.__vtc,
            state: poa.__state,
            country: poa.__country,
            postalCode: poa.__pc,
        };
    }

    postOffice(): string {
        return this.loadedData.Certificate.CertificateData.KycRes.UidData.Poa.__po;
    }

    log() {
        logger.info(
            JSON.stringify({
                uid: this.uid(),
                name: this.name(),
                gender: this.gender(),
                dob: this.dob(),
                co: this.co(),
                address: this.address(),
                postOffice: this.postOffice(),
            }),
        );
    }
}

export default AadhaarXMLParser;
