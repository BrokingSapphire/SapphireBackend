import { Router } from 'express';
import {
    addBankAccount,
    getBankAccounts,
    getCurrentSegments,
    initiateDematFreeze,
    removeBankAccount,
    resendDematFreezeOtp,
    resendSegmentActivationOtp,
    updateSegmentActivation,
    updateSettlementFrequency,
    verifyDematFreezeOtp,
    verifySegmentActivationOtp,
} from './manage.controller';

const router = Router();

// Segment Activation Route
router.get('/manage/segments', getCurrentSegments);
router.put('/manage/segment-activation', updateSegmentActivation);
router.post('/manage/segment-activation/verify-otp', verifySegmentActivationOtp);
router.post('/manage/segment-activation/resend-otp', resendSegmentActivationOtp);

// Bank Account Routes
router.get('/manage/bank-accounts', getBankAccounts);
router.post('/manage/bank-accounts', addBankAccount);
router.delete('/manage/bank-accounts/remove', removeBankAccount);

// Demat Freeze Routes
router.post('/manage/demat/initiate-freeze', initiateDematFreeze);
router.post('/manage/demat/resend-otp', resendDematFreezeOtp);
router.post('/manage/demat/verify-freeze-otp', verifyDematFreezeOtp);

router.put('/manage/settlement-frequency', updateSettlementFrequency);

export default router;
