import { InternalServerError } from '@app/apiError';
import bcrypt from 'bcrypt';

interface PasswordDetails {
    hashedPassword: string;
    salt: string;
    hashAlgo: string;
}

type HashAlgo = 'bcrypt';

const SALT_ROUNDS = 10;

export async function verifyPassword(password: string, passwordDetails: PasswordDetails): Promise<boolean> {
    switch (passwordDetails.hashAlgo) {
        case 'bcrypt':
            return await bcrypt.compare(password, passwordDetails.hashedPassword);
        default:
            throw new InternalServerError('Unsupported password hashing algorithm');
    }
}

export async function hashPassword(password: string, hashAlgo?: HashAlgo, salt?: string): Promise<PasswordDetails> {
    hashAlgo = hashAlgo || 'bcrypt';

    let hashedPassword: string;
    switch (hashAlgo) {
        case 'bcrypt':
            salt = salt || (await bcrypt.genSalt(SALT_ROUNDS));
            hashedPassword = await bcrypt.hash(password, salt);
            break;
        default:
            throw new InternalServerError('Unsupported password hashing algorithm');
    }

    return {
        hashedPassword,
        salt,
        hashAlgo,
    };
}
