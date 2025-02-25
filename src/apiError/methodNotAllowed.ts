import { METHOD_NOT_ALLOWED } from '@app/utils/httpstatus';
import { APIError } from './base';

export class MethodNotAllowedError extends APIError {
    constructor(message = 'Method Not Allowed') {
        super(METHOD_NOT_ALLOWED, message);
        Object.setPrototypeOf(this, MethodNotAllowedError.prototype);
    }
}
