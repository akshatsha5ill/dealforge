import express from 'express';
import Stripe from 'stripe';
import { verifyAuth, AuthRequest } from '../middleware/auth.js';
import { getFirebaseFirestore } from '../services/firebase-admin.js';
import { config } from '../config.js';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';
import { AppError } from '../middleware/errorHandler.js';
import log from '../utils/logger.js';


const router = express.Router();

let stripe: Stripe | null = null;
const getStripe = (): Stripe => {
  if (!stripe) {
    const key = config.stripe.secretKey;
    if (!key || key.trim() === '') {
      throw new AppError('Stripe not configured', 503);
    }
    stripe = new Stripe(key);
  }
  return stripe;
};

const PLANS = {
  starter: { priceId: config.stripe.starterPriceId, name: 'Starter', meetingsLimit: 50 },
  pro: { priceId: config.stripe.proPriceId, name: 'Pro', meetingsLimit: 500 },
  enterprise: { priceId: config.stripe.enterprisePriceId, name: 'Enterprise', meetingsLimit: -1 },
};

const checkoutSchema = z.object({
  plan: z.string().min(1)
});

router.post('/create-checkout-session', verifyAuth, validateRequest({ body: checkoutSchema }), async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const { plan } = req.body;
    if (!plan || !PLANS[plan as keyof typeof PLANS]) {
      throw new AppError('Invalid plan. Choose: starter, pro, or enterprise.', 400);
    }
    if (!config.stripe.secretKey) {
      throw new AppError('Billing is not configured.', 503);
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PLANS[plan as keyof typeof PLANS].priceId!, quantity: 1 }],
      success_url: `${config.clientUrl}/settings?billing=success`,
      cancel_url: `${config.clientUrl}/settings?billing=cancelled`,
      metadata: { userId: req.user!.uid, plan },
      customer_email: req.user!.email,
    });

    res.status(200).json({ status: 'success', url: session.url });
  } catch (error) {
    next(error);
  }
});

router.post('/create-portal-session', verifyAuth, async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    if (!config.stripe.secretKey) {
      throw new AppError('Billing is not configured.', 503);
    }

    const userDoc = await getFirebaseFirestore().collection('users').doc(req.user!.uid).get();
    const customerId = userDoc.data()?.subscription?.customerId;

    if (!customerId) {
       throw new AppError('No active subscription found to manage.', 400);
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${config.clientUrl}/settings`,
    });

    res.status(200).json({ status: 'success', url: session.url });
  } catch (error) {
    next(error);
  }
});

router.get('/status', verifyAuth, async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const userDoc = await getFirebaseFirestore().collection('users').doc(req.user!.uid).get();
    const data = userDoc.data();
    if (data?.subscription?.status === 'active') {
      res.json({ status: 'success', plan: data.subscription.plan, active: true });
    } else {
      res.json({ status: 'success', plan: 'starter', active: false });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = config.stripe.webhookSecret;

  if (!endpointSecret) {
    return res.status(500).json({ error: 'Stripe webhook secret not configured' });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(400).json({ error: `Webhook Error: ${message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, plan } = (session as Stripe.Checkout.Session).metadata as { userId: string; plan: string };
    log.info(`Subscription activated`, { userId, plan });
    if (userId) {
      getFirebaseFirestore().collection('users').doc(userId).set({ plan, status: 'active', subscriptionId: (session as Stripe.Checkout.Session).subscription }, { merge: true }).catch((err: Error) => log.error('Failed to update subscription', err));
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    log.info(`Subscription cancelled`, { subscriptionId: (subscription as Stripe.Subscription).id });
    getFirebaseFirestore().collection('users').where('subscriptionId', '==', (subscription as Stripe.Subscription).id).get().then((snapshot: FirebaseFirestore.QuerySnapshot) => {
      snapshot.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        doc.ref.update({ status: 'cancelled' });
      });
    }).catch((err: Error) => log.error('Failed to cancel subscription', err));
  }

  res.status(200).json({ received: true });
});



router.get('/plans', (req, res) => {
  const plans = Object.entries(PLANS).map(([key, val]) => ({
    id: key,
    name: val.name,
    meetingsLimit: val.meetingsLimit,
    available: !!val.priceId,
  }));
  res.status(200).json({ status: 'success', plans });
});

export default router;
