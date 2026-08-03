import express, { Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';
import { verifyAuth, AuthRequest } from '../middleware/auth.js';
import { requirePlan } from '../middleware/plan.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/api-key-service.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

const createKeySchema = z.object({
  name: z.string().min(1).max(60).optional(),
});

router.post(
  '/',
  requirePlan('pro'),
  validateRequest({ body: createKeySchema }),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        throw new AppError('Unauthorized', 401);
      }
      const name = (req.body as { name?: string }).name?.trim() || 'API key';
      const result = await createApiKey(uid, name);
      if (!result) {
        throw new AppError('Failed to create API key', 500);
      }
      res.status(201).json({ status: 'success', ...result });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        throw new AppError('Unauthorized', 401);
      }
      const keys = await listApiKeys(uid);
      res.status(200).json({ status: 'success', keys });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:keyHash',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        throw new AppError('Unauthorized', 401);
      }
      const keyHash = req.params.keyHash;
      const revoked = await revokeApiKey(uid, keyHash);
      if (!revoked) {
        throw new AppError('API key not found', 404);
      }
      res.status(200).json({ status: 'success', revoked: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
