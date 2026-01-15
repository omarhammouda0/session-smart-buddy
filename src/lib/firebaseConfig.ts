// Firebase Configuration
// These values come from Firebase Console → Project Settings → General → Your apps

// For Lovable deployment, set these in the Lovable Secrets panel:
// - VITE_FIREBASE_API_KEY
// - VITE_FIREBASE_MESSAGING_SENDER_ID
// - VITE_FIREBASE_APP_ID

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: "session-smart-buddy.firebaseapp.com",
  projectId: "session-smart-buddy",
  storageBucket: "session-smart-buddy.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Check if Firebase is properly configured
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    firebaseConfig.apiKey !== "AIzaSyDummy-key-replace-with-actual"
  );
};

// VAPID key for Web Push (from Firebase Console → Cloud Messaging → Web Push certificates)
export const vapidKey = "BACX5Hkka-kcuWgxKVZIMuGiNkgC4SBROEJrZi3HoZ4cGCsA6lQ6eKOw3DUp0Uaq3D63KZGe1lzpgUGEhasK-Ks";

