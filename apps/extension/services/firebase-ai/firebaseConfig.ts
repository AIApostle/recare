export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  appCheckDebugToken?: string;
}

export const getFirebaseConfig = (): FirebaseConfig => {
  const env = (import.meta as any).env || {};
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyFakeDevKeyForTesting123456789',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'recare-assistant.firebaseapp.com',
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'recare-assistant',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'recare-assistant.firebasestorage.app',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '102938475612',
    appId: env.VITE_FIREBASE_APP_ID || '1:102938475612:web:abcdef1234567890',
    appCheckDebugToken: env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || 'dev-debug-token-recare-hackathon',
  };
};
