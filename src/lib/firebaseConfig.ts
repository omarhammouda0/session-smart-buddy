// Firebase Configuration
// Replace these values with your actual Firebase project config

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummy-key-replace-with-actual",
  authDomain: "session-smart-buddy.firebaseapp.com",
  projectId: "session-smart-buddy",
  storageBucket: "session-smart-buddy.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// VAPID key for Web Push
export const vapidKey = "BACX5Hkka-kcuWgxKVZIMuGiNkgC4SBROEJrZi3HoZ4cGCsA6lQ6eKOw3DUp0Uaq3D63KZGe1lzpgUGEhasK-Ks";

