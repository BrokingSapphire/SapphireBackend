// src/routes/compliance.routes.ts
import express from 'express';
import {
    finalizeVerification,
    getVerificationStatus,
    handleGetCheckpointDetails,
    renderVerificationDetail,
    updateVerificationStatus,
} from './compliance.controller';

import validators from './compliance.validator';
import { jwtMiddleware } from '@app/utils/jwt';

const router = express.Router();

/**
 * Route to render verification details for a specific checkpoint ID and verification step
 * POST /verification/:checkpointId/details
 */
router.post(
    '/verification/:checkpointId/details',
    jwtMiddleware,
    validators.checkpointIdParam,
    validators.renderVerificationDetail,
    renderVerificationDetail,
);

/**
 * Route to update verification status for a specific verification type
 * POST /verification/:checkpointId/status
 */
router.post(
    '/verification/:checkpointId/status',
    jwtMiddleware,
    validators.checkpointIdParam,
    validators.updateVerificationStatus,
    updateVerificationStatus,
);

/**
 * Route to get current verification status for a checkpoint
 * GET /verification/:checkpointId
 */
router.get('/verification/:checkpointId', jwtMiddleware, validators.checkpointIdParam, getVerificationStatus);

/**
 * Route to get checkpoint details (dashboard data)
 * GET /:checkpointId
 */
router.get('/:checkpointId', jwtMiddleware, validators.checkpointIdParam, handleGetCheckpointDetails);

/**
 * Route to finalize verification - checks all statuses,
 * updates overall status, creates user, and deletes checkpoint
 * POST /finalize-verification/:checkpointId
 */
router.post('/finalize-verification/:checkpointId', jwtMiddleware, validators.checkpointIdParam, finalizeVerification);

export default router;
