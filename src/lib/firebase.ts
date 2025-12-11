import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
// TODO: Replace these with your Firebase project credentials from:
// Firebase Console → Project Settings → General → Your apps → Firebase SDK snippet
const firebaseConfig = {
  apiKey: "AIzaSyD_Nc00UbI3KGsXDFdeWbwAYnIRuBYjvfc",           // e.g., "AIzaSyC..."
  authDomain: "bwqc-e3d63.firebaseapp.com",
  databaseURL: "https://bwqc-e3d63-default-rtdb.firebaseio.com",  // Must be valid URL format
  projectId: "bwqc-e3d63",
  storageBucket: "bwqc-e3d63.firebasestorage.app",
  messagingSenderId: "297300167048",
  appId: "1:297300167048:web:0ebea452baae5152f1923d",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
