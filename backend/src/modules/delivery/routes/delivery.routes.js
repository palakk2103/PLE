import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as twoFactorController from '../../../controllers/twoFactor.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { authLimiter } from '../../../middlewares/rateLimiter.js';
import { validate } from '../../../middlewares/validate.js';
import { uploadDeliveryDocuments } from '../../../middlewares/upload.js';
import {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    verifyResetOtpSchema,
    resetPasswordSchema,
    refreshTokenSchema,
    logoutSchema,
} from '../validators/auth.validator.js';

const router = Router();
const deliveryAuth = [authenticate, authorize('delivery'), enforceAccountStatus];
const IS_PRODUCTION = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

// Auth
router.post(
    '/auth/register',
    authLimiter,
    uploadDeliveryDocuments([
        { name: 'drivingLicense', maxCount: 1 },
        { name: 'aadharCard', maxCount: 1 },
    ]),
    validate(registerSchema),
    authController.register
);
router.post('/auth/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/verify-reset-otp', authLimiter, validate(verifyResetOtpSchema), authController.verifyResetOTP);
router.post('/auth/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);
router.get('/auth/profile', ...deliveryAuth, authController.getProfile);
router.put('/auth/profile', ...deliveryAuth, authController.updateProfile);
router.post('/auth/profile/verify-otp', ...deliveryAuth, authController.verifyProfileOTP);
router.post('/auth/profile/resend-otp', ...deliveryAuth, authController.resendProfileOTP);

// 2FA routes
router.get('/auth/2fa/status', ...deliveryAuth, twoFactorController.get2FAStatus);
router.post('/auth/2fa/enable', ...deliveryAuth, twoFactorController.initiateEnable2FA);
router.post('/auth/2fa/verify-enable', ...deliveryAuth, twoFactorController.verifyEnable2FA);
router.post('/auth/2fa/disable', ...deliveryAuth, twoFactorController.disable2FA);
router.post('/auth/2fa/verify-login', twoFactorController.verifyLogin2FA);
router.post('/auth/2fa/resend', twoFactorController.resendLogin2FAOtp);

// Orders
router.get('/orders', ...deliveryAuth, orderController.getAssignedOrders);
router.get('/orders/dashboard-summary', ...deliveryAuth, orderController.getDashboardSummary);
router.get('/orders/profile-summary', ...deliveryAuth, orderController.getProfileSummary);
router.get('/orders/:id', ...deliveryAuth, orderController.getOrderDetail);
if (!IS_PRODUCTION) {
    router.get('/orders/:id/debug-otp', ...deliveryAuth, orderController.getDeliveryOtpForDebug);
}
router.patch('/orders/:id/status', ...deliveryAuth, orderController.updateDeliveryStatus);
router.post('/orders/:id/resend-delivery-otp', ...deliveryAuth, orderController.resendDeliveryOtp);

// Notifications
router.get('/notifications', ...deliveryAuth, notificationController.getDeliveryNotifications);
router.put('/notifications/:id/read', ...deliveryAuth, notificationController.markDeliveryNotificationAsRead);
router.put('/notifications/read-all', ...deliveryAuth, notificationController.markAllDeliveryNotificationsAsRead);
router.delete('/notifications/:id', ...deliveryAuth, notificationController.deleteDeliveryNotification);

// Support tickets to PLE
import deliverySupport from '../controllers/deliverySupport.controller.js';
router.get('/support/ticket-types', ...deliveryAuth, deliverySupport.ticketTypes);
router.get('/support/tickets', ...deliveryAuth, deliverySupport.listMine);
router.post('/support/tickets', ...deliveryAuth, deliverySupport.create);
router.get('/support/tickets/:id', ...deliveryAuth, deliverySupport.detail);
router.post('/support/tickets/:id/messages', ...deliveryAuth, deliverySupport.reply);
router.patch('/support/tickets/:id/status', ...deliveryAuth, deliverySupport.setStatus);

export default router;
