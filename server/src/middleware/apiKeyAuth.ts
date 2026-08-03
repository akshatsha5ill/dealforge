import { Request, Response, NextFunction } from 'express';
import { findApiKeyOwner, touchApiKeyLastUsed } from '../services/api-key-service.js';
import { AppError } from './errorHandler.js';

export const API_KEY_HEADER = 'x-api-key';

export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const key = req.headers[API_KEY_HEADER] as string | undefined;
  if (!key) {
    return next(new AppError('Unauthorized: Missing API key', 401));
  }
  try {
    const owner = await findApiKeyOwner(key);
    if (!owner) {
      return next(new AppError('Unauthorized: Invalid API key', 401));
    }
    (req as unknown as { user?: { uid: string } }).user = { uid: owner.uid };
    (req as unknown as { apiKeyHash?: string }).apiKeyHash = owner.keyHash;
    void touchApiKeyLastUsed(owner.keyHash);
    next();
  } catch (err) {
    next(new AppError('Failed to validate API key', 500));
  }
}
