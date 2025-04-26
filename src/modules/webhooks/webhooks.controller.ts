import { BadRequestError, InternalServerError } from '@app/apiError';
import { db } from '@app/database';
import { env } from '@app/env';
import logger from '@app/logger';
import { PaymentService } from '@app/services/ntt-pg.service';
import { Request } from '@app/types';
import { OK } from '@app/utils/httpstatus';
import { Response } from 'express';

const depositCallback = async (req: Request, res: Response): Promise<void> => {
    const { merchId, encData } = req.params;

    if (merchId !== env.ntt.userId) throw new BadRequestError('Invalid merchant id');

    const paymentService = new PaymentService(String());
    const [response, isValid] = paymentService.decryptAndValidateResponse(encData);

    if (!isValid) {
        logger.error(response);
        throw new InternalServerError('Invalid payment response recieced.');
    }

    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (tx) => {
            await tx
                .insertInto('balance_transactions')
                .values({
                    reference_no: response.payInstrument.merchDetails.merchTxnId,
                    transaction_id: String(response.payInstrument.payDetails.atomTxnId),
                    user_id: Number(response.payInstrument.payDetails.clientCode!!),
                    transaction_type: 'deposit',
                    status: 'completed',
                    amount: response.payInstrument.payDetails.totalAmount,
                    safety_cut_amount: 0, // TODO: Implement safety cut logic
                    safety_cut_percentage: 0,
                    transaction_time: new Date(response.payInstrument.payDetails.txnCompleteDate.replace(' ', 'T')),
                    created_at: new Date(response.payInstrument.payDetails.txnInitDate.replace(' ', 'T')),
                })
                .execute();

            const amount = response.payInstrument.payDetails.amount;
            await tx
                .updateTable('user_balance')
                .set({
                    available_cash: (eb) => eb('available_cash', '+', amount),
                })
                .where('user_id', '=', Number(response.payInstrument.payDetails.clientCode!!))
                .execute();
        });

    res.status(OK).json({
        message: 'Recieved successfully.',
    });
};

export { depositCallback };
