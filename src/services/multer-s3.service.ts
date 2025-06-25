import { BadRequestError } from '@app/apiError';
import { env } from '@app/env';
import { S3Client } from 'multer-s3/node_modules/@aws-sdk/client-s3';
import { RequestHandler } from 'express';
import { Request, Response } from '@app/types';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import jwt from 'jsonwebtoken';
import * as core from 'express-serve-static-core';
import { DefaultResponseData } from '@app/types';

const s3 = new S3Client({ region: env.aws.region });

const keyFunction = (_req: Request, file: Express.Multer.File, cb: (error: any, key?: string) => void): void => {
    const fileName = Date.now() + '_' + file.fieldname + '_' + file.originalname;
    cb(null, fileName);
};

const metadataFunction = (_req: Request, file: Express.Multer.File, cb: (error: any, metadata?: any) => void): void => {
    cb(null, {
        fieldName: file.fieldname,
        uploaded: new Date().toISOString(),
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
    });
};

const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
    const fileExts = ['.png', '.jpg', '.jpeg', '.gif'];

    const isAllowedExt = fileExts.includes(path.extname(file.originalname.toLowerCase()));

    const isAllowedMimeType = file.mimetype.startsWith('image/');

    if (isAllowedExt && isAllowedMimeType) {
        return cb(null, true);
    } else {
        cb(new BadRequestError('File type not allowed!'));
    }
};

const pdfFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
    const fileExt = path.extname(file.originalname.toLowerCase());

    const isAllowedExt = fileExt === '.pdf';
    const isAllowedMimeType = file.mimetype === 'application/pdf';

    if (isAllowedExt && isAllowedMimeType) {
        return cb(null, true);
    } else {
        cb(new BadRequestError('Only PDF files are allowed!'));
    }
};

const imageUpload = multer({
    storage: multerS3({
        s3,
        bucket: env.aws.s3_bucket,
        acl: 'public-read',
        metadata: metadataFunction,
        key: keyFunction,
    }),
    fileFilter: imageFilter,
});

const pdfUpload = multer({
    storage: multerS3({
        s3,
        bucket: env.aws.s3_bucket,
        acl: 'public-read',
        metadata: metadataFunction,
        key: keyFunction,
    }),
    fileFilter: pdfFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit for PDFs
    },
});

type MulterReturnType<ReqBody> = {
    file: Express.MulterS3.File;
    body: ReqBody;
};

type MulterHandler<
    A = jwt.JwtPayload | undefined,
    P = core.ParamsDictionary,
    ResBody = DefaultResponseData,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>,
> = (
    req: Request<A, P, ResBody, ReqBody, ReqQuery, Locals>,
    res: Response<ResBody, Locals>,
) => Promise<MulterReturnType<ReqBody>>;

const wrappedMulterHandler = <
    A = jwt.JwtPayload | undefined,
    P = core.ParamsDictionary,
    ResBody = DefaultResponseData,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>,
>(
    handler: RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>,
): MulterHandler<A, P, ResBody, ReqBody, ReqQuery, Locals> => {
    return async (
        req: Request<A, P, ResBody, ReqBody, ReqQuery, Locals>,
        res: Response<ResBody, Locals>,
    ): Promise<MulterReturnType<ReqBody>> => {
        return new Promise(async (resolve, reject) => {
            await handler(req, res, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve({ file: req.file! as Express.MulterS3.File, body: req.body });
            });
        });
    };
};

export { imageUpload, pdfUpload, wrappedMulterHandler };
