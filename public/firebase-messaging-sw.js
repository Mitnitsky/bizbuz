// Firebase Messaging Service Worker
// This file MUST be at the root of the hosting to receive background push notifications

importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA06eeQufVZy4DK-ORpLCamLkVHhMqcEEs",
  authDomain: "bizbuz-3a473.firebaseapp.com",
  projectId: "bizbuz-3a473",
  storageBucket: "bizbuz-3a473.firebasestorage.app",
  messagingSenderId: "873734975774",
  appId: "1:873734975774:web:9a834670a4073a705b990f",
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in foreground)
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || payload.notification?.title || 'BizBuz';
  const body = data.body || payload.notification?.body || '';
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'bizbuz-notification',
    data: { url: data.url || '/' },
  };
  self.registration.showNotification(title, options);
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
