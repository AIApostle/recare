import { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';
import { getFirebaseConfig } from './firebaseConfig';

let appCheckInitialized = false;

/**
 * Initialize Firebase App Check for Chrome Extension & Hybrid Web contexts.
 * In development and hackathon testing, uses a custom debug token provider.
 */
export const initAppCheck = (app: FirebaseApp): void => {
  if (appCheckInitialized) return;

  const config = getFirebaseConfig();
  const debugToken = config.appCheckDebugToken || 'dev-debug-token-recare-hackathon';

  try {
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => {
          return {
            token: debugToken,
            expireTimeMillis: Date.now() + 60 * 60 * 1000,
          };
        },
      }),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
    console.log('[Recare] Firebase App Check initialized successfully (Debug Provider).');
  } catch (err) {
    console.warn('[Recare] App Check initialization note:', err);
  }
};
