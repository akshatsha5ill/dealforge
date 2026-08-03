import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import authRoutes from './routes/auth.js';
import zoomRoutes from './routes/zoom.js';
import aiRoutes from './routes/ai.js';
import emailRoutes from './routes/email.js';
import emailOAuthRoutes from './routes/email-oauth.js';
import trackingRoutes from './routes/tracking.js';
import billingRoutes from './routes/billing.js';
import referralRoutes from './routes/referrals.js';
import apiKeyRoutes from './routes/api-keys.js';
import syncRoutes from './routes/sync.js';
import publicApiRoutes from './routes/public-api.js';
import { verifyAuth } from './middleware/auth.js';
import { requirePlan } from './middleware/plan.js';
import requestId from './middleware/requestId.js';
import sanitize from './middleware/sanitize.js';
import { errorHandler } from './middleware/errorHandler.js';
import log from './utils/logger.js';
import { config } from './config.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (config.isProd && process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}

const app = express();

const allowedOrigin = config.clientUrl || 'http://localhost:5173';

app.use(helmet({
  contentSecurityPolicy: config.isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://appssdk.zoom.us"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "wss:", "ws:", allowedOrigin],
      imgSrc: ["'self'", "data:", "https:"]
    }
  } : false
}));
app.use(requestId);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());

app.use(express.json({ limit: '100kb' }));
app.use(sanitize);
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, please try again later.' }
});

const trackingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking requests' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded. Please wait before making another request.' }
});

const emailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Email rate limit exceeded. Please wait before sending another email.' }
});

const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many billing requests, please try again later.' }
});

const referralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many referral requests, please try again later.' }
});

const apiKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many API key requests, please try again later.' }
});

const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Sync rate limit exceeded. Please wait before syncing again.' }
});

const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers['x-api-key'] as string) || req.ip || 'unknown',
  message: { error: 'API rate limit exceeded. Please slow down your requests.' }
});

const requestLogger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log.info('Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: (req as any).requestId,
    });
  });
  next();
};
app.use(requestLogger);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/zoom', zoomRoutes);
app.use('/api/billing', verifyAuth, billingLimiter, billingRoutes);
app.use('/api/referrals', verifyAuth, referralLimiter, referralRoutes);
app.use('/api/tracking', trackingLimiter, trackingRoutes);
app.use('/api/ai', verifyAuth, aiLimiter, aiRoutes);
app.use('/api/email/oauth', billingLimiter, emailOAuthRoutes);
app.use('/api/email', verifyAuth, requirePlan('pro'), emailLimiter, emailRoutes);
app.use('/api/api-keys', verifyAuth, apiKeyLimiter, apiKeyRoutes);
app.use('/api/sync', verifyAuth, requirePlan('pro'), syncLimiter, syncRoutes);
app.use('/api/v1', publicApiLimiter, publicApiRoutes);

app.get('/api', (req, res) => {
  res.status(200).json({ message: 'API is running', version: '1.0.0' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

app.get('/api/docs', (req, res) => {
  fs.readFile(path.join(__dirname, 'swagger.json'), 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: 'Swagger doc not generated yet' });
    }
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse Swagger doc' });
    }
  });
});

app.get('/zoomverify/verifyzoom.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(process.env.ZOOM_VERIFY_TOKEN || 'zoomverify token not configured');
});

if (config.isProd && process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

export { app };
