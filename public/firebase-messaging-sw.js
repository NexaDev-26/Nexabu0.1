// Firebase Cloud Messaging Service Worker
// This file handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDYLRnwim28hjrKxysCNnWJrtPplrZzn40",
  authDomain: "nexabu-app.firebaseapp.com",
  projectId: "nexabu-app",
  storageBucket: "nexabu-app.appspot.com",
  messagingSenderId: "1086759047254",
  appId: "1:1086759047254:web:1c58c6df62911b26a62bf7",
  measurementId: "G-6S0KP0DBC2"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Nexabu Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data,
    tag: 'nexabu-notification',
    requireInteraction: false
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const clickAction = event.notification.data?.clickAction;
  if (clickAction) {
    event.waitUntil(
      clients.openWindow(clickAction)
    );
  }
});

