// src/routes/compliance.routes.ts
import express from 'express';
import complianceController from './compliance.controller.js';

const router = express.Router();

// Dashboard route
router.get('/dashboard', complianceController.renderDashboard);

// Verification details route
router.get('/verification/:checkpointId', complianceController.renderVerificationDetails);

// Approve verification
router.post('/verification/:checkpointId/approve', complianceController.approveVerification);

// Reject verification
router.post('/verification/:checkpointId/reject', complianceController.rejectVerification);

// View verification history
router.get('/verification/:checkpointId/history', complianceController.viewHistory);

export default router;