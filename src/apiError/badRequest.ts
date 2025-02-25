import { BAD_REQUEST } from '@app/utils/httpstatus';
import { APIError } from './base';

export class BadRequestError extends APIError {
    constructor(message = 'Bad Request') {
        super(BAD_REQUEST, message);
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}
