import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: any;
let auth: any;

try {
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase configuration is missing.');
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (error) {
  console.warn('Running without Firebase:', error);
  // Provide a dummy auth object to prevent the app from crashing entirely
  auth = {
    onAuthStateChanged: (cb: any) => { cb(null); return () => {}; },
    currentUser: null,
    signInWithEmailAndPassword: async () => { throw new Error('Firebase not configured'); },
    createUserWithEmailAndPassword: async () => { throw new Error('Firebase not configured'); },
    signOut: async () => {}
  };
}

export { auth };
export default app;
