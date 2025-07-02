import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const BASE_URL: string = 'https://ifsc.razorpay.com';

interface IFSCResponse {
    BRANCH: string;
    CENTRE: string;
    DISTRICT: string;
    STATE: string;
    ADDRESS: string;
    CONTACT: string | null;
    IMPS: boolean;
    CITY: string;
    UPI: boolean;
    MICR: string | null;
    RTGS: boolean;
    NEFT: boolean;
    SWIFT: string | null;
    ISO3166: string;
    BANK: string;
    BANKCODE: string;
    IFSC: string;
}

// Base API class for Razorpay services
abstract class RazorpayApi {
    protected readonly axiosInstance: AxiosInstance;

    protected constructor(subPath: string = '') {
        this.axiosInstance = axios.create({
            baseURL: subPath ? `${BASE_URL}/${subPath}` : BASE_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    protected request<T = any, R = AxiosResponse<T>, D = any>(config: AxiosRequestConfig<D>): Promise<R> {
        return this.axiosInstance(config);
    }
}

// IFSC Service class
class IFSCService extends RazorpayApi {
    constructor() {
        super();
    }

    lookup<T = IFSCResponse, R = AxiosResponse<T>>(ifscCode: string): Promise<R> {
        return this.request({
            url: `/${ifscCode}`,
            method: 'GET',
        });
    }

    getDetails<T = IFSCResponse, R = AxiosResponse<T>>(ifscCode: string): Promise<R> {
        return this.lookup(ifscCode);
    }
}

export { IFSCService };
export type { IFSCResponse };
