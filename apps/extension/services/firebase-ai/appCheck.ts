import { FirebaseApp } from 'firebase/app';
import { getFirebaseConfig } from './firebaseConfig';

let appCheckInitialized = false;

/**
 * Initialize Firebase App Check for Chrome Extension & Hybrid Web contexts.
 * Sets the official debug token global. In extension contexts without a backend
 * token-minting server, avoids attaching unverified custom tokens that trigger 401s.
 */
export const initAppCheck = (app: FirebaseApp): void => {
  if (appCheckInitialized) return;

  const config = getFirebaseConfig();
  const debugToken = config.appCheckDebugToken;

  if (typeof self !== 'undefined' && debugToken) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }
  if (typeof window !== 'undefined' && debugToken) {
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  appCheckInitialized = true;
};
