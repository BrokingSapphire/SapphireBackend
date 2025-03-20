import Razorpay from 'razorpay';
import { env } from '@app/env';
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';

class RazorPayService {
    private readonly instance = new Razorpay({
        key_id: env.razorpay.keyId,
        key_secret: env.razorpay.keySecret,
    });

    createSignupOrder(email: string, referenceId?: string) {
        return this.instance.orders.create({
            amount: 50000,
            currency: 'INR',
            receipt: referenceId,
            partial_payment: false,
            notes: {
                email,
            },
        });
    }

    verifyOrder(orderId: string, paymentId: string, signature: string) {
        return validatePaymentVerification(
            {
                order_id: orderId,
                payment_id: paymentId,
            },
            signature,
            env.razorpay.keySecret!!,
        );
    }
}

export default new RazorPayService();
