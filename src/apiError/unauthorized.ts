import { UNAUTHORIZED } from '@app/utils/httpstatus';
import { APIError } from './base';

export class UnauthorizedError extends APIError {
    constructor(message = 'Unauthorized') {
        super(UNAUTHORIZED, message);
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}
