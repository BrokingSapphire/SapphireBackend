import crypto from 'crypto';

const PSWD_ITERATIONS = 65536;
const KEY_SIZE = 256;
const IV_BYTES = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

export function encrypt(plainText: string, key: string): string {
    const salt = Buffer.from(key, 'utf8');
    const derivedKey = crypto.pbkdf2Sync(key, salt, PSWD_ITERATIONS, KEY_SIZE / 8, 'sha512');
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, IV_BYTES);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    return encrypted.toString('hex').toUpperCase(); // Directly convert to hex
}

export function decrypt(encryptedText: string, key: string): string {
    const salt = Buffer.from(key, 'utf8');
    const encryptedBytes = Buffer.from(encryptedText, 'hex');
    const derivedKey = crypto.pbkdf2Sync(key, salt, PSWD_ITERATIONS, KEY_SIZE / 8, 'sha512');
    const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, IV_BYTES);
    const decrypted = Buffer.concat([decipher.update(encryptedBytes), decipher.final()]);
    return decrypted.toString('utf8');
}

export function generateSignature(hashKey: string, params: string[]): string {
    const data = params.join('');
    return crypto.createHmac('sha512', hashKey).update(data, 'utf8').digest('hex').toUpperCase();
}
