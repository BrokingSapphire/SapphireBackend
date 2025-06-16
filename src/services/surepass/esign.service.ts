import axios, { AxiosResponse } from 'axios';
import SurepassApi from './surepass-api';
import { ESignInitializeRequest, ESignInitializeResponse, ESignStatusResponse, ESignDownloadResponse } from './types';
import { BlobLike } from 'formdata-node';

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

    async uploadFile(clientId: string, file: BlobLike): Promise<void> {
        const resp = await this.request({
            url: `get-upload-link`,
            method: 'GET',
            data: {
                client_id: clientId,
            },
        });

        if (!resp.data.data.link_generated) {
            throw new Error('File upload link not generated');
        }

        const fields = resp.data.data.fields;
        await axios({
            method: 'POST',
            url: resp.data.data.url,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            data: {
                'x-amz-signature': fields['x-amz-signature'],
                'x-amz-date': fields['x-amz-date'],
                'x-amz-credential': fields['x-amz-credential'],
                'x-amz-algorithm': fields['x-amz-algorithm'],
                key: fields.key,
                policy: fields.policy,
                file,
            },
        });
    }

    uploadFileFromUrl<T = any, R = AxiosResponse<T>>(clientId: string, fileUrl: string): Promise<R> {
        return this.request({
            url: `upload-pdf`,
            method: 'POST',
            data: {
                client_id: clientId,
                link: fileUrl,
            },
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
