// Import Firebase scripts (compat mode required for importScripts in ServiceWorker)
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration (from project credentials)
const firebaseConfig = {
  apiKey: "AIzaSyBqT8QRQJuljNV1W5-XGK-plhSwLzwUJW4",
  authDomain: "appzeto-quick-commerce.firebaseapp.com",
  projectId: "appzeto-quick-commerce",
  storageBucket: "appzeto-quick-commerce.firebasestorage.app",
  messagingSenderId: "477007016819",
  appId: "1:477007016819:web:cc5fafe34a8b25b24a8b06",
  measurementId: "G-NKHFJRKT0Z"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);
  
  // Note: If payload.notification exists, Firebase Web automatically displays the notification.
  // Calling showNotification manually here causes a duplicate popup. Only show for data-only payloads.
  if (!payload.notification) {
    const notificationTitle = payload.data?.title || 'PLE Notification';
    const notificationOptions = {
      body: payload.data?.body || '',
      icon: payload.data?.icon || '/favicon.png',
      data: payload.data,
      tag: payload.data?.title || 'ple-notification',
      renotify: false
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  const urlToOpen = data?.link || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
