
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";

const getEnv = (key: string, defaultValue: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return defaultValue;
};

const firebaseConfig = {
  apiKey: getEnv("REACT_APP_FIREBASE_API_KEY", "AIzaSyDYLRnwim28hjrKxysCNnWJrtPplrZzn40"),
  authDomain: getEnv("REACT_APP_FIREBASE_AUTH_DOMAIN", "nexabu-app.firebaseapp.com"),
  projectId: getEnv("REACT_APP_FIREBASE_PROJECT_ID", "nexabu-app"),
  storageBucket: getEnv("REACT_APP_FIREBASE_STORAGE_BUCKET", "nexabu-app.appspot.com"),
  messagingSenderId: getEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID", "1086759047254"),
  appId: getEnv("REACT_APP_FIREBASE_APP_ID", "1:1086759047254:web:1c58c6df62911b26a62bf7"),
  measurementId: getEnv("REACT_APP_FIREBASE_MEASUREMENT_ID", "G-6S0KP0DBC2")
};

let app: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;
let firebaseEnabled = false;

if (firebaseConfig.apiKey) {
  try {
    // 1. Initialize App (Singleton)
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    
    // 2. Initialize Auth
    authInstance = getAuth(app);

    // 3. Initialize Firestore with Offline Persistence (New API)
    try {
      dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (e: any) {
      // If Firestore was already initialized (e.g. during Hot Module Replacement), use the existing instance.
      // This prevents "Firestore has already been started" errors.
      dbInstance = getFirestore(app);
    }

    firebaseEnabled = true;
    console.log("Firebase initialized: Persistence Enabled");
  } catch (error) {
    console.error("Firebase init error:", error);
  }
}

export const auth = authInstance!;
export const db = dbInstance!;
export const isFirebaseEnabled = firebaseEnabled;
export const googleProvider = new GoogleAuthProvider();
