import { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';
import { getFirebaseConfig } from './firebaseConfig';

let appCheckInitialized = false;

/**
 * Initialize Firebase App Check for Chrome Extension MV3 contexts.
 * Sets `FIREBASE_APPCHECK_DEBUG_TOKEN` before `initializeAppCheck` so the SDK
 * automatically exchanges the registered debug UUID for a valid signed App Check JWT
 * via `exchangeDebugToken` (avoiding external reCAPTCHA scripts blocked by MV3 CSP).
 */
export const initAppCheck = (app: FirebaseApp): void => {
  if (appCheckInitialized) return;

  const config = getFirebaseConfig();
  const debugToken = config.appCheckDebugToken?.trim();

  if (debugToken) {
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    if (typeof self !== 'undefined') {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    if (typeof window !== 'undefined') {
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
  }

  try {
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => ({
          token: debugToken || 'dev-debug-token-recare-hackathon',
          expireTimeMillis: Date.now() + 60 * 60 * 1000,
        }),
      }),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
  } catch (err) {
    console.info('[Recare] App Check initialization note:', err);
  }
};
