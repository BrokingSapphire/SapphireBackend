// src/routes/compliance.routes.ts
import express from 'express';
import complianceController from './compliance.controller.js';

const router = express.Router();

// Verification details route
router.post('/verification/:checkpointId/details', complianceController.renderVerificationDetails);

// Verification status update route
router.post('/verification/:checkpointId/status', complianceController.updateVerificationStatus);

export default router;