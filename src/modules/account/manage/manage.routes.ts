import { Router } from 'express';
import {
    addBankAccount,
    getBankAccounts,
    getCurrentSegments,
    getIncomeProofStatus,
    getSettlementFrequency,
    initiateDematFreeze,
    initiateIncomeProofUpload,
    removeBankAccount,
    resendDematFreezeOtp,
    resendSegmentActivationOtp,
    resendSettlementFrequencyOtp,
    updateSegmentActivation,
    updateSettlementFrequency,
    verifyDematFreezeOtp,
    verifySegmentActivationOtp,
    verifySettlementFrequencyOtp,
} from './manage.controller';
import { putIncomeProof } from '@app/modules/signup/signup.controller';

const router = Router();

// Segment Activation Route
router.get('/manage/segments', getCurrentSegments);
router.put('/manage/segment-activation', updateSegmentActivation);
router.post('/manage/segment-activation/verify-otp', verifySegmentActivationOtp);
router.post('/manage/segment-activation/resend-otp', resendSegmentActivationOtp);

// Income Proof Routes
router.get('/manage/income-proof/status', getIncomeProofStatus);
router.post('/manage/income-proof/initiate', initiateIncomeProofUpload);
router.put('/manage/income-proof/:uid', putIncomeProof);

// Bank Account Routes
router.get('/manage/bank-accounts', getBankAccounts);
router.post('/manage/bank-accounts', addBankAccount);
router.delete('/manage/bank-accounts/remove', removeBankAccount);

// Demat Freeze Routes
router.post('/manage/demat/initiate-freeze', initiateDematFreeze);
router.post('/manage/demat/resend-otp', resendDematFreezeOtp);
router.post('/manage/demat/verify-freeze-otp', verifyDematFreezeOtp);

// update settlement frequency
router.get('/manage/settlement-frequency', getSettlementFrequency);
router.put('/manage/settlement-frequency', updateSettlementFrequency);
router.post('/manage/settlement-frequency/verify-otp', verifySettlementFrequencyOtp);
router.post('/manage/settlement-frequency/resend-otp', resendSettlementFrequencyOtp);

export default router;
