import { UNSUPPORTED_MEDIA_TYPE } from '@app/utils/httpstatus';
import { APIError } from './base';

export class UnsupportedMediaTypeError extends APIError {
    constructor(message = 'Unsupported Media Type') {
        super(UNSUPPORTED_MEDIA_TYPE, message);
        Object.setPrototypeOf(this, UnsupportedMediaTypeError.prototype);
    }
}
