import admin from 'firebase-admin';
import { config } from '../config.js';
import log from '../utils/logger.js';

if (!admin.apps?.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    log.info('Firebase Admin initialized successfully');
  } else if (config.isProd) {
    const missing = [
      !projectId && 'FIREBASE_PROJECT_ID',
      !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      !privateKey && 'FIREBASE_PRIVATE_KEY',
    ].filter(Boolean);
    log.error(`Firebase credentials missing: ${missing.join(', ')}. All Firebase routes will fail.`);
    process.exit(1);
  } else {
    log.warn('Firebase credentials not configured. Running without Firebase Admin in development. Firebase-dependent routes will fail.');
  }
}

export default admin;
