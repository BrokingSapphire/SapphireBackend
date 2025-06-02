// know-your-partner.routes.ts

import { Router } from 'express';
import {
    getKnowYourPartner,
    initiateAccountDeletion,
    resendAccountDeletionOtp,
    updateOrderPreferences,
    updateUserPermissions,
    updateUserSettings,
    verifyAccountDeletionOtp,
} from './accountController';

const router = Router();

router.get('/general/know-your-partner', getKnowYourPartner);
router.put('/general/settings', updateUserSettings);
router.put('/general/settings/order-preferences', updateOrderPreferences);
router.put('/general/settings/permissions', updateUserPermissions);

router.post('/general/settings/delete-account/initiate', initiateAccountDeletion);
router.post('/general/settings/delete-account/verify', verifyAccountDeletionOtp);
router.post('/general/settings/delete-account/resend-otp', resendAccountDeletionOtp);

export default router;
