import axios, { AxiosResponse } from 'axios';
import SurepassApi from './surepass-api';
import { ESignInitializeRequest, ESignInitializeResponse, ESignStatusResponse, ESignDownloadResponse } from './types';
import { BlobLike, FormData } from 'formdata-node';

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
            method: 'POST',
            data: {
                client_id: clientId,
            },
        });

        if (!resp.data.data.link_generated) {
            throw new Error('File upload link not generated');
        }

        const fields = resp.data.data.fields;
        const formData = new FormData();
        formData.append('x-amz-signature', fields['x-amz-signature']);
        formData.append('x-amz-date', fields['x-amz-date']);
        formData.append('x-amz-credential', fields['x-amz-credential']);
        formData.append('x-amz-algorithm', fields['x-amz-algorithm']);
        formData.append('key', fields.key);
        formData.append('policy', fields.policy);
        formData.append('file', file);
        await axios({
            method: 'POST',
            url: resp.data.data.url,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            data: formData,
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
