import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendDraft } from '../services/email-service.js';
import { AIFactory } from '../services/ai-providers.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: { uid: string };
}

const sendSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  campaignId: z.string().optional(),
  emailApiKey: z.string().min(1, "Missing Email API key")
});

export const validateRequest = (schema: { body: any }) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }
    next();
  } catch (err: any) {
    if (err instanceof z.ZodError) {
        return next(new AppError('invalid input', 400));
    }
    next(err);
  }
};


router.post(
  '/send', 
  validateRequest({ body: sendSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { to, subject, body, campaignId } = req.body;
      const emailApiKey = req.body.emailApiKey;
      delete req.body.emailApiKey;
      const uid = req.user?.uid;
      
      let finalBody = body;
      
      if (campaignId && uid) {
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const host = req.get('host');
        const trackingBase = `${protocol}://${host}/api/tracking`;
        
        finalBody = finalBody.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi, (match: string, url: string, rest: string) => {
          if (url.startsWith('http')) {
            const wrapped = `${trackingBase}/click/${campaignId}?uid=${uid}&url=${encodeURIComponent(url)}`;
            return `<a href="${wrapped}"${rest}>`;
          }
          return match;
        });
        
        const pixel = `<img src="${trackingBase}/open/${campaignId}?uid=${uid}" width="1" height="1" style="display:none;" />`;
        finalBody = `${finalBody}${pixel}`;
      }
      
      const data = await sendDraft(to, subject, finalBody, { apiKey: emailApiKey });
      return res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  }
);

const draftSchema = z.object({
  transcript: z.string({ required_error: "invalid input" }).min(10, "invalid input").max(100000, "invalid input"),
  leadContext: z.record(z.any()).optional(),
  model: z.enum(['openai', 'anthropic', 'gemini']).optional(),
  apiKey: z.string({ required_error: "invalid input" }).min(1, "invalid input")
});

router.post(
  '/draft',
  validateRequest({ body: draftSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { transcript, leadContext, model } = req.body;
      const apiKey = req.body.apiKey;
      // Securely drop API key from memory/request object immediately
      delete req.body.apiKey;

      const uid = req.user?.uid;
      
      if (!uid) {
        throw new AppError('Unauthorized', 401);
      }

      const effectiveModel = model || 'openai';
      const provider = AIFactory.getProvider(effectiveModel, apiKey);

      if (!provider.generateEmailDraft) {
        throw new AppError('Email drafting not supported for this provider yet.', 501);
      }

      const draft = await provider.generateEmailDraft(transcript, leadContext || {});
      return res.status(200).json({ status: 'success', draft });
    } catch (error: any) {
      if (error.message && error.message.includes('API key')) {
        return next(new AppError(error.message, 400));
      }
      next(error);
    }
  }
);

router.get('/oauth/:provider', (req: Request, res: Response) => {
  const provider = req.params.provider;
  const redirectUrl = req.query.redirect as string || 'http://localhost:5173/settings';
  
  // In a real implementation, this would redirect to Google/Microsoft OAuth URL
  // Here we simulate the successful OAuth callback by redirecting back with success params
  const email = `user@${provider === 'gmail' ? 'gmail.com' : 'outlook.com'}`;
  const callbackUrl = new URL(redirectUrl);
  callbackUrl.searchParams.set('oauth_success', 'true');
  callbackUrl.searchParams.set('provider', provider);
  callbackUrl.searchParams.set('email', email);
  
  res.redirect(302, callbackUrl.toString());
});

export default router;
