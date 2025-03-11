import { AxiosResponse } from 'axios';
import SurepassApi from './surepass-api';

const URI: string = 'pan';

class PanService extends SurepassApi {
    constructor() {
        super(URI);
    }

    getDetails<T = any, R = AxiosResponse<T>>(panId: string): Promise<R> {
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
