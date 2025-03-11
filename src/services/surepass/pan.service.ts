import { AxiosResponse } from 'axios';
import SurepassApi from './surepass-api';

const URI: string = 'pan';

const PAN_REGEX: RegExp = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

class PanService extends SurepassApi {
    constructor() {
        super(URI);
    }

    getDetails<T = any, R = AxiosResponse<T>>(panId: string): Promise<R> {
        if (!PAN_REGEX.test(panId)) {
            return Promise.reject({
                error: {
                    message: 'Invalid PAN number',
                    code: 'INVALID_PAN',
                    type: 'validation',
                    info: 'Please enter a valid PAN number',
                },
            });
        }

        return this.request({
            url: 'pan-comprehensive',
            method: 'POST',
            data: {
                id_number: panId,
            },
        });
    }
}

export default PanService;
