import { CONFLICT } from '@app/utils/httpstatus';
import { APIError } from './base';

export class ConflictError extends APIError {
    constructor(message = 'Conflict') {
        super(CONFLICT, message);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}
