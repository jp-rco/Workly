import { initializeApp, getApp, getApps } from 'firebase/app';
// @ts-ignore - Known TypeScript issue with Firebase v10/v11 where typings do not expose getReactNativePersistence
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded values as fallback — process.env can be undefined in production APK builds
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCyJ09wZm8Dd_PAnLGhculO-5utkCVZGEA',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'workly-9872e.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'workly-9872e',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'workly-9872e.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '452351847078',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:452351847078:web:6814f148110c2f792fe267',
};

// Initialize Firebase only if it hasn't been initialized yet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage for persistence — guard against double init
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e: any) {
  // If auth was already initialized (e.g. HMR or module re-evaluation), just get it
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
