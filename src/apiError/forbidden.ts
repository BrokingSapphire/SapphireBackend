import { FORBIDDEN } from '@app/utils/httpstatus';
import { APIError } from './base';

export class ForbiddenError extends APIError {
    constructor(message = 'Forbidden') {
        super(FORBIDDEN, message);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}
