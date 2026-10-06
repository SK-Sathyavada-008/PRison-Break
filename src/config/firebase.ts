// ─────────────────────────────────────────────
// Firebase Configuration Module
// ─────────────────────────────────────────────

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Firebase configuration object read strictly from environment variables.
 * Values are populated from .env file (VITE_FIREBASE_*).
 */
const env = (typeof import.meta !== 'undefined' && (import.meta as any).env)
  ? (import.meta as any).env
  : ((globalThis as any).process?.env || {});

export const firebaseConfig = {
  apiKey: env?.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env?.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env?.VITE_FIREBASE_APP_ID ?? '',
  measurementId: env?.VITE_FIREBASE_MEASUREMENT_ID ?? '',
};

/**
 * Checks whether Firebase has been configured with real project credentials.
 */
export function isFirebaseConfigured(): boolean {
  const { apiKey, projectId } = firebaseConfig;
  return Boolean(
    apiKey &&
    projectId &&
    apiKey !== 'YOUR_API_KEY' &&
    projectId !== 'YOUR_PROJECT_ID' &&
    !apiKey.startsWith('demo-')
  );
}

// Initialize Firebase App singleton safely
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

try {
  if (!getApps().length) {
    app = initializeApp(
      isFirebaseConfigured()
        ? firebaseConfig
        : {
            // Safe fallback configuration so the client doesn't crash prior to setting env vars
            apiKey: 'AIzaSyPlaceholderForPRisonBreakDevMode',
            authDomain: 'prison-break-placeholder.firebaseapp.com',
            projectId: 'prison-break-placeholder',
            storageBucket: 'prison-break-placeholder.appspot.com',
            messagingSenderId: '123456789012',
            appId: '1:123456789012:web:abcdef1234567890',
          }
    );
  } else {
    app = getApp();
  }

  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.warn('[Firebase] Initialization warning:', error);
  // Re-assign empty instances if fallback fails
  app = (getApps()[0] as FirebaseApp) ?? ({} as FirebaseApp);
  db = {} as Firestore;
  auth = {} as Auth;
}

export { app, db, auth };
