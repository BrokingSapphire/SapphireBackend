import { NOT_FOUND } from '@app/utils/httpstatus';
import { APIError } from './base';

export class NotFoundError extends APIError {
    constructor(message = 'Not Found') {
        super(NOT_FOUND, message);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
