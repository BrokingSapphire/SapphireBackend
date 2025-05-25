import { Router } from 'express';
import {
    finalizeVerification,
    getVerificationStatus,
    getVerificationDetail,
    updateVerificationStatus,
    getVerificationStepStatus,
    getCheckpointDetails,
    assignOfficer,
    autoFinalVerification,
} from './compliance.controller';
import {
    CheckpointIdParamSchema,
    GetVerificationDetailParamSchema,
    UpdateVerificationStatusSchema,
} from '@app/modules/compliance/compliance.validator';
import { validate } from '@app/middlewares';
import { jwtMiddleware } from '@app/utils/jwt';

const router = Router();

router.post('/:checkpointId/assign', jwtMiddleware, validate(CheckpointIdParamSchema, 'params'), assignOfficer);

/**
 * Route to get verification status for a specific checkpoint ID
 * GET /:checkpointId/status
 */
router.get('/:checkpointId/status', jwtMiddleware, validate(CheckpointIdParamSchema, 'params'), getVerificationStatus);

router.get('/:checkpointId/details', jwtMiddleware, validate(CheckpointIdParamSchema, 'params'), getCheckpointDetails);

/**
 * Route to update verification status for a specific verification type
 * PUT /:checkpointId/status
 */
router.put(
    '/:checkpointId/status',
    jwtMiddleware,
    validate(CheckpointIdParamSchema, 'params'),
    validate(UpdateVerificationStatusSchema),
    updateVerificationStatus,
);

/**
 * Route to get current verification status for a checkpoint
 * GET /:checkpointId/:step/status
 */
router.get(
    '/:checkpointId/:step/status',
    jwtMiddleware,
    validate(CheckpointIdParamSchema, 'params'),
    validate(GetVerificationDetailParamSchema, 'params'),
    getVerificationStepStatus,
);

/**
 * Route to render verification details for a specific checkpoint ID and verification step
 * GET /:checkpointId/:step
 */
router.get(
    '/:checkpointId/:step',
    jwtMiddleware,
    validate(CheckpointIdParamSchema, 'params'),
    validate(GetVerificationDetailParamSchema, 'params'),
    getVerificationDetail,
);

/**
 * Route to finalize verification - checks all statuses,
 * updates overall status, creates user, and deletes checkpoint
 * POST /finalize-verification/:checkpointId
 */
router.post(
    '/:checkpointId/finalize',
    jwtMiddleware,
    validate(CheckpointIdParamSchema, 'params'),
    finalizeVerification,
);

router.post('/:checkpointId/auto-finalize', validate(CheckpointIdParamSchema, 'params'), autoFinalVerification);

export default router;
