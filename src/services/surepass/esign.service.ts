// esign.service.ts
import { AxiosResponse } from 'axios';
import SurepassApi from './surepass-api';
import { ESignInitializeRequest, ESignInitializeResponse, ESignStatusResponse, ESignDownloadResponse } from './types';

const URI: string = 'esign';

class ESignService extends SurepassApi {
    constructor() {
        super(URI);
    }

    initialize<T = ESignInitializeResponse, R = AxiosResponse<T>>(data: ESignInitializeRequest): Promise<R> {
        return this.request({
            url: 'initialize',
            method: 'POST',
            data,
        });
    }

    getStatus<T = ESignStatusResponse, R = AxiosResponse<T>>(clientId: string): Promise<R> {
        return this.request({
            url: `status/${clientId}`,
            method: 'GET',
        });
    }

    downloadSignedDocument<T = ESignDownloadResponse, R = AxiosResponse<T>>(clientId: string): Promise<R> {
        return this.request({
            url: `download/${clientId}`,
            method: 'GET',
        });
    }
}

export default new ESignService();
