import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from '../config.js';
import log from '../utils/logger.js';

let app: App | undefined;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Automatically fix common copy-paste errors: remove surrounding quotes and fix newlines
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
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
} else {
  app = getApps()[0];
}

export function getFirebaseAuth() {
  return getAuth(app);
}

export function getFirebaseFirestore() {
  return getFirestore(app!);
}

export { app, getApps };
