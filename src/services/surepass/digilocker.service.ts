import { AxiosResponse } from 'axios';
import SurepassApi from './surepass-api';
import { DigiLockerInitializeRequest } from './types';

const URI: string = 'digilocker';

class DigiLockerService extends SurepassApi {
    constructor() {
        super(URI);
    }

    initialize<T = any, R = AxiosResponse<T>>(data: DigiLockerInitializeRequest): Promise<R> {
        return this.request({
            url: 'initialize',
            method: 'POST',
            data: {
                data,
            },
        });
    }

    getStatus<T = any, R = AxiosResponse<T>>(clientId: string): Promise<R> {
        return this.request({
            url: `status/${clientId}`,
            method: 'GET',
        });
    }

    listDocuments<T = any, R = AxiosResponse<T>>(clientId: string): Promise<R> {
        return this.request({
            url: `list-documents/${clientId}`,
            method: 'GET',
        });
    }

    downloadDocument<T = any, R = AxiosResponse<T>>(clientId: string, fileId: string): Promise<R> {
        return this.request({
            url: `download-document/${clientId}/${fileId}`,
            method: 'GET',
        });
    }
}

export default DigiLockerService;
