import express, { Request, Response } from 'express';
import admin from '../services/firebase-admin.js';
import crypto from 'crypto';
import https from 'https';
import bufferService from '../services/buffer-service.js';
import { verifyAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { AppError } from '../middleware/errorHandler.js';
import log from '../utils/logger.js';

const router = express.Router();

router.get('/oauth/callback', async (req: Request, res: Response, next: express.NextFunction): Promise<any> => {
  const { code } = req.query;
  if (!code) {
    return next(new AppError('Missing authorization code', 400));
  }

  const { clientId, clientSecret, redirectUri } = config.zoom;
  if (!clientId || !clientSecret) {
    return next(new AppError('Zoom OAuth not configured', 500));
  }

  try {
    const tokenRes: any = await new Promise((resolve, reject) => {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }).toString();

      const reqOpts = {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const request = https.request('https://zoom.us/oauth/token', reqOpts, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Failed to parse token response')); }
        });
      });
      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Zoom token exchange timed out'));
      });
      request.write(body);
      request.end();
    });

    if (tokenRes.error) {
      return next(new AppError(tokenRes.reason || tokenRes.error, 400));
    }

    // Persist tokens to the authenticated user's Firestore document
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        await admin.firestore().collection('users').doc(decoded.uid).set({
          zoomLinked: true,
          zoomAccessToken: tokenRes.access_token,
          zoomRefreshToken: tokenRes.refresh_token,
          zoomTokenExpiresAt: tokenRes.expires_in
            ? Date.now() + tokenRes.expires_in * 1000
            : null,
        }, { merge: true });
      } catch {
        // Token exchange succeeded but persistence failed — still return the token info
      }
    }

    return res.json({
      status: 'success',
      expires_in: tokenRes.expires_in,
    });
  } catch (err) {
    return next(new AppError('Token exchange failed', 500));
  }
});

router.post('/webhook', async (req: Request, res: Response, next: express.NextFunction): Promise<any> => {
  const { event, payload } = req.body;
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || config.zoom.webhookSecretToken;

  if (!secret) {
     return next(new AppError('Server configuration error', 500));
  }

  const zoomSignature = req.headers['x-zm-signature'] as string;
  const zoomTimestamp = req.headers['x-zm-request-timestamp'] as string;

  if (!zoomSignature || !zoomTimestamp) {
    return next(new AppError('Unauthorized: Missing signature', 401));
  }

  const message = `v0:${zoomTimestamp}:${JSON.stringify(req.body)}`;
  const hashForVerify = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const signature = `v0=${hashForVerify}`;

  const bufSig = Buffer.from(signature);
  const bufZoom = Buffer.from(zoomSignature);

  if (bufSig.length !== bufZoom.length || !crypto.timingSafeEqual(bufSig, bufZoom)) {
    return next(new AppError('Unauthorized: Invalid signature', 401));
  }

  switch (event) {
    case 'endpoint.url_validation': {
      const hashForValidate = crypto.createHmac('sha256', secret).update(payload.plainToken).digest('hex');
      return res.status(200).json({
        plainToken: payload.plainToken,
        encryptedToken: hashForValidate
      });
    }
    case 'meeting.started': {
      const meetingId = payload?.object?.id;
      if (meetingId) {
        await bufferService.store(`meeting:${meetingId}`, { startedAt: new Date().toISOString(), status: 'active' });
      }
      break;
    }
    case 'meeting.ended': {
      const meetingId = payload?.object?.id;
      if (meetingId) {
        const data = await bufferService.get<any>(`meeting:${meetingId}`);
        if (data) {
          data.endedAt = new Date().toISOString();
          data.status = 'completed';
          await bufferService.store(`meeting:${meetingId}`, data);
        }
        const io = req.app.get('io');
        if (io) {
          io.to(`meeting:${meetingId}`).emit('meeting_ended', { meetingId });
          io.emit('meeting_ended', { meetingId });
        }
      }
      break;
    }
    case 'meeting.participant_joined': {
      const meetingId = payload?.object?.id;
      const participant = payload?.object?.participant;
      if (meetingId && participant) {
        const key = `participants:${meetingId}`;
        const existing = (await bufferService.get<any>(key)) || { participants: [] };
        if (!existing.participants.find((p: any) => p.user_id === participant.user_id || p.user_name === participant.user_name)) {
          existing.participants.push(participant);
          await bufferService.store(key, existing);
        }

        const io = req.app.get('io');
        if (io) {
          io.to(`meeting:${meetingId}`).emit('participant_joined', { meetingId, participant });
          io.emit('participant_joined', { meetingId, participant });
        }
      }
      break;
    }
  }

  return res.status(200).json({ status: 'ok' });
});

router.post('/deauth', async (req: Request, res: Response, next: express.NextFunction): Promise<any> => {
  const { payload } = req.body;
  const secret = config.zoom.webhookSecretToken;

  if (!secret) {
     return next(new AppError('Server configuration error', 500));
  }

  const zoomSignature = req.headers['x-zm-signature'] as string;
  const zoomTimestamp = req.headers['x-zm-request-timestamp'] as string;

  if (!zoomSignature || !zoomTimestamp) {
    return next(new AppError('Unauthorized: Missing signature', 401));
  }

  const message = `v0:${zoomTimestamp}:${JSON.stringify(req.body)}`;
  const hashForVerify = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const signature = `v0=${hashForVerify}`;

  const bufSig = Buffer.from(signature);
  const bufZoom = Buffer.from(zoomSignature);

  if (bufSig.length !== bufZoom.length || !crypto.timingSafeEqual(bufSig, bufZoom)) {
    return next(new AppError('Unauthorized: Invalid signature', 401));
  }

  const userId = payload?.user_id;
  const accountId = payload?.account_id;
  
  log.info(`Deauth event received for user ${userId}, account ${accountId}`);
  
  if (userId) {
    try {
      const snapshot = await admin.firestore().collection('users').where('zoomUserId', '==', userId).get();
      const promises: any[] = [];
      snapshot.forEach(doc => {
        promises.push(doc.ref.update({ 
          zoomLinked: false, 
          zoomUserId: admin.firestore.FieldValue.delete(),
          zoomAccessToken: admin.firestore.FieldValue.delete(),
          zoomRefreshToken: admin.firestore.FieldValue.delete()
        }));
      });
      await Promise.all(promises);
    } catch (err) {
      log.error('Failed to clean up user on deauth', { error: err });
    }
  }
  
  return res.status(200).json({ status: 'ok' });
});

const transcriptionSchema = z.object({
  meetingId: z.string().min(1),
  segment: z.any()
});

router.post('/transcription', verifyAuth, validateRequest({ body: transcriptionSchema }), async (req: Request, res: Response, next: express.NextFunction): Promise<any> => {
  const { meetingId, segment } = req.body;

  const key = `transcript:${meetingId}`;
  const existing = (await bufferService.get<any>(key)) || { segments: [] };
  existing.segments.push(segment);
  await bufferService.store(key, existing);

  const io = req.app.get('io');
  if (io) {
    io.to(`meeting:${meetingId}`).emit('transcription', segment);
  }

  return res.status(200).json({ status: 'ok' });
});

const notesSchema = z.object({
  meetingId: z.string().min(1),
  note: z.any()
});

router.post('/notes', verifyAuth, validateRequest({ body: notesSchema }), async (req: Request, res: Response, next: express.NextFunction): Promise<any> => {
  const { meetingId, note } = req.body;

  const key = `notes:${meetingId}`;
  const existing = (await bufferService.get<any>(key)) || { notes: [] };
  existing.notes.push({ ...note, receivedAt: new Date().toISOString() });
  await bufferService.store(key, existing);

  return res.status(200).json({ status: 'ok' });
});

router.get('/buffer/:meetingId', verifyAuth, async (req: Request, res: Response) => {
  const { meetingId } = req.params;
  const transcript = await bufferService.get(`transcript:${meetingId}`);
  const notes = await bufferService.get(`notes:${meetingId}`);
  const meetingData = await bufferService.get(`meeting:${meetingId}`);
  const participants = await bufferService.get(`participants:${meetingId}`);

  res.status(200).json({
    transcript: transcript || null,
    notes: notes || null,
    meeting: meetingData || null,
    participants: participants || null,
  });
});

router.delete('/buffer/:meetingId', verifyAuth, async (req: Request, res: Response) => {
  const { meetingId } = req.params;
  await bufferService.delete(`transcript:${meetingId}`);
  await bufferService.delete(`notes:${meetingId}`);
  await bufferService.delete(`meeting:${meetingId}`);
  await bufferService.delete(`participants:${meetingId}`);

  res.status(200).json({ status: 'cleared' });
});

export default router;
