// Firebase Messaging Service Worker
// Handles push notifications when the app is closed or in background

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase configuration - will be replaced with actual values during build
const firebaseConfig = {
  apiKey: "AIzaSyDummy-key-replace-with-actual",
  authDomain: "session-smart-buddy.firebaseapp.com",
  projectId: "session-smart-buddy",
  storageBucket: "session-smart-buddy.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'تنبيه جديد';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'default',
    data: payload.data || {},
    requireInteraction: payload.data?.priority === '100',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [100, 50, 100],
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

