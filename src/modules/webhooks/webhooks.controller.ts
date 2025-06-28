import { InternalServerError } from '@app/apiError';
import { db } from '@app/database';
import logger from '@app/logger';
import { PaymentService } from '@app/services/ntt-pg.service';
import { Request } from '@app/types';
import { OK } from '@app/utils/httpstatus';
import { Response } from 'express';
import { sendFundsAdded } from '@app/services/notification.service';

const depositCallback = async (req: Request, res: Response): Promise<void> => {
    const { encData } = req.body;

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
                    user_id: response.payInstrument.payDetails.clientCode!,
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
                .where('user_id', '=', response.payInstrument.payDetails.clientCode!)
                .execute();
        });

    const data = await db
        .selectFrom('user')
        .innerJoin('user_name', 'user.name', 'user_name.id')
        .innerJoin('user_balance', 'user_balance.user_id', 'user.id')
        .select(['user.email', 'user_name.first_name', 'available_cash'])
        .where('user.id', '=', response.payInstrument.payDetails.clientCode!)
        .executeTakeFirstOrThrow();

    const date = new Date(response.payInstrument.payDetails.txnCompleteDate.replace(' ', 'T'));
    await sendFundsAdded(data.email, {
        email: data.email,
        userName: data.first_name,
        amount: response.payInstrument.payDetails.totalAmount.toFixed(2),
        availableBalance: data.available_cash.toFixed(2),
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        }),
    });

    if (req.query.redirect) {
        res.redirect(req.query.redirect as string);
    } else {
        res.status(OK).json({
            message: 'Received successfully.',
        });
    }
};

export { depositCallback };
