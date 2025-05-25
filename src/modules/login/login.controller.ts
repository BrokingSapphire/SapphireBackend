import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request } from '@app/types.d';
import { EmailOtpVerification } from '../signup/signup.services';
import { UnauthorizedError } from '@app/apiError';
import { db } from '@app/database';
import { sign } from '@app/utils/jwt';
import { OK } from '@app/utils/httpstatus';
import { LoginRequestType, ResetPasswordRequestType, LoginOtpVerifyRequestType } from './login.types';
import { ResponseWithToken, SessionJwtType } from '@app/modules/common.types';
import { hashPassword, verifyPassword } from '@app/utils/passwords';

const login = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, LoginRequestType>,
    res: Response,
) => {
    const { password } = req.body;
    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user.id', 'user_password_details.user_id')
        .innerJoin('hashing_algorithm', 'user_password_details.hash_algo_id', 'hashing_algorithm.id')
        .select([
            'user.id',
            'user.email',
            'user.phone',
            'hashing_algorithm.name as hashAlgo',
            'user_password_details.password_salt as salt',
            'user_password_details.password_hash as hashedPassword',
            'user_password_details.is_first_login',
        ])
        .$call((qb) => {
            if ('clientId' in req.body) {
                qb.where('user.id', '=', req.body.clientId);
            } else if ('email' in req.body) {
                qb.where('user.email', '=', req.body.email);
            }

            return qb;
        })
        .executeTakeFirstOrThrow();

    const authenticated = await verifyPassword(password, user);

    if (!authenticated) {
        throw new UnauthorizedError('Invalid credentials');
    }

    const emailOtp = new EmailOtpVerification(user.email);
    await emailOtp.sendOtp();

    res.status(OK).json({
        message: 'OTP sent.',
    });
};

// Verify the OTP for the login
const verifyLoginOtp = async (
    req: Request<undefined, ParamsDictionary, ResponseWithToken, LoginOtpVerifyRequestType>,
    res: Response<ResponseWithToken>,
) => {
    const { otp } = req.body;

    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user_password_details.user_id', 'user.id')
        .select(['user.id', 'user.email', 'user_password_details.is_first_login'])
        .$call((qb) => {
            if ('clientId' in req.body) {
                qb.where('user.id', '=', req.body.clientId);
            } else if ('email' in req.body) {
                qb.where('user.email', '=', req.body.email);
            }
            return qb;
        })
        .executeTakeFirstOrThrow();

    const emailOtp = new EmailOtpVerification(user.email);
    await emailOtp.verifyOtp(otp);

    const token = sign<SessionJwtType>({
        userId: user.id,
    });

    res.status(OK).json({
        message: 'Login successful',
        token,
        data: {
            isFirstLogin: user.is_first_login,
        },
    });
};

// reset password
const resetPassword = async (
    req: Request<SessionJwtType, ParamsDictionary, DefaultResponseData, ResetPasswordRequestType>,
    res: Response,
) => {
    const { userId } = req.auth!;
    const { currentPassword, newPassword } = req.body;

    // Fetch user details
    const user = await db
        .selectFrom('user')
        .innerJoin('user_password_details', 'user.id', 'user_password_details.user_id')
        .innerJoin('hashing_algorithm', 'user_password_details.hash_algo_id', 'hashing_algorithm.id')
        .select([
            'user.id',
            'user_password_details.password_hash as hashedPassword',
            'user_password_details.password_salt as salt',
            'hashing_algorithm.name as hashAlgo',
        ])
        .where('user.id', '=', userId)
        .executeTakeFirstOrThrow();

    // Verify current password
    const isCurrentPasswordValid = verifyPassword(currentPassword, user);

    if (!isCurrentPasswordValid) {
        throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword, 'bcrypt');

    // Update the user's password
    await db.transaction().execute(async (tx) => {
        await tx
            .updateTable('user_password_details')
            .set({
                password_hash: hashedPassword.hashedPassword,
                password_salt: hashedPassword.salt,
            })
            .where('user_id', '=', userId)
            .execute();
    });

    res.status(OK).json({
        message: 'Password reset successful',
    });
};

export { login, verifyLoginOtp, resetPassword };
