import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getFirebaseApp(): App {
  const existing = getApps().find(app => app.name === 'nova-campus-auth-admin');
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, 'nova-campus-auth-admin');
}

export function firebaseAdmin() {
  const app = getFirebaseApp();
  return { app, auth: getAuth(app) };
}
