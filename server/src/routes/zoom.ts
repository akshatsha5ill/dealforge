import express, { Request, Response } from 'express';
import { getFirebaseAuth, getFirebaseFirestore } from '../services/firebase-admin.js';
import crypto from 'crypto';
import https from 'https';
import bufferService from '../services/buffer-service.js';
import { verifyAuth, AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { AppError } from '../middleware/errorHandler.js';
import log from '../utils/logger.js';
import zoomRTMS from '../services/zoom-rtms.js';
import transcriptAnalysisPipeline from '../services/transcript-analysis-pipeline.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const router = express.Router();

const zoomStartSchema = z.object({
  redirect: z.string().optional(),
});

router.post('/oauth/start', verifyAuth, validateRequest({ body: zoomStartSchema }), (req: AuthRequest, res: Response): void => {
  const { clientId, redirectUri } = config.zoom;
  if (!clientId) {
    res.status(500).json({ error: 'Zoom OAuth not configured' });
    return;
  }

  const rawRedirect = (req.body as { redirect?: string }).redirect;
  if (rawRedirect) {
    try {
      const parsed = new URL(rawRedirect);
      const allowedHosts = new Set([new URL(config.clientUrl).hostname, 'localhost', '127.0.0.1']);
      if (!allowedHosts.has(parsed.hostname)) {
        res.status(400).json({ error: 'Invalid redirect URL' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Invalid redirect URL' });
      return;
    }
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'meeting:read:admin meeting:write user:read',
    state: encrypt(JSON.stringify({ uid: req.user!.uid, redirect: rawRedirect })),
  });
  res.status(200).json({ url: `https://zoom.us/oauth/authorize?${params.toString()}` });
});

router.get('/oauth/status', verifyAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  try {
    const doc = await getFirebaseFirestore().collection('users').doc(uid).get();
    const data = doc.data();
    res.status(200).json({
      linked: !!data?.zoomLinked,
      zoomUserId: data?.zoomUserId || null,
    });
  } catch (err) {
    log.error('Failed to fetch zoom link status', { error: err, uid });
    res.status(500).json({ error: 'Failed to fetch zoom link status' });
  }
});

router.get('/oauth/callback', async (req: Request, res: Response, next: express.NextFunction): Promise<unknown> => {
  const { code, state } = req.query;
  if (!code) {
    return next(new AppError('Missing authorization code', 400));
  }

  // Identify the user either from the state param (browser redirect flow) or an auth header
  let stateUid: string | null = null;
  let stateRedirect: string | undefined;
  if (typeof state === 'string' && state) {
    try {
      const parsed = JSON.parse(decrypt(state)) as { uid?: string; redirect?: string };
      stateUid = parsed.uid || null;
      stateRedirect = parsed.redirect;
    } catch {
      return next(new AppError('Invalid OAuth state', 400));
    }
  }

  const { clientId, clientSecret, redirectUri } = config.zoom;
  if (!clientId || !clientSecret) {
    return next(new AppError('Zoom OAuth not configured', 500));
  }

  try {
    const tokenRes: Record<string, unknown> = await new Promise((resolve, reject) => {
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
      return next(new AppError((tokenRes.reason || tokenRes.error) as string, 400));
    }

    // Persist tokens to the user's Firestore document
    const authHeader = req.headers.authorization;
    let uid: string | null = stateUid;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await getFirebaseAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch {
        // fall through to state-based uid
      }
    }

    if (uid) {
      await getFirebaseFirestore().collection('users').doc(uid).set({
        zoomLinked: true,
        zoomAccessToken: tokenRes.access_token,
        zoomRefreshToken: tokenRes.refresh_token,
        zoomTokenExpiresAt: tokenRes.expires_in
          ? Date.now() + (tokenRes.expires_in as number) * 1000
          : null,
      }, { merge: true });
    }

    // Browser redirect flow: send the user back to the client
    if (stateUid) {
      const base = stateRedirect || `${config.clientUrl}/settings`;
      const sep = base.includes('?') ? '&' : '?';
      return res.redirect(302, `${base}${sep}zoom_linked=true`);
    }

    return res.json({
      status: 'success',
      expires_in: tokenRes.expires_in,
    });
  } catch (err) {
    return next(new AppError('Token exchange failed', 500));
  }
});

router.post('/webhook', async (req: Request, res: Response, next: express.NextFunction): Promise<unknown> => {
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
      res.status(200).json({
        plainToken: payload.plainToken,
        encryptedToken: hashForValidate
      });
      return;
    }
    case 'meeting.started': {
      const meetingId = payload?.object?.id;
      const topic = payload?.object?.topic || 'Untitled Meeting';
      if (meetingId) {
        await bufferService.store(`meeting:${meetingId}`, { 
          startedAt: new Date().toISOString(), 
          status: 'active',
          topic 
        });

        // Establish RTMS connection for real-time transcription
        const rtmsConnected = await zoomRTMS.connectToMeeting(meetingId, topic);
        if (rtmsConnected) {
          log.info('RTMS connection established for meeting', { meetingId, topic });
        } else {
          log.warn('Failed to establish RTMS connection, falling back to manual transcription', { meetingId });
        }

        // Start transcript analysis pipeline
        const io = req.app.get('io');
        if (io) {
          transcriptAnalysisPipeline.initialize(io);
        }
        transcriptAnalysisPipeline.startPipeline(meetingId);
        log.info('Transcript analysis pipeline started for meeting', { meetingId });
      }
      break;
    }
    case 'meeting.ended': {
      const meetingId = payload?.object?.id;
      if (meetingId) {
        // Stop transcript analysis pipeline
        transcriptAnalysisPipeline.stopPipeline(meetingId);
        log.info('Transcript analysis pipeline stopped for meeting', { meetingId });

        // Disconnect from RTMS
        await zoomRTMS.disconnectFromMeeting(meetingId);

        const data = await bufferService.get<Record<string, unknown>>(`meeting:${meetingId}`);
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
        const existing = (await bufferService.get<{ participants: Array<Record<string, unknown>> }>(key)) || { participants: [] };
        if (!existing.participants.find((p) => p.user_id === participant.user_id || p.user_name === participant.user_name)) {
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

router.post('/deauth', async (req: Request, res: Response, next: express.NextFunction): Promise<unknown> => {
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
      const snapshot = await getFirebaseFirestore().collection('users').where('zoomUserId', '==', userId).get();
      const promises: Promise<unknown>[] = [];
      snapshot.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        promises.push(doc.ref.update({ 
          zoomLinked: false, 
          zoomUserId: FirebaseFirestore.FieldValue.delete(),
          zoomAccessToken: FirebaseFirestore.FieldValue.delete(),
          zoomRefreshToken: FirebaseFirestore.FieldValue.delete()
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

router.post('/transcription', verifyAuth, validateRequest({ body: transcriptionSchema }), async (req: AuthRequest, res: Response, next: express.NextFunction): Promise<void> => {
  const { meetingId, segment } = req.body;

  // Normalize segment to ensure consistent format
  const normalizedSegment = {
    id: segment.id || `transcript-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    speaker: segment.speaker || 'Unknown Speaker',
    text: segment.text,
    startTime: segment.startTime,
    endTime: segment.endTime,
    timestamp: new Date().toISOString(),
    source: segment.source || 'manual'
  };

  const key = `transcript:${meetingId}`;
  const existing = (await bufferService.get<{ segments: Array<Record<string, unknown>> }>(key)) || { segments: [] };
  existing.segments.push(normalizedSegment);
  await bufferService.store(key, existing);

  const io = req.app.get('io');
  if (io) {
    io.to(`meeting:${meetingId}`).emit('transcription', normalizedSegment);
    log.info('Transcription segment stored and broadcast', { meetingId, source: normalizedSegment.source });
  }

  // Check if we should trigger analysis based on segment count
  const segmentCount = existing.segments.length;
  if (segmentCount > 0 && segmentCount % 10 === 0) {
    // Trigger analysis every 10 segments for more responsive suggestions
    log.info('Triggering transcript analysis based on segment count', { meetingId, segmentCount });
  }

  res.status(200).json({ status: 'ok', segmentId: normalizedSegment.id });
});

const notesSchema = z.object({
  meetingId: z.string().min(1),
  note: z.any()
});

router.post('/notes', verifyAuth, validateRequest({ body: notesSchema }), async (req: AuthRequest, res: Response, next: express.NextFunction): Promise<void> => {
  const { meetingId, note } = req.body;

  const key = `notes:${meetingId}`;
  const existing = (await bufferService.get<{ notes: Array<Record<string, unknown>> }>(key)) || { notes: [] };
  existing.notes.push({ ...note, receivedAt: new Date().toISOString() });
  await bufferService.store(key, existing);

  res.status(200).json({ status: 'ok' });
});

router.get('/buffer/:meetingId', verifyAuth, async (req: AuthRequest, res: Response) => {
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

router.delete('/buffer/:meetingId', verifyAuth, async (req: AuthRequest, res: Response) => {
  const meetingId = req.params.meetingId;
  await bufferService.delete(`transcript:${meetingId}`);
  await bufferService.delete(`notes:${meetingId}`);
  await bufferService.delete(`meeting:${meetingId}`);
  await bufferService.delete(`participants:${meetingId}`);

  res.status(200).json({ status: 'cleared' });
});

router.get('/rtms/status', verifyAuth, async (req: AuthRequest, res: Response) => {
  const connectedMeetings = zoomRTMS.getConnectedMeetingIds();
  res.status(200).json({ 
    connectedMeetings,
    isConnected: connectedMeetings.length > 0
  });
});

router.get('/pipeline/status', verifyAuth, async (req: AuthRequest, res: Response) => {
  const activePipelines = transcriptAnalysisPipeline.getActivePipelines();
  res.status(200).json({
    activePipelines,
    activeCount: activePipelines.length
  });
});

export default router;
