import jwt, { Algorithm, JwtPayload, SignOptions } from 'jsonwebtoken';
import { expressjwt } from 'express-jwt';
import { env } from '@app/env';
import { NextFunction, Request, Response } from 'express';

const ALGORITHM: Algorithm = 'HS256';

/**
 * Signs a JWT token with the given payload
 * @param payload - Data to be signed
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

// const jwtMiddleware = expressjwt({ secret: env.jwt.secret, algorithms: [ALGORITHM] });
const jwtMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
    next();
};

export { sign, jwtMiddleware };
