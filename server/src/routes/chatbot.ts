import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';
import {
  createSession,
  getSession,
  endSession,
  processSegments,
  getDrafts,
  approveDraft,
  getCollectedEmails,
  collectEmailsFromSegments,
  generateFollowUps,
  type ChatSegment,
} from '../services/chat-engine.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: { uid: string };
}

const chunkSchema = z.object({
  text: z.string().min(1),
  embedding: z.array(z.number()),
});

const knowledgeChunksSchema = z.array(chunkSchema).max(200);

const startSessionSchema = z.object({
  sessionId: z.string().min(1).max(200),
  meetingId: z.string().min(1).max(200),
  companyName: z.string().min(1).max(200),
  knowledgeChunks: knowledgeChunksSchema,
  apiKey: z.string().min(1, 'Missing API key'),
});

const segmentSchema = z.object({
  speaker: z.string().min(1).max(200),
  text: z.string().min(1).max(5000),
  timestamp: z.string().min(1),
});

const segmentsSchema = z.object({
  sessionId: z.string().min(1).max(200),
  segments: z.array(segmentSchema).min(1).max(100),
  apiKey: z.string().min(1, 'Missing API key'),
});

const endSessionSchema = z.object({
  sessionId: z.string().min(1).max(200),
});

const generateFollowupsSchema = z.object({
  sessionId: z.string().min(1).max(200),
  attendees: z
    .array(
      z.object({
        email: z.string().min(1),
        name: z.string().min(1).optional().default(''),
        questions: z.array(z.string()).optional().default([]),
      }),
    )
    .min(1)
    .max(100),
  meetingTopic: z.string().min(1).max(500),
  companyName: z.string().min(1).max(200).optional(),
  apiKey: z.string().min(1, 'Missing API key'),
});

async function assertOwnership(req: AuthenticatedRequest, sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session || session.uid !== req.user?.uid) {
    throw new AppError('Chat session not found', 404);
  }
}

router.post(
  '/session/start',
  validateRequest({ body: startSessionSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { sessionId, meetingId, companyName, knowledgeChunks } = req.body;
      const apiKey = req.body.apiKey;
      delete req.body.apiKey;

      const uid = req.user?.uid;
      if (!uid) {
        throw new AppError('Unauthorized: Missing user information.', 401);
      }

      await createSession({ sessionId, meetingId, uid, knowledgeChunks, companyName, apiKey });

      return res.status(200).json({ status: 'success', sessionId });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/segments',
  validateRequest({ body: segmentsSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { sessionId, segments } = req.body;
      const apiKey = req.body.apiKey;
      delete req.body.apiKey;

      await assertOwnership(req, sessionId);

      const segmentsList: ChatSegment[] = segments;
      await collectEmailsFromSegments(sessionId, segmentsList);
      const drafts = await processSegments(sessionId, segmentsList, apiKey);

      return res.status(200).json({ status: 'success', drafts });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/session/end',
  validateRequest({ body: endSessionSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { sessionId } = req.body;
      await assertOwnership(req, sessionId);

      await endSession(sessionId);
      const drafts = await getDrafts(sessionId);
      const emails = await getCollectedEmails(sessionId);

      return res.status(200).json({ status: 'success', drafts: drafts.length, emails });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/drafts/:sessionId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { sessionId } = req.params;
      await assertOwnership(req, sessionId);
      const drafts = await getDrafts(sessionId);
      return res.status(200).json(drafts);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/approve/:sessionId/:draftId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { sessionId, draftId } = req.params;
      await assertOwnership(req, sessionId);
      await approveDraft(sessionId, draftId);
      return res.status(200).json({ status: 'success' });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/emails/:sessionId',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { sessionId } = req.params;
      await assertOwnership(req, sessionId);
      const emails = await getCollectedEmails(sessionId);
      return res.status(200).json(emails);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/generate-followups',
  validateRequest({ body: generateFollowupsSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { sessionId, attendees, meetingTopic } = req.body;
      const apiKey = req.body.apiKey;
      delete req.body.apiKey;

      await assertOwnership(req, sessionId);

      const drafts = await generateFollowUps({ sessionId, attendees, meetingTopic, apiKey });

      return res.status(200).json({ status: 'success', drafts });
    } catch (error) {
      next(error);
    }
  },
);

export default router;