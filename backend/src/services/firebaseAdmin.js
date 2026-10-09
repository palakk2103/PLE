import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let app;
try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT environment variable is not defined.');
    } else {
        const serviceAccount = JSON.parse(serviceAccountJson);
        const apps = getApps();
        if (apps.length === 0) {
            app = initializeApp({
                credential: cert(serviceAccount)
            });
            console.log('✅ Firebase Admin initialized successfully.');
        } else {
            app = apps[0];
        }
    }
} catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
}

/**
 * Send push notification to multiple tokens
 * @param {Array<string>} tokens - Array of FCM registration tokens
 * @param {Object} payload - Notification payload { title, body, data }
 */
export async function sendPushNotification(tokens, payload) {
    if (!tokens || tokens.length === 0) {
        return { successCount: 0, failureCount: 0, totalTokens: 0 };
    }

    if (!app) {
        console.warn('⚠️ [FCM] Firebase Admin is not initialized. Skipping push notification.');
        return { 
            successCount: 0, 
            failureCount: tokens.length, 
            totalTokens: tokens.length,
            warning: 'FIREBASE_SERVICE_ACCOUNT is not configured' 
        };
    }

    try {
        const messaging = getMessaging(app);
        const BATCH_SIZE = 500;
        let totalSuccess = 0;
        let totalFailure = 0;

        const notificationPayload = {
            title: payload.title,
            body: payload.body,
        };
        if (payload.imageUrl) {
            notificationPayload.imageUrl = payload.imageUrl;
        }

        const dataPayload = {};
        if (payload.data && typeof payload.data === 'object') {
            for (const [key, val] of Object.entries(payload.data)) {
                dataPayload[key] = typeof val === 'string' ? val : JSON.stringify(val);
            }
        }
        if (payload.imageUrl && !dataPayload.image) {
            dataPayload.image = payload.imageUrl;
        }

        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const chunk = tokens.slice(i, i + BATCH_SIZE);
            const message = {
                notification: notificationPayload,
                data: dataPayload,
                tokens: chunk,
            };

            const response = await messaging.sendEachForMulticast(message);
            totalSuccess += response.successCount || 0;
            totalFailure += response.failureCount || 0;
        }

        console.log(`[FCM] Broadcast complete. Success: ${totalSuccess}, Failed: ${totalFailure}, Total: ${tokens.length}`);
        return { successCount: totalSuccess, failureCount: totalFailure, totalTokens: tokens.length };
    } catch (error) {
        console.error('[FCM] Error sending push notification:', error);
        return { successCount: 0, failureCount: tokens.length, totalTokens: tokens.length, error: error.message };
    }
}

