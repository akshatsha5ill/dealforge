import express from 'express';
import http from 'http';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import zoomRoutes from './routes/zoom.js';
import aiRoutes from './routes/ai.js';
import emailRoutes from './routes/email.js';
import trackingRoutes from './routes/tracking.js';
import billingRoutes from './routes/billing.js';
import { verifyAuth } from './middleware/auth.js';
import requestId from './middleware/requestId.js';
import sanitize from './middleware/sanitize.js';
import { errorHandler } from './middleware/errorHandler.js';
import bufferService from './services/buffer-service.js';
import log from './utils/logger.js';
import { config } from './config.js';
import admin from './services/firebase-admin.js';

const app = express();
const server = http.createServer(app);

const allowedOrigin = config.clientUrl || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  }
});

const port = config.port;

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

// Stripe webhook needs raw body before JSON parser
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '100kb' }));
app.use(sanitize);
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, please try again later.' }
});

const trackingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // limit each IP to 300 tracking requests per windowMs
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
app.use('/api/tracking', trackingLimiter, trackingRoutes);
app.use('/api/billing', billingRoutes);

app.use('/api/ai', verifyAuth, aiLimiter, aiRoutes);
app.use('/api/email', verifyAuth, emailLimiter, emailRoutes);

app.get('/api', (req, res) => {
  res.status(200).json({ message: 'API is running', version: '1.0.0' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.use(errorHandler);

app.set('io', io);

io.use((socket: any, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  admin.auth().verifyIdToken(token, true)
    .then((decodedToken) => {
      socket.user = decodedToken;
      next();
    })
    .catch((err) => {
      next(new Error('Authentication error'));
    });
});

io.on('connection', (socket: any) => {
  log.info('Client connected', { socketId: socket.id, uid: socket.user.uid });

  socket.on('join_meeting', (meetingId: string) => {
    socket.join(`meeting:${meetingId}`);
    log.info('Socket joined meeting room', { socketId: socket.id, meetingId, uid: socket.user.uid });
  });

  socket.on('save_note', (note: any) => {
    log.info('Note received via WS', { socketId: socket.id, uid: socket.user.uid });
  });

  socket.on('disconnect', () => {
    log.info('Client disconnected', { socketId: socket.id, uid: socket.user.uid });
  });
});

const gracefulShutdown = (signal: string) => {
  log.info(`${signal} received. Shutting down gracefully...`);
  bufferService.shutdown();
  server.close(() => {
    log.info('Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(port, () => {
  log.info(`Server listening on port ${port}`);
});

export { app, server, io };
