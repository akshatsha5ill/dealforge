import { Request, Response, NextFunction } from 'express';
import { getFirebaseFirestore } from '../services/firebase-admin.js';
import { getMonthlyAnalysisCount } from '../services/usage-service.js';
import { getEffectiveAnalysisLimit } from '../services/referral-service.js';
import { AppError } from './errorHandler.js';
import log from '../utils/logger.js';

export type PlanLevel = 'pro' | 'enterprise';

export interface PlanUser {
  uid: string;
  plan: 'free' | 'pro' | 'enterprise';
}

export const getPlanForUser = async (uid: string): Promise<'free' | 'pro' | 'enterprise'> => {
  const doc = await getFirebaseFirestore().collection('users').doc(uid).collection('subscription').doc('current').get();
  if (!doc.exists) return 'free';
  const plan = doc.data()?.plan as string | undefined;
  if (plan === 'pro' || plan === 'enterprise') return plan;
  return 'free';
};

export function requirePlan(minPlan: PlanLevel) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const uid = (req as { user?: { uid?: string } }).user?.uid;
    if (!uid) {
      return next(new AppError('Unauthorized', 401));
    }

    try {
      const plan = await getPlanForUser(uid);
      (req as unknown as { plan?: string }).plan = plan;

      const allowed = plan === 'enterprise' || (minPlan === 'pro' && plan === 'pro');
      if (!allowed) {
        return next(new AppError(`This feature requires the ${minPlan} plan. Please upgrade to continue.`, 403));
      }
      return next();
    } catch (err) {
      log.error('Failed to check subscription for plan gate', { error: err, uid });
      return next(new AppError('Failed to check subscription', 500));
    }
  };
}

export function attachPlan() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const uid = (req as { user?: { uid?: string } }).user?.uid;
    if (!uid) {
      return next(new AppError('Unauthorized', 401));
    }

    try {
      const plan = await getPlanForUser(uid);
      (req as unknown as { plan?: string }).plan = plan;
      return next();
    } catch (err) {
      log.error('Failed to attach plan', { error: err, uid });
      return next(new AppError('Failed to check subscription', 500));
    }
  };
}

export function enforceAiModelAccess(req: Request, _res: Response, next: NextFunction): void {
  const plan = (req as unknown as { plan?: string }).plan || 'free';
  const model = (req.body as { model?: string } | undefined)?.model || 'openai';
  if (plan === 'free' && model !== 'openai') {
    return next(new AppError('The free plan includes 1 AI model (OpenAI). Upgrade to Pro for all models.', 403));
  }
  return next();
}

export function enforceAnalysisLimit() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const uid = (req as unknown as { user?: { uid?: string } }).user?.uid;
    const plan = (req as unknown as { plan?: string }).plan || 'free';
    if (!uid || plan !== 'free') {
      return next();
    }

    try {
      const count = await getMonthlyAnalysisCount(uid);
      const limit = await getEffectiveAnalysisLimit(uid);
      if (count >= limit) {
        return next(new AppError(`You've reached your free limit of ${limit} analyzed meetings per month. Upgrade to Pro for unlimited meetings.`, 403));
      }
      return next();
    } catch (err) {
      log.error('Failed to check analysis usage limit', { error: err, uid });
      return next(new AppError('Failed to check usage limit', 500));
    }
  };
}
