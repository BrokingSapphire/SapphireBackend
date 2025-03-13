import { AxiosResponse } from 'axios';
import SurepassApi from './surepass-api';
import { BankVerificationDetails } from './types';

const URI: string = 'bank-verification';

class BankVerification extends SurepassApi {
    constructor() {
        super(URI);
    }

    verification<T = any, R = AxiosResponse<T>>(data: BankVerificationDetails): Promise<R> {
        return this.request({
            method: 'POST',
            data,
        });
    }
}

class ReversePenyDrop extends SurepassApi {
    constructor() {
        super(`${URI}/reverse-penny-drop`);
    }

    initialize<T = any, R = AxiosResponse<T>>(): Promise<R> {
        return this.request({
            url: 'initialize',
            method: 'POST',
            data: {},
        });
    }

    status<T = any, R = AxiosResponse<T>>(clientId: string): Promise<R> {
        return this.request({
            url: `status`,
            method: 'POST',
            data: {
                client_id: clientId,
            },
        });
    }
}

export { BankVerification, ReversePenyDrop };
