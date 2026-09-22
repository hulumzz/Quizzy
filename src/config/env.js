const read = (key) => (import.meta.env[key] || '').trim();

export const appEnv = Object.freeze({
  apiUrl: read('VITE_API_URL').replace(/\/$/, ''),
  firebase: Object.freeze({
    apiKey: read('VITE_FIREBASE_API_KEY'),
    authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
    databaseURL: read('VITE_FIREBASE_DATABASE_URL'),
    projectId: read('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: read('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: read('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: read('VITE_FIREBASE_APP_ID'),
    measurementId: read('VITE_FIREBASE_MEASUREMENT_ID'),
  }),
});

export const hasFirebaseConfig = Boolean(appEnv.firebase.apiKey && appEnv.firebase.authDomain && appEnv.firebase.projectId && appEnv.firebase.appId);
