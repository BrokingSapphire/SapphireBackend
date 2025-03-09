import jwt, { Algorithm, JwtPayload, SignOptions } from 'jsonwebtoken';
import { expressjwt } from 'express-jwt';
import { env } from '@app/env';

const ALGORITHM: Algorithm = 'HS256';

/**
 * Signs a JWT token with the given payload
 * @param payload - Data to be signed
 * @param secret - Secret key to sign with
 * @param options - JWT sign options
 * @returns Signed JWT token string
 */
const sign = (payload: JwtPayload, options: jwt.SignOptions = {}): string => {
    const signOptions = {
        algorithm: ALGORITHM,
        expiresIn: env.jwt.expiresIn,
        ...options,
    } as SignOptions;
    return jwt.sign(payload, env.jwt.secret, signOptions);
};

const jwtMiddleware = expressjwt({ secret: env.jwt.secret, algorithms: [ALGORITHM] });

export { sign, jwtMiddleware };
