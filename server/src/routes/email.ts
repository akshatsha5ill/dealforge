import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendDraft, sendViaGmail, sendViaOutlook } from '../services/email-service.js';
import { getValidAccessToken } from '../services/email-oauth.js';
import { AIFactory } from '../services/ai-providers.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';

// Re-export for any existing imports
export { validateRequest } from '../middleware/validateRequest.js';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: { uid: string };
}

const sendSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  campaignId: z.string().optional(),
  emailApiKey: z.string().min(1, "Missing Email API key").optional(),
  via: z.enum(['resend', 'gmail', 'outlook']).optional(),
});


router.post(
  '/send', 
  validateRequest({ body: sendSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { to, subject, body, campaignId, via = 'resend' } = req.body;
      const emailApiKey = req.body.emailApiKey;
      delete req.body.emailApiKey;
      delete req.body.via;
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

      let data;
      if (via === 'gmail' || via === 'outlook') {
        if (!uid) {
          throw new AppError('Unauthorized', 401);
        }
        const { accessToken } = await getValidAccessToken(uid, via);
        data = via === 'gmail'
          ? await sendViaGmail(accessToken, to, subject, finalBody)
          : await sendViaOutlook(accessToken, to, subject, finalBody);
      } else {
        data = await sendDraft(to, subject, finalBody, { apiKey: emailApiKey });
      }
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

export default router;
