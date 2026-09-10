import { messaging, getToken, onMessage } from '../firebase';
import api from '../shared/utils/api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Register service worker
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('✅ Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      throw error;
    }
  } else {
    throw new Error('Service Workers are not supported');
  }
}

// Request notification permission
export async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      return true;
    } else {
      console.log('❌ Notification permission denied');
      return false;
    }
  }
  return false;
}

// Get FCM token
export async function getFCMToken() {
  if (!messaging) return null;
  try {
    const registration = await registerServiceWorker();
    await registration.update(); // Update service worker
    
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    if (token) {
      console.log('✅ FCM Token obtained:', token);
      return token;
    } else {
      console.log('❌ No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    return null;
  }
}

// Register FCM token with backend
export async function registerFCMToken(forceUpdate = false) {
  if (!messaging) return null;
  try {
    // Check if already registered
    const savedToken = localStorage.getItem('fcm_token_web');
    if (savedToken && !forceUpdate) {
      console.log('FCM token already registered');
      return savedToken;
    }
    
    // Request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('ℹ️ Notification permission not granted by user.');
      return null;
    }
    
    // Get token
    const token = await getFCMToken();
    if (!token) {
      console.warn('⚠️ Failed to get FCM token');
      return null;
    }
    
    // Save to backend using the pre-configured axios api client
    const response = await api.post('/fcm-tokens/save', {
      token: token,
      platform: 'web'
    });
    
    if (response?.data?.success || response?.status === 200) {
      localStorage.setItem('fcm_token_web', token);
      console.log('✅ FCM token registered with backend');
      return token;
    } else {
      console.warn('⚠️ Failed to register token with backend');
      return null;
    }
  } catch (error) {
    console.warn('⚠️ FCM token registration notice:', error?.message || error);
    return null;
  }
}

// Unregister FCM token from backend
export async function unregisterFCMToken() {
  try {
    const savedToken = localStorage.getItem('fcm_token_web');
    if (!savedToken) return;

    await api.delete('/fcm-tokens/remove', {
      data: {
        token: savedToken,
        platform: 'web'
      }
    });

    localStorage.removeItem('fcm_token_web');
    console.log('✅ FCM token removed from backend');
  } catch (error) {
    console.error('❌ Error unregistering FCM token:', error);
  }
}

// Setup foreground notification handler
export function setupForegroundNotificationHandler(handler) {
  if (!messaging) return () => {};
  try {
    return onMessage(messaging, (payload) => {
      console.log('📬 Foreground message received:', payload);
      
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: payload.notification.icon || '/favicon.png',
          data: payload.data
        });
      }
      
      // Call custom handler
      if (handler) {
        handler(payload);
      }
    });
  } catch (error) {
    console.warn('Failed to attach foreground message listener:', error);
    return () => {};
  }
}

// Initialize push notifications
export async function initializePushNotifications() {
  try {
    await registerServiceWorker();
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}
