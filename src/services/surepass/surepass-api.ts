import { env } from '@app/env';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const BASE_URL: string = 'https://kyc-api.surepass.io/api/v1';

abstract class SurepassApi {
    protected readonly axiosInstance: AxiosInstance;
    private readonly apiKey: string;

    protected constructor(subPath: string) {
        this.apiKey = env.surepass.apiKey;
        this.axiosInstance = axios.create({
            baseURL: `${BASE_URL}/${subPath}`,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
        });
    }

    protected request<T = any, R = AxiosResponse<T>, D = any>(config: AxiosRequestConfig<D>): Promise<R> {
        return this.axiosInstance(config);
    }
}

export default SurepassApi;
