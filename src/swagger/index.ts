import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import j2s from 'joi-to-swagger';
import { RequestOtpSchema, VerifyOtpSchema, CheckpointSchema } from '@app/modules/signup/signup.validator';
import { CheckpointStep, ValidationType } from '@app/modules/signup/signup.types';
import { env } from '@app/env';

const { swagger: requestOtpSwagger } = j2s(RequestOtpSchema);
const { swagger: verifyOtpSwagger } = j2s(VerifyOtpSchema);
const { swagger: checkpointSwagger } = j2s(CheckpointSchema);

const checkpointSchemaDestructed = {
    [CheckpointStep.PAN]: {
        type: 'object',
        properties: {
            step: { type: 'string', enum: [CheckpointStep.PAN] },
            pan_number: { type: 'string' },
        },
        required: ['step', 'pan_number'],
    },
    [CheckpointStep.AADHAAR_URI]: {
        type: 'object',
        properties: {
            step: { type: 'string', enum: [CheckpointStep.AADHAAR_URI] },
            redirect: { type: 'string', format: 'uri' },
        },
        required: ['step'],
    },
    [CheckpointStep.INVESTMENT_SEGMENT]: {
        type: 'object',
        properties: {
            step: { type: 'string', enum: [CheckpointStep.INVESTMENT_SEGMENT] },
            segments: {
                type: 'array',
                items: { type: 'string' },
                minItems: 0,
            },
        },
        required: ['step', 'segments'],
    },
    [CheckpointStep.USER_DETAIL]: {
        type: 'object',
        properties: {
            step: { type: 'string', enum: [CheckpointStep.USER_DETAIL] },
            marital_status: { type: 'string' },
            father_name: { type: 'string' },
            mother_name: { type: 'string' },
        },
        required: ['step', 'marital_status', 'father_name', 'mother_name'],
    },
    [CheckpointStep.OCCUPATION]: {
        type: 'object',
        properties: {
            step: { type: 'string', enum: [CheckpointStep.OCCUPATION] },
            occupation: { type: 'string' },
            politically_exposed: { type: 'boolean' },
        },
        required: ['step', 'occupation', 'politically_exposed'],
    },
    [CheckpointStep.BANK_VALIDATION_START]: {
        type: 'object',
        properties: {
            step: { type: 'string', enum: [CheckpointStep.BANK_VALIDATION_START] },
            validation_type: { type: 'string', enum: Object.values(ValidationType) },
        },
        required: ['step', 'validation_type'],
    },
    [CheckpointStep.BANK_VALIDATION]: {
        type: 'object',
        properties: {
            step: { type: 'string', enum: [CheckpointStep.BANK_VALIDATION] },
            validation_type: { type: 'string', enum: Object.values(ValidationType) },
            bank: {
                type: 'object',
                properties: {
                    account_number: { type: 'string' },
                    ifsc_code: { type: 'string' },
                },
                required: ['account_number', 'ifsc_code'],
            },
        },
        required: ['step', 'validation_type'],
    },
    [CheckpointStep.ADD_NOMINEES]: {
        type: 'object',
        properties: {
            step: { type: 'string', enum: [CheckpointStep.ADD_NOMINEES] },
            nominees: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        gov_id: { type: 'string' },
                        relation: { type: 'string' },
                        share: { type: 'number' },
                    },
                    required: ['name', 'gov_id', 'relation', 'share'],
                },
            },
        },
        required: ['step', 'nominees'],
    },
};

const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Sapphire Backend API',
        version: '1.0.0',
        description: 'API documentation for Sapphire Backend',
    },
    servers: [
        {
            url: env.apiPath,
            description: 'API v1',
        },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: {
                        type: 'object',
                        properties: {
                            code: { type: 'number' },
                            message: { type: 'string' },
                            details: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                        },
                    },
                },
            },
            RequestOtp: requestOtpSwagger,
            VerifyOtp: verifyOtpSwagger,
            Checkpoint: checkpointSwagger,
            ...Object.fromEntries(
                Object.entries(checkpointSchemaDestructed).map(([key, value]) => [`Checkpoint-${key}`, value]),
            ),
        },
    },
    paths: {
        '/auth/signup/request-otp': {
            post: {
                tags: ['Auth'],
                summary: 'Request OTP',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RequestOtp' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'OTP sent successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '400': { $ref: '#/components/schemas/Error' },
                },
            },
        },
        '/auth/signup/verify-otp': {
            post: {
                tags: ['Auth'],
                summary: 'Verify OTP',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/VerifyOtp' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'OTP verified successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        token: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '401': { $ref: '#/components/schemas/Error' },
                },
            },
        },
        '/auth/signup/checkpoint': {
            post: {
                tags: ['Auth'],
                security: [{ BearerAuth: [] }],
                summary: 'Save signup checkpoint',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Checkpoint' },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Checkpoint saved successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        data: {
                                            type: 'object',
                                            properties: {
                                                uri: { type: 'string' },
                                                payment_link: { type: 'string' },
                                                uid: { type: 'string', format: 'uuid' },
                                                ios_links: {
                                                    type: 'object',
                                                    properties: {
                                                        paytm: { type: 'string' },
                                                        phonepe: { type: 'string' },
                                                        gpay: { type: 'string' },
                                                        bhim: { type: 'string' },
                                                        whatsapp: { type: 'string' },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '401': { $ref: '#/components/schemas/Error' },
                    '422': { $ref: '#/components/schemas/Error' },
                },
            },
        },
        '/auth/signup/verify': {},
        '/auth/signup/checkpoint/{step}': {
            get: {
                tags: ['Auth'],
                security: [{ BearerAuth: [] }],
                summary: 'Get signup checkpoint',
                parameters: [
                    {
                        in: 'path',
                        name: 'step',
                        required: true,
                        schema: {
                            type: 'string',
                            enum: [
                                CheckpointStep.PAN,
                                CheckpointStep.INVESTMENT_SEGMENT,
                                CheckpointStep.USER_DETAIL,
                                CheckpointStep.ACCOUNT_DETAIL,
                                CheckpointStep.OCCUPATION,
                                CheckpointStep.BANK_VALIDATION,
                            ],
                        },
                    },
                ],
                responses: {
                    '200': {
                        description: 'Checkpoint retrieved successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {
                                            type: 'object',
                                            properties: {
                                                pan_number: { type: 'string' },
                                                segments: {
                                                    type: 'array',
                                                    items: { type: 'string' },
                                                },
                                                father_name: { type: 'string' },
                                                mother_name: { type: 'string' },
                                                marital_status: { type: 'string' },
                                                annual_income: { type: 'string' },
                                                trading_exp: { type: 'string' },
                                                account_settlement: { type: 'string' },
                                                occupation: { type: 'string' },
                                                is_politically_exposed: { type: 'boolean' },
                                                bank: {
                                                    type: 'object',
                                                    properties: {
                                                        account_number: { type: 'string' },
                                                        ifsc_code: { type: 'string' },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '401': { $ref: '#/components/schemas/Error' },
                    '422': { $ref: '#/components/schemas/Error' },
                },
            },
        },
        '/auth/signup/ipv/{uid}': {
            put: {
                tags: ['Auth'],
                security: [{ BearerAuth: [] }],
                summary: 'Upload IPV image',
                parameters: [
                    {
                        in: 'path',
                        name: 'uid',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    image: {
                                        type: 'string',
                                        format: 'binary',
                                    },
                                },
                                required: ['image'],
                            },
                        },
                    },
                },
                responses: {
                    '201': {
                        description: 'IPV image uploaded successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '422': { $ref: '#/components/responses/UnprocessableEntity' },
                },
            },
        },
        '/auth/signup/ipv': {
            get: {
                tags: ['Auth'],
                security: [{ BearerAuth: [] }],
                summary: 'Get IPV image URL',
                parameters: [
                    {
                        in: 'path',
                        name: 'uid',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    '200': {
                        description: 'IPV image URL retrieved successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {
                                            type: 'object',
                                            properties: {
                                                url: { type: 'string' },
                                            },
                                        },
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    '204': {
                        description: 'IPV not uploaded yet',
                    },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
    },
};

export function setupSwagger(app: Express): void {
    app.use(`${env.apiPath}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
