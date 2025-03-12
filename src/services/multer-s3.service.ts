import { BadRequestError } from '@app/apiError';
import { env } from '@app/env';
import { S3Client } from '@aws-sdk/client-s3';
import { Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';

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

type MulterHandler = (req: Request, res: Response) => Promise<any>;

const wrappedMulterHandler = (handler: RequestHandler): MulterHandler => {
    return async (req: Request, res: Response): Promise<any> => {
        return new Promise((resolve, reject): void => {
            handler(req, res, (error) => {
                if (error) {
                    reject(error);
                }

                resolve({ file: req.file, body: req.body });
            });
        });
    };
};

export { imageUpload, wrappedMulterHandler };
