// know-your-partner.routes.ts

import { Router } from 'express';
import {
    disable2FA,
    get2FAStatus,
    getCurrentUserSession,
    getKnowYourPartner,
    initiateAccountDeletion,
    resendAccountDeletionOtp,
    send2FADisableOtp,
    setup2FA,
    updateOrderPreferences,
    updateUserPermissions,
    updateUserSettings,
    verify2FASetup,
    verifyAccountDeletionOtp,
} from './general.controller';

const router = Router();

router.get('/general/know-your-partner', getKnowYourPartner);
router.put('/general/settings', updateUserSettings);
router.put('/general/settings/order-preferences', updateOrderPreferences);
router.put('/general/settings/permissions', updateUserPermissions);

router.post('/general/settings/delete-account/initiate', initiateAccountDeletion);
router.post('/general/settings/delete-account/verify', verifyAccountDeletionOtp);
router.post('/general/settings/delete-account/resend-otp', resendAccountDeletionOtp);
router.get('/general/settings/current-session', getCurrentUserSession);

// 2FA
router.get('/general/settings/2fa/status', get2FAStatus);
router.post('/general/settings/2fa/setup', setup2FA);
router.post('/general/settings/2fa/setup/verify', verify2FASetup);
router.delete('/general/settings/2fa/disable', disable2FA);
router.post('/general/settings/2fa/disable/send-otp', send2FADisableOtp);

export default router;
