// Firebase Messaging Service Worker
// Handles push notifications when the app is closed or in background

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCDrdQpGBAj4fdk30sWBdCTieE0qOuLKsA",
  authDomain: "session-smart-buddy.firebaseapp.com",
  projectId: "session-smart-buddy",
  storageBucket: "session-smart-buddy.firebasestorage.app",
  messagingSenderId: "224453116331",
  appId: "1:224453116331:web:2d62420830bd0c538852ee"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Helper function to show notification
function showNotification(payload) {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'تنبيه جديد';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.tag || `notification-${Date.now()}`,
    data: payload.data || {},
    requireInteraction: payload.data?.priority === '100',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    silent: false,
    actions: []
  };

  // Add action buttons based on suggestion type
  if (payload.data?.actionType) {
    switch (payload.data.actionType) {
      case 'confirm_session':
        notificationOptions.actions = [
          { action: 'confirm', title: 'تأكيد الحصة' },
          { action: 'dismiss', title: 'لاحقاً' }
        ];
        break;
      case 'record_payment':
        notificationOptions.actions = [
          { action: 'payment', title: 'تسجيل دفعة' },
          { action: 'whatsapp', title: 'تذكير واتساب' }
        ];
        break;
      case 'pre_session':
        notificationOptions.actions = [
          { action: 'view', title: 'عرض التفاصيل' },
          { action: 'dismiss', title: 'لاحقاً' }
        ];
        break;
    }
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
}

// Handle raw push events (more reliable for background on mobile)
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received at:', new Date().toISOString());

  if (!event.data) {
    console.log('[SW] No data in push event');
    // Still show a generic notification
    event.waitUntil(
      self.registration.showNotification('تنبيه جديد', {
        body: 'لديك إشعار جديد',
        icon: '/favicon.ico',
        dir: 'rtl',
        lang: 'ar'
      })
    );
    return;
  }

  let payload;
  try {
    payload = event.data.json();
    console.log('[SW] Push payload parsed:', JSON.stringify(payload).substring(0, 200));
  } catch (e) {
    console.log('[SW] Could not parse push data, using text:', e);
    const text = event.data.text();
    payload = {
      notification: { title: 'تنبيه جديد', body: text },
      data: { body: text }
    };
  }

  // Ensure we always show a notification
  // On Android, if the notification payload exists, the system may show it automatically
  // But we still call showNotification to ensure it works when app is closed
  const notificationPromise = showNotification(payload);

  event.waitUntil(notificationPromise);
});

// Handle background messages (Firebase SDK) - this is a fallback
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message via Firebase SDK:', new Date().toISOString());
  // The push event handler above should handle most cases
  // This is a fallback for when Firebase SDK intercepts the message
  return showNotification(payload);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Determine target URL based on action and data
  if (event.action === 'confirm' && data.sessionId) {
    targetUrl = `/?action=confirm_session&sessionId=${data.sessionId}&studentId=${data.studentId}`;
  } else if (event.action === 'payment' && data.studentId) {
    targetUrl = `/?action=open_payment&studentId=${data.studentId}`;
  } else if (event.action === 'whatsapp' && data.studentId) {
    targetUrl = `/?action=send_whatsapp&studentId=${data.studentId}`;
  } else if (event.action === 'view' && data.studentId) {
    targetUrl = `/?action=view_student&studentId=${data.studentId}`;
  } else if (data.actionUrl) {
    targetUrl = data.actionUrl;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find an existing window and focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          // Navigate to target URL
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            action: event.action,
            data: data,
            targetUrl: targetUrl
          });
          return;
        }
      }
      // No existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[firebase-messaging-sw.js] Push subscription changed');

  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true })
      .then((subscription) => {
        console.log('[firebase-messaging-sw.js] New subscription:', subscription);
        // The app will handle re-registering when it loads
      })
  );
});

// Cache version - increment to force update
const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = `session-smart-buddy-${CACHE_VERSION}`;

// Install event - take control immediately
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installing...', CACHE_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - claim all clients and clean old caches
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activating...', CACHE_VERSION);

  event.waitUntil(
    Promise.all([
      // Take control of all pages immediately
      self.clients.claim(),
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('session-smart-buddy-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[firebase-messaging-sw.js] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
    ])
  );
});

// Periodic sync for keeping the SW alive (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notifications') {
    console.log('[firebase-messaging-sw.js] Periodic sync: check-notifications');
    // The actual notification check is done by the cron job on the server
    // This just keeps the SW active
  }
});
