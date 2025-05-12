import { ParamsDictionary } from 'express-serve-static-core';
import { Response, DefaultResponseData, Request , LoginResponseWithToken , LoginRequestType, ResetPasswordRequestType} from '@app/types.d';
import { UnauthorizedError } from '@app/apiError';
import { db } from '@app/database';
import { sign } from '@app/utils/jwt';
import bcrypt from 'bcrypt';
import { OK } from '@app/utils/httpstatus';

import {
    LoginJwtType,
} from './login.types';

const login = async (
    req: Request<undefined, ParamsDictionary, DefaultResponseData, LoginRequestType>,
    res: Response<LoginResponseWithToken> 
) => {
    const { clientId, password } = req.body;
    const user = await db
        .selectFrom('user')
        .leftJoin('pan_detail', 'user.pan_id', 'pan_detail.id')
        .select([
            'user.id',
            'user.client_id',
            'user.email',
            'user.password',
            'user.is_first_login',
            'pan_detail.pan_number'
        ])
        .where('user.client_id', '=', clientId)
        .executeTakeFirstOrThrow();

    let isAuthenticated = false;
    let isFirstLogin = false;

    // Check if first login (password will be PAN)
    if (user.is_first_login) {
        isFirstLogin = true;
        isAuthenticated = user.pan_number === password;
    } else {
        // Verify password hash
        isAuthenticated = !!user.password && await bcrypt.compare(password, user.password);
    }

    if (!isAuthenticated) {
        throw new UnauthorizedError('Invalid credentials');
    }
    const token = sign({ clientId: user.client_id, userId: user.id });

    res.status(OK).json({
        message: 'Login successful',
        token,
        isFirstLogin
    });
};

// reset password
const resetPassword = async (
    req: Request<LoginJwtType, ParamsDictionary, DefaultResponseData, ResetPasswordRequestType>,
    res: Response
) => {
    const { clientId, userId } = req.auth!!;
    const { currentPassword, newPassword } = req.body;
    const user = await db
        .selectFrom('user')
        .leftJoin('pan_detail', 'user.pan_id', 'pan_detail.id')
        .select(['user.id','user.password','user.is_first_login','pan_detail.pan_number'
        ])
        .where('user.client_id', '=', clientId)
        .executeTakeFirstOrThrow();

    let isAuthenticated = false;

     // Verify current password
     if (user.is_first_login) {
        isAuthenticated = user.pan_number === currentPassword;
    } else {
        isAuthenticated = !!user.password && await bcrypt.compare(currentPassword, user.password);
    }

    if (!isAuthenticated) {
        throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and set is_first_login to false
    await db
        .updateTable('user')
        .set({
            password: hashedPassword,
            is_first_login: false,
            updated_at: new Date()
        })
        .where('id', '=', Number(userId))
        .execute();

    res.status(OK).json({
        message: 'Password reset successful'
    });
}

export { login, resetPassword };