import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import j2s from 'joi-to-swagger';
import { RequestOtpSchema, VerifyOtpSchema, CheckpointSchema } from '@app/modules/signup/signup.validator';
import { CheckpointStep, ValidationType } from '@app/modules/signup/signup.types';
import { env } from '@app/env';

const { swagger: requestOtpSwagger } = j2s(RequestOtpSchema);
const { swagger: verifyOtpSwagger } = j2s(VerifyOtpSchema);
const { swagger: checkpointSwagger } = j2s(CheckpointSchema);

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
        '/signup/ipv/{uid}': {
            put: {
                tags: ['Signup'],
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
        '/signup/ipv': {
            get: {
                tags: ['Signup'],
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
