import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as twoFactorController from '../../../controllers/twoFactor.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as customerController from '../controllers/customer.controller.js';
import * as inventoryController from '../controllers/inventory.controller.js';
import * as performanceController from '../controllers/performance.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as chatController from '../controllers/chat.controller.js';
import * as documentController from '../controllers/document.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as returnController from '../controllers/return.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import * as shippingController from '../controllers/shipping.controller.js';
import * as uploadController from '../controllers/upload.controller.js';
import * as vendorPurchaseOrderController from '../controllers/vendorPurchaseOrder.controller.js';
import * as businessProfileController from '../controllers/businessProfile.controller.js';
import * as b2bApplicationController from '../controllers/b2bApplication.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { authLimiter, chatLimiter } from '../../../middlewares/rateLimiter.js';
import { validate } from '../../../middlewares/validate.js';
import {
    registerSchema,
    loginSchema,
    verifyOtpSchema,
    resendOtpSchema,
    refreshTokenSchema,
    logoutSchema,
    forgotPasswordSchema,
    verifyResetOtpSchema,
    resetPasswordSchema
} from '../validators/auth.validator.js';
import {
    createProductSchema,
    updateProductSchema,
    productIdParamSchema,
} from '../validators/product.validator.js';
import { uploadSingle, uploadMultiple, uploadDocumentSingle, uploadVendorRegistrationDocs } from '../../../middlewares/upload.js';

const router = Router();
const vendorAuth = [authenticate, authorize('vendor', 'managed_vendor'), enforceAccountStatus];
const strictVendorAuth = [authenticate, authorize('vendor', 'managed_vendor'), enforceAccountStatus];

// Auth
router.post('/auth/register', authLimiter, uploadVendorRegistrationDocs(), validate(registerSchema), authController.register);
router.post('/auth/verify-otp', validate(verifyOtpSchema), authController.verifyOTP);
router.post('/auth/resend-otp', validate(resendOtpSchema), authController.resendOTP);
router.post('/auth/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/verify-reset-otp', authLimiter, validate(verifyResetOtpSchema), authController.verifyResetOTP);
router.post('/auth/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/auth/login', authLimiter, validate(loginSchema), authController.login);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);
router.get('/auth/profile', ...vendorAuth, authController.getProfile);
router.put('/auth/profile', ...vendorAuth, authController.updateProfile);

// 2FA routes
router.get('/auth/2fa/status', ...vendorAuth, twoFactorController.get2FAStatus);
router.post('/auth/2fa/enable', ...vendorAuth, twoFactorController.initiateEnable2FA);
router.post('/auth/2fa/verify-enable', ...vendorAuth, twoFactorController.verifyEnable2FA);
router.post('/auth/2fa/disable', ...vendorAuth, twoFactorController.disable2FA);
router.post('/auth/2fa/verify-login', twoFactorController.verifyLogin2FA);
router.post('/auth/2fa/resend', twoFactorController.resendLogin2FAOtp);
router.post('/auth/profile/verify-otp', ...vendorAuth, authController.verifyProfileOTP);
router.post('/auth/profile/resend-otp', ...vendorAuth, authController.resendProfileOTP);
router.post('/auth/change-password/request-otp', ...vendorAuth, authController.requestChangePasswordOTP);
router.post('/auth/change-password/verify-otp', ...vendorAuth, authController.verifyChangePasswordOTP);
router.put('/auth/bank-details', ...strictVendorAuth, authController.updateBankDetails);

// Business Profile Routes
router.get('/business-profile', ...strictVendorAuth, businessProfileController.getBusinessProfile);
router.post('/business-profile', ...strictVendorAuth, businessProfileController.updateBusinessProfile);
router.put('/business-profile', ...strictVendorAuth, businessProfileController.updateBusinessProfile);
router.post('/business-profile/upload-gst', ...strictVendorAuth, uploadDocumentSingle('file'), businessProfileController.uploadGSTCertificate);
router.post('/business-profile/upload-msme', ...strictVendorAuth, uploadDocumentSingle('file'), businessProfileController.uploadMSMECertificate);
router.post('/business-profile/upload-identity', ...strictVendorAuth, uploadDocumentSingle('file'), businessProfileController.uploadIdentityProof);
router.post('/business-profile/upload-registration', ...strictVendorAuth, uploadDocumentSingle('file'), businessProfileController.uploadRegistrationProof);
router.post('/business-profile/upload-partnership', ...strictVendorAuth, uploadDocumentSingle('file'), businessProfileController.uploadPartnershipAgreement);

// B2B Seller Application Routes
router.get('/b2b-application', ...strictVendorAuth, b2bApplicationController.getB2BApplication);
router.post('/b2b-application', ...strictVendorAuth, b2bApplicationController.submitB2BApplication);
router.post('/b2b-application/upload-document', ...strictVendorAuth, uploadDocumentSingle('file'), b2bApplicationController.uploadB2BGstCertificate);

// Products
router.get('/products', ...vendorAuth, productController.getVendorProducts);
router.get('/brand-requests', ...vendorAuth, productController.getVendorBrandRequests);
router.get('/category-requests', ...vendorAuth, productController.getVendorCategoryRequests);
router.post('/products/bulk', ...vendorAuth, productController.createBulkProducts);
router.get('/products/:id', ...vendorAuth, validate(productIdParamSchema, 'params'), productController.getVendorProductById);
router.post('/products', ...vendorAuth, validate(createProductSchema), productController.createProduct);
router.put('/products/:id', ...vendorAuth, validate(productIdParamSchema, 'params'), validate(updateProductSchema), productController.updateProduct);
router.delete('/products/:id', ...vendorAuth, validate(productIdParamSchema, 'params'), productController.deleteProduct);
router.patch('/stock/:productId', ...vendorAuth, productController.updateStock);

// Orders
router.get('/orders', ...vendorAuth, orderController.getVendorOrders);
router.post('/orders/bulk', ...vendorAuth, orderController.createBulkOrders);
router.get('/orders/:id', ...vendorAuth, orderController.getVendorOrderById);
router.patch('/orders/:id/status', ...vendorAuth, orderController.updateOrderStatus);
router.post('/orders/:id/shiprocket-shipment', ...vendorAuth, orderController.createShiprocketShipment);

// Customers
router.get('/customers', ...strictVendorAuth, customerController.getVendorCustomers);
router.get('/customers/:id', ...strictVendorAuth, customerController.getVendorCustomerById);

// Chat
router.get('/chat/threads', ...strictVendorAuth, chatController.getVendorChatThreads);
router.get('/chat/threads/:id/messages', ...strictVendorAuth, chatController.getVendorChatMessages);
router.post('/chat/threads/:id/messages', ...strictVendorAuth, chatLimiter, chatController.sendVendorChatMessage);
router.patch('/chat/threads/:id/read', ...strictVendorAuth, chatController.markVendorChatRead);
router.patch('/chat/threads/:id/status', ...strictVendorAuth, chatController.updateVendorChatStatus);

// Documents
router.get('/documents', ...strictVendorAuth, documentController.getVendorDocuments);
router.post('/documents', ...strictVendorAuth, uploadDocumentSingle('file'), documentController.createVendorDocument);
router.delete('/documents/:id', ...strictVendorAuth, documentController.deleteVendorDocument);

// Notifications
router.get('/notifications', ...strictVendorAuth, notificationController.getVendorNotifications);
router.put('/notifications/:id/read', ...strictVendorAuth, notificationController.markVendorNotificationAsRead);
router.put('/notifications/read-all', ...strictVendorAuth, notificationController.markAllVendorNotificationsAsRead);
router.delete('/notifications/:id', ...strictVendorAuth, notificationController.deleteVendorNotification);

// Inventory reports
router.get('/inventory/reports', ...strictVendorAuth, inventoryController.getInventoryReport);

// Performance metrics
router.get('/performance/metrics', ...strictVendorAuth, performanceController.getPerformanceMetrics);

// Analytics
router.get('/analytics/overview', ...strictVendorAuth, analyticsController.getAnalyticsOverview);

// Earnings
router.get('/earnings', ...strictVendorAuth, orderController.getEarnings);

// Return requests
router.get('/return-requests', ...strictVendorAuth, returnController.getVendorReturnRequests);
router.get('/return-requests/:id', ...strictVendorAuth, returnController.getVendorReturnRequestById);
router.patch('/return-requests/:id/status', ...strictVendorAuth, returnController.updateVendorReturnRequestStatus);

// Product reviews
router.get('/reviews', ...strictVendorAuth, reviewController.getVendorReviews);
router.patch('/reviews/:id/status', ...strictVendorAuth, reviewController.updateVendorReviewStatus);
router.patch('/reviews/:id/response', ...strictVendorAuth, reviewController.addVendorReviewResponse);

// Shipping management
router.get('/shipping/zones', ...strictVendorAuth, shippingController.getShippingZones);
router.post('/shipping/zones', ...strictVendorAuth, shippingController.createShippingZone);
router.put('/shipping/zones/:id', ...strictVendorAuth, shippingController.updateShippingZone);
router.delete('/shipping/zones/:id', ...strictVendorAuth, shippingController.deleteShippingZone);
router.get('/shipping/rates', ...strictVendorAuth, shippingController.getShippingRates);
router.post('/shipping/rates', ...strictVendorAuth, shippingController.createShippingRate);
router.put('/shipping/rates/:id', ...strictVendorAuth, shippingController.updateShippingRate);
router.delete('/shipping/rates/:id', ...strictVendorAuth, shippingController.deleteShippingRate);

// Uploads (Cloudinary via temp local multer upload)
router.post('/uploads/image', ...vendorAuth, uploadSingle('image'), uploadController.uploadImage);
router.post('/uploads/images', ...vendorAuth, uploadMultiple('images', 8), uploadController.uploadImages);

// RFQ routes (protected Vendor)
import * as vendorRfqController from '../controllers/vendorRfq.controller.js';
import * as vendorDirectRfqController from '../controllers/vendorDirectRfq.controller.js';

router.get('/rfq', ...strictVendorAuth, vendorRfqController.getVendorRFQs);
router.post('/rfq/upload', ...strictVendorAuth, uploadDocumentSingle('file'), vendorRfqController.uploadAttachment);
router.post('/rfq/:id/quote', ...strictVendorAuth, vendorRfqController.vendorSendQuote);
router.post('/rfq/:id/reject', ...strictVendorAuth, vendorRfqController.vendorRejectRFQ);
router.post('/rfq/:id/message', ...strictVendorAuth, vendorRfqController.sendVendorNegotiationMessage);

// Direct RFQ routes
router.get('/direct-rfq', ...strictVendorAuth, vendorDirectRfqController.getVendorDirectRFQs);
router.get('/direct-rfq/:id', ...strictVendorAuth, vendorDirectRfqController.getVendorDirectRFQDetail);
router.post('/direct-rfq/:id/message', ...strictVendorAuth, vendorDirectRfqController.sendDirectMessage);

// Purchase Orders (B2B)
import * as vendorB2BController from '../controllers/vendorB2B.controller.js';
router.get('/b2b/settings', ...strictVendorAuth, vendorB2BController.getSettings);
router.put('/b2b/settings', ...strictVendorAuth, vendorB2BController.updateSettings);
router.get('/b2b/analytics', ...strictVendorAuth, vendorB2BController.getAnalytics);
router.get('/b2b/purchase-orders', ...strictVendorAuth, vendorPurchaseOrderController.getVendorPurchaseOrders);
router.get('/b2b/purchase-orders/:id', ...strictVendorAuth, vendorPurchaseOrderController.getVendorPurchaseOrderById);

// Product Enquiry routes (protected Vendor)
import * as vendorEnquiryController from '../controllers/productEnquiry.controller.js';
router.get('/enquiries', ...strictVendorAuth, vendorEnquiryController.getVendorEnquiries);
router.put('/enquiries/:id/reply', ...strictVendorAuth, vendorEnquiryController.replyToEnquiry);

// Product Requests (protected Vendor)
import * as vendorProductRequestController from '../controllers/productRequest.controller.js';
router.get('/product-requests', ...strictVendorAuth, vendorProductRequestController.getVendorProductRequests);
router.put('/product-requests/:id/respond', ...strictVendorAuth, vendorProductRequestController.respondToProductRequest);
// --- Vendor Window routes (new) ---
router.post('/product-requests/:id/accept-window', ...strictVendorAuth, vendorProductRequestController.acceptVendorWindow);
router.post('/product-requests/:id/release', ...strictVendorAuth, vendorProductRequestController.releaseRequest);
router.post('/product-requests/:id/submit-quotation', ...strictVendorAuth, vendorProductRequestController.submitQuotation);
router.post('/product-requests/:id/fulfill', ...strictVendorAuth, vendorProductRequestController.markFulfilled);
router.post('/product-requests/:id/request-extension', ...strictVendorAuth, vendorProductRequestController.requestExtension);
router.post('/product-requests/:id/chat/initiate', ...strictVendorAuth, chatController.initiateProductRequestChat);

// Managed Vendor Chat with Admin
import * as managedVendorChatController from '../controllers/managedVendorChat.controller.js';
router.get('/admin-chat/thread', ...strictVendorAuth, managedVendorChatController.getManagedVendorThread);
router.get('/admin-chat/messages', ...strictVendorAuth, managedVendorChatController.getManagedVendorMessages);
router.post('/admin-chat/messages', ...strictVendorAuth, managedVendorChatController.sendManagedVendorMessage);
router.patch('/admin-chat/read', ...strictVendorAuth, managedVendorChatController.markManagedVendorThreadRead);

// GST Settings routes
import gstSettingsRoutes from './gstSettings.routes.js';
router.use('/gst-settings', gstSettingsRoutes);

export default router;

