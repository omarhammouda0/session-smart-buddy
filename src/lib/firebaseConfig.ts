// Firebase Configuration
// Values from Firebase Console → Project Settings → Your apps

export const firebaseConfig = {
  apiKey: "AIzaSyCDrdQpGBAj4fdk30sWBdCTieE0qOuLKsA",
  authDomain: "session-smart-buddy.firebaseapp.com",
  projectId: "session-smart-buddy",
  storageBucket: "session-smart-buddy.firebasestorage.app",
  messagingSenderId: "224453116331",
  appId: "1:224453116331:web:2d62420830bd0c538852ee",
  measurementId: "G-92DXX5CP3Q"
};

// Check if Firebase is properly configured
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    firebaseConfig.apiKey.startsWith("AIza")
  );
};

// VAPID key for Web Push (from Firebase Console → Cloud Messaging → Web Push certificates)
export const vapidKey = "BACX5Hkka-kcuWgxKVZIMuGiNkgC4SBROEJrZi3HoZ4cGCsA6lQ6eKOw3DUp0Uaq3D63KZGe1lzpgUGEhasK-Ks";

