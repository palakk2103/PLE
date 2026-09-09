import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as addressController from '../controllers/address.controller.js';
import * as wishlistController from '../controllers/wishlist.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { authLimiter, otpLimiter, chatLimiter } from '../../../middlewares/rateLimiter.js';
import { validate } from '../../../middlewares/validate.js';
import { uploadSingle, uploadDocumentSingle } from '../../../middlewares/upload.js';
import {
    registerSchema,
    loginSchema,
    otpSchema,
    resendOtpSchema,
    refreshTokenSchema,
    logoutSchema,
    forgotPasswordSchema,
    verifyResetOtpSchema,
    resetPasswordSchema,
    updateProfileSchema,
    changePasswordSchema,
} from '../validators/auth.validator.js';
import {
    createAddressSchema,
    updateAddressSchema,
} from '../validators/address.validator.js';
import { placeOrderSchema, createReturnRequestSchema } from '../validators/order.validator.js';

import * as twoFactorController from '../../../controllers/twoFactor.controller.js';

const router = Router();
const customerAuth = [authenticate, authorize('customer', 'b2bAdmin', 'b2bEmployee'), enforceAccountStatus];

// 2FA routes
router.get('/auth/2fa/status', ...customerAuth, twoFactorController.get2FAStatus);
router.post('/auth/2fa/enable', ...customerAuth, twoFactorController.initiateEnable2FA);
router.post('/auth/2fa/verify-enable', ...customerAuth, twoFactorController.verifyEnable2FA);
router.post('/auth/2fa/disable', ...customerAuth, twoFactorController.disable2FA);
router.post('/auth/2fa/verify-login', twoFactorController.verifyLogin2FA);
router.post('/auth/2fa/resend', twoFactorController.resendLogin2FAOtp);

// Auth routes
router.post('/auth/register', authLimiter, validate(registerSchema), authController.register);
router.post('/auth/register-b2b', uploadDocumentSingle('gstCertificate'), authController.registerB2B);
router.post('/auth/verify-otp', validate(otpSchema), authController.verifyOTP);
router.post('/auth/resend-otp', otpLimiter, validate(resendOtpSchema), authController.resendOTP);
router.post('/auth/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/verify-reset-otp', authLimiter, validate(verifyResetOtpSchema), authController.verifyResetOTP);
router.post('/auth/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);
router.get('/auth/profile', ...customerAuth, authController.getProfile);
router.put('/auth/profile', ...customerAuth, validate(updateProfileSchema), authController.updateProfile);
router.post('/auth/profile/verify-otp', ...customerAuth, authController.verifyProfileOTP);
router.post('/auth/profile/resend-otp', ...customerAuth, authController.resendProfileOTP);
router.post('/auth/profile/avatar', ...customerAuth, uploadSingle('avatar'), authController.uploadProfileAvatar);
router.post('/auth/change-password', ...customerAuth, validate(changePasswordSchema), authController.changePassword);

// Address routes (protected)
router.get('/addresses', ...customerAuth, addressController.getAddresses);
router.post('/addresses', ...customerAuth, validate(createAddressSchema), addressController.addAddress);
router.put('/addresses/:id', ...customerAuth, validate(updateAddressSchema), addressController.updateAddress);
router.delete('/addresses/:id', ...customerAuth, addressController.deleteAddress);
router.patch('/addresses/:id/default', ...customerAuth, addressController.setDefaultAddress);

// Wishlist routes (protected)
router.get('/wishlist', ...customerAuth, wishlistController.getWishlist);
router.post('/wishlist', ...customerAuth, wishlistController.addToWishlist);
router.delete('/wishlist/:productId', ...customerAuth, wishlistController.removeFromWishlist);



// Review routes
router.get('/reviews/product/:productId', reviewController.getProductReviews);
router.post('/reviews', ...customerAuth, reviewController.addReview);
router.post('/reviews/:id/helpful', reviewController.voteHelpful);

// Order routes
router.post('/orders', ...customerAuth, validate(placeOrderSchema), orderController.placeOrder);
router.get('/orders', ...customerAuth, orderController.getUserOrders);
router.get('/orders/:id', ...customerAuth, orderController.getOrderDetail);
router.patch('/orders/:id/cancel', ...customerAuth, orderController.cancelOrder);
router.post('/orders/:id/returns', ...customerAuth, validate(createReturnRequestSchema), orderController.createReturnRequest);
router.get('/returns', ...customerAuth, orderController.getUserReturnRequests);
router.get('/returns/:id', ...customerAuth, orderController.getUserReturnRequestById);

// Payment routes
router.post('/payments/verify', ...customerAuth, paymentController.verifyPayment);
router.post('/payments/retry', ...customerAuth, paymentController.retryPayment);

// Loyalty routes
import * as loyaltyController from '../controllers/loyalty.controller.js';
router.get('/loyalty/balance', ...customerAuth, loyaltyController.getBalance);
router.get('/loyalty/history', ...customerAuth, loyaltyController.getHistory);
router.post('/loyalty/validate-redemption', ...customerAuth, loyaltyController.validateRedemption);
router.get('/loyalty/config', loyaltyController.getConfig);

// Notification routes (protected)
router.get('/notifications', ...customerAuth, notificationController.getUserNotifications);
router.put('/notifications/:id/read', ...customerAuth, notificationController.markUserNotificationAsRead);
router.put('/notifications/read-all', ...customerAuth, notificationController.markAllUserNotificationsAsRead);
router.delete('/notifications/:id', ...customerAuth, notificationController.deleteUserNotification);

// RFQ routes (protected B2B/Customer)
import * as rfqController from '../controllers/rfq.controller.js';
router.post('/rfq', ...customerAuth, rfqController.createRFQ);
router.post('/rfq/upload', ...customerAuth, uploadDocumentSingle('file'), rfqController.uploadAttachment);
router.get('/rfq', ...customerAuth, rfqController.getBuyerRFQs);
router.get('/rfq/:id', ...customerAuth, rfqController.getRFQDetail);
router.post('/rfq/:id/counter', ...customerAuth, rfqController.buyerCounterOffer);
router.post('/rfq/:id/accept', ...customerAuth, rfqController.buyerAcceptQuote);
router.post('/rfq/:id/reject', ...customerAuth, rfqController.buyerRejectQuote);

// Product Enquiry routes
import * as enquiryController from '../controllers/productEnquiry.controller.js';
router.post('/enquiries', ...customerAuth, enquiryController.createEnquiry);
router.get('/enquiries', ...customerAuth, enquiryController.getMyEnquiries);

// Product Request routes
import * as productRequestController from '../../b2bUser/controllers/productRequest.controller.js';
router.post('/product-requests', ...customerAuth, productRequestController.createProductRequest);
router.get('/product-requests', ...customerAuth, productRequestController.getUserProductRequests);
router.get('/product-requests/:id', ...customerAuth, productRequestController.getProductRequestById);
router.post('/product-requests/:id/confirm', ...customerAuth, productRequestController.confirmProductRequestProposal);
// --- Vendor Window quotation response routes (new) ---
router.post('/product-requests/:id/approve-quotation', ...customerAuth, productRequestController.approveQuotation);
router.post('/product-requests/:id/reject-quotation', ...customerAuth, productRequestController.rejectQuotation);
router.post('/product-requests/:id/request-changes', ...customerAuth, productRequestController.requestChanges);
router.post('/product-requests/:id/extension/approve', ...customerAuth, productRequestController.approveExtension);
router.post('/product-requests/:id/extension/reject', ...customerAuth, productRequestController.rejectExtension);

// Chat routes (protected)
import * as customerChatController from '../controllers/customerChat.controller.js';
router.post('/chat/vendor/initiate', ...customerAuth, customerChatController.initiateVendorChat);
router.get('/chat/vendor/threads', ...customerAuth, customerChatController.getCustomerChatThreads);
router.get('/chat/vendor/threads/:id/messages', ...customerAuth, customerChatController.getCustomerChatMessages);
router.post('/chat/vendor/threads/:id/messages', ...customerAuth, chatLimiter, customerChatController.sendCustomerChatMessage);
router.patch('/chat/vendor/threads/:id/read', ...customerAuth, customerChatController.markCustomerChatRead);

export default router;
