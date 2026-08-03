import express, { Request, Response } from 'express';
import DodoPayments from 'dodopayments';
import { getFirebaseFirestore } from '../services/firebase-admin.js';
import { verifyAuth, AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { AppError } from '../middleware/errorHandler.js';
import log from '../utils/logger.js';

const router = express.Router();

function getDodoClient() {
  return new DodoPayments({
    bearerToken: config.dodo.apiKey || '',
    environment: 'live_mode',
  });
}

function getProductIdForPlan(plan: string): string | null {
  if (plan === 'pro') return process.env.DODO_PRO_PRODUCT_ID || null;
  if (plan === 'enterprise') return process.env.DODO_ENTERPRISE_PRODUCT_ID || null;
  return null;
}

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
});

router.post('/checkout', verifyAuth, validateRequest({ body: checkoutSchema }), async (req: AuthRequest, res: Response, next: express.NextFunction): Promise<unknown> => {
  const { plan } = req.body;
  const userId = req.user!.uid;

  const productId = getProductIdForPlan(plan);
  if (!productId) {
    return next(new AppError('Invalid plan', 400));
  }

  try {
    const dodo = getDodoClient();
    const response = await dodo.checkoutSessions.create({
      product_cart: [
        { product_id: productId, quantity: 1 },
      ],
      metadata: { userId, plan },
      return_url: `${config.clientUrl}/dashboard/billing?session_id={checkout_session_id}`,
      cancel_url: `${config.clientUrl}/dashboard/billing`,
    });

    log.info('Checkout session created', { userId, plan, sessionId: response.session_id });

    return res.status(200).json({ checkout_url: response.checkout_url });
  } catch (err) {
    log.error('Failed to create checkout session', { error: err, userId, plan });
    return next(new AppError('Failed to create checkout session', 500));
  }
});

const verifySchema = z.object({ session_id: z.string().min(1), plan: z.enum(['pro', 'enterprise']) });

router.post('/verify', verifyAuth, validateRequest({ body: verifySchema }), async (req: AuthRequest, res: Response, next: express.NextFunction): Promise<unknown> => {
  const { session_id, plan } = req.body;
  const userId = req.user!.uid;

  try {
    const dodo = getDodoClient();
    const session = await dodo.checkoutSessions.retrieve(session_id);

    if (session.payment_status === 'succeeded') {
      const userRef = getFirebaseFirestore().collection('users').doc(userId).collection('subscription').doc('current');

      await userRef.set({
        plan,
        status: 'active',
        paymentId: session.payment_id || null,
        subscriptionId: null,
        customerId: null,
        currentPeriodEnd: null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      log.info('Payment verified and subscription updated', { userId, plan, sessionId: session_id });

      return res.status(200).json({ plan, status: 'active' });
    }

    return res.status(200).json({ status: 'pending', plan: 'free' });
  } catch (err) {
    log.error('Verify session failed', { error: err, userId, sessionId: session_id });
    return res.status(200).json({ status: 'pending', plan: 'free' });
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSubscriptionData(data: any): data is { payload_type: 'Subscription'; subscription_id: string; status: string; metadata: Record<string, unknown>; customer: { customer_id: string } | null; next_billing_date: string | null; product_id: string } {
  return data?.payload_type === 'Subscription';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPaymentData(data: any): data is { payload_type: 'Payment'; status: string; metadata: Record<string, unknown> } {
  return data?.payload_type === 'Payment';
}

router.post('/webhook', async (req: Request, res: Response, next: express.NextFunction): Promise<unknown> => {
  const body = JSON.stringify(req.body);
  const headers: Record<string, string> = {};
  for (const key of Object.keys(req.headers)) {
    const val = req.headers[key];
    if (val !== undefined) {
      headers[key] = Array.isArray(val) ? val.join(', ') : val;
    }
  }

  try {
    const dodo = getDodoClient();
    const event = dodo.webhooks.unwrap(body, {
      headers,
      key: config.dodo.webhookKey || undefined,
    });

    log.info('Dodo webhook received', { type: event.type });

    const { data } = event;

    if (isSubscriptionData(data)) {
      const metadata = data.metadata;
      const userId = metadata?.userId as string | undefined;

      if (!userId) {
        log.warn('Webhook missing userId in metadata', { subscriptionId: data.subscription_id });
        return res.status(200).json({ status: 'ok' });
      }

      const userRef = getFirebaseFirestore().collection('users').doc(userId).collection('subscription').doc('current');

      let plan = 'free';
      let status: 'active' | 'cancelled' | 'past_due' | 'trialing' = 'active';

      if (data.status === 'active') {
        status = 'active';
        plan = (metadata?.plan as string) || 'pro';
      } else if (data.status === 'cancelled' || data.status === 'expired') {
        status = 'cancelled';
      } else if (data.status === 'on_hold') {
        status = 'past_due';
      } else {
        status = 'active';
        plan = (metadata?.plan as string) || 'pro';
      }

      await userRef.set({
        plan,
        status,
        currentPeriodEnd: data.next_billing_date || null,
        customerId: data.customer?.customer_id || null,
        subscriptionId: data.subscription_id,
        productId: data.product_id,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      log.info('Subscription updated in Firestore', { userId, plan, status });
    }

    if (isPaymentData(data)) {
      const metadata = data.metadata;
      const userId = metadata?.userId as string | undefined;

      if (userId && data.status === 'succeeded') {
        const plan = (metadata?.plan as string) || 'pro';
        const userRef = getFirebaseFirestore().collection('users').doc(userId).collection('subscription').doc('current');
        await userRef.set({
          plan,
          status: 'active',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        log.info('Payment succeeded, subscription activated', { userId, plan });
      }

      if (userId && data.status === 'failed') {
        const userRef = getFirebaseFirestore().collection('users').doc(userId).collection('subscription').doc('current');
        await userRef.set({
          status: 'past_due',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        log.info('Payment failed', { userId });
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    log.error('Webhook verification failed', { error: (err as Error).message, stack: (err as Error).stack });
    return next(new AppError('Webhook verification failed', 401));
  }
});

router.get('/subscription', verifyAuth, async (req: AuthRequest, res: Response, next: express.NextFunction): Promise<void> => {
  const userId = req.user!.uid;

  try {
    const doc = await getFirebaseFirestore().collection('users').doc(userId).collection('subscription').doc('current').get();

    if (!doc.exists) {
      res.status(200).json({
        plan: 'free',
        status: 'active',
        currentPeriodEnd: null,
        customerId: null,
        subscriptionId: null,
      });
      return;
    }

    const data = doc.data()!;
    res.status(200).json({
      plan: data.plan || 'free',
      status: data.status || 'active',
      currentPeriodEnd: data.currentPeriodEnd || null,
      customerId: data.customerId || null,
      subscriptionId: data.subscriptionId || null,
    });
  } catch (err) {
    log.error('Failed to fetch subscription', { error: err, userId });
    return next(new AppError('Failed to fetch subscription', 500));
  }
});

router.post('/cancel', verifyAuth, async (req: AuthRequest, res: Response, next: express.NextFunction): Promise<unknown> => {
  const userId = req.user!.uid;

  try {
    const doc = await getFirebaseFirestore().collection('users').doc(userId).collection('subscription').doc('current').get();

    if (!doc.exists) {
      return next(new AppError('No active subscription found', 404));
    }

    const data = doc.data()!;
    const subscriptionId = data.subscriptionId;

    if (!subscriptionId) {
      await doc.ref.set({ status: 'cancelled', updatedAt: new Date().toISOString() }, { merge: true });
      log.info('Subscription marked cancelled locally (no subscription ID from webhook yet)', { userId });
      res.status(200).json({ status: 'ok' });
      return;
    }

    const dodo = getDodoClient();
    await dodo.subscriptions.update(subscriptionId, {
      cancel_at_next_billing_date: true,
    });

    await doc.ref.set({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    log.info('Subscription cancelled', { userId, subscriptionId });

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    log.error('Failed to cancel subscription', { error: err, userId });
    return next(new AppError('Failed to cancel subscription', 500));
  }
});

export default router;
