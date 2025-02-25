import { INTERNAL_SERVER_ERROR } from '@app/utils/httpstatus';
import { APIError } from './base';

export class InternalServerError extends APIError {
    constructor(message = 'Internal Server Error') {
        super(INTERNAL_SERVER_ERROR, message);
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}
