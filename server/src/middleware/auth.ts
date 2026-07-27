import { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth } from '../services/firebase-admin.js';
import log from '../utils/logger.js';

export interface AuthRequest extends Request {
  user?: { uid: string; email?: string; [key: string]: unknown };
}

const verifyAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await getFirebaseAuth().verifyIdToken(token, true);
    req.user = decodedToken;
    next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Token verification failed', { error: message });
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export { verifyAuth };
