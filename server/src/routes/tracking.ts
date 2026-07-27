import express from 'express';
import { verifyAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';
import log from '../utils/logger.js';

const router = express.Router();

const ALLOWED_REDIRECT_HOSTS = ['localhost', '127.0.0.1'];

const isSafeRedirect = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (ALLOWED_REDIRECT_HOSTS.includes(hostname)) return true;
    // Allow the configured client URL
    const clientHost = new URL(config.clientUrl).hostname.toLowerCase();
    return hostname === clientHost;
  } catch {
    return false;
  }
};

let redis: any = null;
let useRedis = false;
const trackingInbox = new Map<string, any[]>();
const MAX_EVENTS_PER_USER = 500;
const INBOX_TTL = 24 * 60 * 60 * 1000;
const inboxTimestamps = new Map<string, number>();

const initRedis = async () => {
  if (config.redis.url) {
    try {
      const Redis = (await import('ioredis')).default;
      redis = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
      });
      redis.on('connect', () => {
        useRedis = true;
        log.info('Redis connected for tracking service');
      });
      redis.on('error', (err: Error) => {
        if (useRedis) {
          log.error('Redis error in tracking, falling back to in-memory', { error: err.message });
          useRedis = false;
        }
      });
    } catch {
      log.warn('Redis not available for tracking, using in-memory');
    }
  }
};
initRedis();

const storeEvent = async (userId: string, event: any) => {
  if (!userId) return;

  if (useRedis && redis) {
    try {
      const key = `tracking:${userId}`;
      await redis.rpush(key, JSON.stringify(event));
      await redis.expire(key, Math.floor(INBOX_TTL / 1000));
      // Trim to max size
      await redis.ltrim(key, -MAX_EVENTS_PER_USER, -1);
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  if (!trackingInbox.has(userId)) trackingInbox.set(userId, []);
  const events = trackingInbox.get(userId)!;
  events.push(event);
  if (events.length > MAX_EVENTS_PER_USER) {
    events.splice(0, events.length - MAX_EVENTS_PER_USER);
  }
  inboxTimestamps.set(userId, Date.now());
};

const cleanupInbox = () => {
  const now = Date.now();
  for (const [userId, timestamp] of inboxTimestamps.entries()) {
    if (now - timestamp > INBOX_TTL) {
      trackingInbox.delete(userId);
      inboxTimestamps.delete(userId);
    }
  }
};
const cleanupInterval = setInterval(cleanupInbox, 60 * 60 * 1000);
cleanupInterval.unref();

process.on('SIGTERM', () => clearInterval(cleanupInterval));
process.on('SIGINT', () => clearInterval(cleanupInterval));

const openSchema = z.object({
  uid: z.string().max(128).optional()
});

router.get('/open/:campaignId', validateRequest({ query: openSchema }), (req, res) => {
  const { campaignId } = req.params;
  const { uid } = req.query as { uid?: string };

  if (!uid || uid.length > 128) {
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': pixel.length });
    return res.end(pixel);
  }

  storeEvent(uid, {
    campaignId,
    event: 'open',
    timestamp: new Date().toISOString(),
  });

  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': pixel.length });
  res.end(pixel);
});

const clickSchema = z.object({
  url: z.string().url().optional(),
  uid: z.string().max(128).optional()
});

router.get('/click/:campaignId', validateRequest({ query: clickSchema }), (req, res) => {
  const { campaignId } = req.params;
  const { url, uid } = req.query as { url?: string, uid?: string };

  if (uid && uid.length <= 128) {
    storeEvent(uid, {
      campaignId,
      event: 'click',
      url: url || '',
      timestamp: new Date().toISOString(),
    });
  }

  const safeUrl = url && isSafeRedirect(url) ? url : `${config.clientUrl}/dashboard/meetings`;
  res.redirect(safeUrl);
});

const pullEvents = async (userId: string): Promise<any[]> => {
  if (useRedis && redis) {
    try {
      const key = `tracking:${userId}`;
      const events = await redis.lrange(key, 0, -1);
      await redis.del(key);
      return events.map((e: string) => JSON.parse(e));
    } catch {
      // Fall through to in-memory
    }
  }
  const events = trackingInbox.get(userId) || [];
  trackingInbox.delete(userId);
  return events;
};

router.get('/events', verifyAuth, async (req, res) => {
  const userId = req.user.uid;
  const events = await pullEvents(userId);
  res.status(200).json({ status: 'success', events });
});

router.get('/events/:campaignId', verifyAuth, async (req, res) => {
  const userId = req.user.uid;
  const { campaignId } = req.params;
  const allEvents = await pullEvents(userId);
  const events = allEvents.filter((e) => e.campaignId === campaignId);
  res.status(200).json({ status: 'success', events });
});

export default router;
