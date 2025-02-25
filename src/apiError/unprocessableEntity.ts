import { UNPROCESSABLE_ENTITY } from '@app/utils/httpstatus';
import { APIError } from './base';

export class UnprocessableEntityError extends APIError {
    constructor(message = 'Unprocessable Entity') {
        super(UNPROCESSABLE_ENTITY, message);
        Object.setPrototypeOf(this, UnprocessableEntityError.prototype);
    }
}
