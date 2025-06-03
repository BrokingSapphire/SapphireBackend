import { Router } from 'express';
import {
    addBankAccount,
    freezeDematAccount,
    getBankAccounts,
    removeBankAccount,
    updateSegmentActivation,
    updateSettlementFrequency,
} from './manage.controller';

const router = Router();

// Segment Activation Route
router.put('/manage/segment-activation', updateSegmentActivation);

// Bank Account Routes
router.get('/manage/bank-accounts', getBankAccounts);
router.post('/manage/bank-accounts', addBankAccount);
router.delete('/manage/bank-accounts/remove', removeBankAccount);

// Demat Freeze Routes
router.post('/manage/demat-freeze', freezeDematAccount);

router.put('/manage/settlement-frequency', updateSettlementFrequency);

export default router;
