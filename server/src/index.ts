process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

import http from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import bufferService from './services/buffer-service.js';
import log from './utils/logger.js';
import { config } from './config.js';
import admin from './services/firebase-admin.js';

const server = http.createServer(app);

const allowedOrigin = config.clientUrl || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  }
});

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

const port = config.port;

server.listen(port, () => {
  log.info(`Server listening on port ${port}`);
});

export { app, server, io };
