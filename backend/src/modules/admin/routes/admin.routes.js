import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import * as twoFactorController from '../../../controllers/twoFactor.controller.js';
import * as vendorController from '../controllers/vendor.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as catalogController from '../controllers/catalog.controller.js';
import * as customerController from '../controllers/customer.controller.js';
import * as deliveryController from '../controllers/delivery.controller.js';
import * as returnController from '../controllers/return.controller.js';
import * as supportController from '../controllers/support.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as reportController from '../controllers/report.controller.js';
import * as marketingController from '../controllers/marketing.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as uploadController from '../controllers/upload.controller.js';
import * as refurbishedController from '../controllers/refurbished.controller.js';
import * as loyaltyController from '../controllers/loyalty.controller.js';
import * as settingsController from '../controllers/settings.controller.js';
import * as walletController from '../controllers/wallet.controller.js';
import b2bUserRoutes from './b2bUser.routes.js';
import cmsRoutes from './cms.routes.js';
import * as managedShopController from '../controllers/managedShop.controller.js';
import * as productRequestController from '../controllers/productRequest.controller.js';
import * as productEnquiryController from '../controllers/productEnquiry.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { authLimiter } from '../../../middlewares/rateLimiter.js';
import { validate } from '../../../middlewares/validate.js';
import { uploadSingle, uploadMediaSingle } from '../../../middlewares/upload.js';
import { refreshTokenSchema, logoutSchema } from '../validators/auth.validator.js';
import {
    createProductSchema,
    updateProductSchema,
    taxPricingRulesSchema,
    categoryIdParamSchema,
    createCategorySchema,
    updateCategorySchema,
    reorderCategoriesSchema,
    brandIdParamSchema,
    createBrandSchema,
    updateBrandSchema,
} from '../validators/catalog.validator.js';
import {
    customerListQuerySchema,
    customerIdParamSchema,
    customerUpdateSchema,
    customerStatusUpdateSchema,
    customerAddressParamsSchema,
    customerOrdersQuerySchema,
    customerTransactionsQuerySchema,
    customerAddressesQuerySchema,
} from '../validators/customer.validator.js';
import {
    deliveryListQuerySchema,
    deliveryBoyIdParamSchema,
    createDeliveryBoySchema,
    updateDeliveryBoySchema,
    updateDeliveryStatusSchema,
    updateDeliveryApplicationStatusSchema,
    settleCashSchema,
} from '../validators/delivery.validator.js';
import {
    vendorListQuerySchema,
    vendorIdParamSchema,
    vendorStatusUpdateSchema,
    vendorCommissionUpdateSchema,
    vendorCommissionsQuerySchema,
    vendorRejectBusinessSchema,
} from '../validators/vendor.validator.js';
import {
    marketingIdParamSchema,
    campaignListQuerySchema,
} from '../validators/marketing.validator.js';

const router = Router();
const adminAuth = [authenticate, authorize('admin', 'superadmin'), enforceAccountStatus];
router.put('/products/tax-pricing-rules', ...adminAuth, validate(taxPricingRulesSchema), catalogController.updateTaxPricingRules);

router.put('/products/:id', ...adminAuth, validate(updateProductSchema), catalogController.updateProduct);
router.delete('/products/:id', ...adminAuth, catalogController.deleteProduct);
router.patch('/products/:id/review', ...adminAuth, catalogController.reviewProduct);

// ─── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', ...adminAuth, catalogController.getAllCategories);
router.post('/categories', ...adminAuth, validate(createCategorySchema), catalogController.createCategory);
router.patch('/categories/reorder', ...adminAuth, validate(reorderCategoriesSchema), catalogController.reorderCategories);
router.patch('/categories/:id/review', ...adminAuth, validate(categoryIdParamSchema, 'params'), catalogController.reviewCategory);
router.put('/categories/:id', ...adminAuth, validate(categoryIdParamSchema, 'params'), validate(updateCategorySchema), catalogController.updateCategory);
router.delete('/categories/:id', ...adminAuth, validate(categoryIdParamSchema, 'params'), catalogController.deleteCategory);

// ─── Brands ───────────────────────────────────────────────────────────────────
router.get('/brands', ...adminAuth, catalogController.getAllBrands);
router.post('/brands', ...adminAuth, validate(createBrandSchema), catalogController.createBrand);
router.patch('/brands/:id/review', ...adminAuth, validate(brandIdParamSchema, 'params'), catalogController.reviewBrand);
router.put('/brands/:id', ...adminAuth, validate(brandIdParamSchema, 'params'), validate(updateBrandSchema), catalogController.updateBrand);
router.delete('/brands/:id', ...adminAuth, validate(brandIdParamSchema, 'params'), catalogController.deleteBrand);

// ─── Vendors ──────────────────────────────────────────────────────────────────
router.get('/vendors', ...adminAuth, validate(vendorListQuerySchema, 'query'), vendorController.getAllVendors);
router.get('/vendors/pending', ...adminAuth, (req, res, next) => { req.query.status = 'pending'; next(); }, validate(vendorListQuerySchema, 'query'), vendorController.getAllVendors);
router.get('/vendors/b2b-applications', ...adminAuth, vendorController.getB2BApplications);
router.get('/vendors/b2b-applications/:id', ...adminAuth, vendorController.getB2BApplicationDetail);
router.patch('/vendors/b2b-applications/:id/approve', ...adminAuth, vendorController.approveB2BApplication);
router.patch('/vendors/b2b-applications/:id/reject', ...adminAuth, vendorController.rejectB2BApplication);
router.get('/vendors/:id', ...adminAuth, validate(vendorIdParamSchema, 'params'), vendorController.getVendorDetail);
router.get('/vendors/:id/commissions', ...adminAuth, validate(vendorIdParamSchema, 'params'), validate(vendorCommissionsQuerySchema, 'query'), vendorController.getVendorCommissions);
router.get('/vendors/:id/documents', ...adminAuth, validate(vendorIdParamSchema, 'params'), vendorController.getVendorDocuments);
router.patch('/vendors/documents/:docId/status', ...adminAuth, vendorController.updateDocumentStatus);
router.patch('/vendors/:id/status', ...adminAuth, validate(vendorIdParamSchema, 'params'), validate(vendorStatusUpdateSchema), vendorController.updateVendorStatus);
router.patch('/vendors/:id/commission', ...adminAuth, validate(vendorIdParamSchema, 'params'), validate(vendorCommissionUpdateSchema), vendorController.updateCommissionRate);
router.patch('/vendors/:id/verify-business', ...adminAuth, validate(vendorIdParamSchema, 'params'), vendorController.verifyVendorBusiness);
router.patch('/vendors/:id/reject-business', ...adminAuth, validate(vendorIdParamSchema, 'params'), validate(vendorRejectBusinessSchema), vendorController.rejectVendorBusiness);

// ─── Managed Shops & Vendors ───────────────────────────────────────────────
router.post('/managed-shops', ...adminAuth, managedShopController.createShop);
router.get('/managed-shops', ...adminAuth, managedShopController.getAllShops);
router.get('/managed-shops/:id', ...adminAuth, managedShopController.getShopById);
router.put('/managed-shops/:id', ...adminAuth, managedShopController.updateShop);
router.patch('/managed-shops/:id/status', ...adminAuth, managedShopController.updateShopStatus);
router.delete('/managed-shops/:id', ...adminAuth, managedShopController.deleteShop);

router.post('/managed-vendors', ...adminAuth, managedShopController.createVendorUser);
router.get('/managed-vendors', ...adminAuth, managedShopController.getVendorUsers);
router.put('/managed-vendors/:id', ...adminAuth, managedShopController.updateVendorUser);
router.delete('/managed-vendors/:id', ...adminAuth, managedShopController.deleteVendorUser);

// ─── Customers ────────────────────────────────────────────────────────────────
router.use('/b2b-users', b2bUserRoutes);
router.use('/cms', ...adminAuth, cmsRoutes);
router.get('/b2b/users', ...adminAuth, customerController.getB2BUsers);
router.patch('/b2b/users/:id/verify', ...adminAuth, customerController.verifyB2BUser);
router.get('/customers', ...adminAuth, validate(customerListQuerySchema, 'query'), customerController.getAllCustomers);
router.get('/customers/addresses', ...adminAuth, validate(customerAddressesQuerySchema, 'query'), customerController.getCustomerAddresses);
router.get('/customers/transactions', ...adminAuth, validate(customerTransactionsQuerySchema, 'query'), customerController.getCustomerTransactions);
router.get('/customers/:id/orders', ...adminAuth, validate(customerIdParamSchema, 'params'), validate(customerOrdersQuerySchema, 'query'), customerController.getCustomerOrders);
router.get('/customers/:id', ...adminAuth, validate(customerIdParamSchema, 'params'), customerController.getCustomerById);
router.put('/customers/:id', ...adminAuth, validate(customerIdParamSchema, 'params'), validate(customerUpdateSchema), customerController.updateCustomerDetail);
router.patch('/customers/:id/status', ...adminAuth, validate(customerIdParamSchema, 'params'), validate(customerStatusUpdateSchema), customerController.updateCustomerStatus);
router.delete('/customers/:customerId/addresses/:addressId', ...adminAuth, validate(customerAddressParamsSchema, 'params'), customerController.deleteCustomerAddress);

// ─── Delivery ─────────────────────────────────────────────────────────────────
router.get('/delivery-control/stats', ...adminAuth, deliveryController.getDeliveryControlStats);
router.get('/delivery-boys', ...adminAuth, validate(deliveryListQuerySchema, 'query'), deliveryController.getAllDeliveryBoys);
router.post('/delivery-boys', ...adminAuth, validate(createDeliveryBoySchema), deliveryController.createDeliveryBoy);
router.get('/delivery-boys/:id', ...adminAuth, validate(deliveryBoyIdParamSchema, 'params'), deliveryController.getDeliveryBoyById);
router.put('/delivery-boys/:id', ...adminAuth, validate(deliveryBoyIdParamSchema, 'params'), validate(updateDeliveryBoySchema), deliveryController.updateDeliveryBoy);
router.delete('/delivery-boys/:id', ...adminAuth, validate(deliveryBoyIdParamSchema, 'params'), deliveryController.deleteDeliveryBoy);
router.patch('/delivery-boys/:id/status', ...adminAuth, validate(deliveryBoyIdParamSchema, 'params'), validate(updateDeliveryStatusSchema), deliveryController.updateDeliveryBoyStatus);
router.patch('/delivery-boys/:id/application-status', ...adminAuth, validate(deliveryBoyIdParamSchema, 'params'), validate(updateDeliveryApplicationStatusSchema), deliveryController.updateDeliveryBoyApplicationStatus);
router.post('/delivery-boys/:id/settle-cash', ...adminAuth, validate(deliveryBoyIdParamSchema, 'params'), validate(settleCashSchema), deliveryController.settleCash);

// ─── Return Requests ──────────────────────────────────────────────────────────
router.get('/return-requests', ...adminAuth, returnController.getAllReturnRequests);
router.get('/return-requests/:id', ...adminAuth, returnController.getReturnRequestById);
router.patch('/return-requests/:id/status', ...adminAuth, returnController.updateReturnRequestStatus);

// ─── Refurbished Complaints & Returns ─────────────────────────────────────────
router.get('/refurbished-returns', ...adminAuth, returnController.getRefurbishedReturns);
router.patch('/refurbished-returns/:id/status', ...adminAuth, returnController.updateRefurbishedReturn);

// ─── Support Tickets ──────────────────────────────────────────────────────────
router.get('/support/tickets', ...adminAuth, supportController.getAllTickets);
router.get('/support/tickets/:id', ...adminAuth, supportController.getTicketById);
router.patch('/support/tickets/:id/status', ...adminAuth, supportController.updateTicketStatus);
router.post('/support/tickets/:id/messages', ...adminAuth, supportController.addTicketMessage);
router.get('/support/ticket-types', ...adminAuth, supportController.getAllTicketTypes);
router.post('/support/ticket-types', ...adminAuth, supportController.createTicketType);
router.put('/support/ticket-types/:id', ...adminAuth, supportController.updateTicketType);
router.delete('/support/ticket-types/:id', ...adminAuth, supportController.deleteTicketType);

// ─── Product Reviews ──────────────────────────────────────────────────────────
router.get('/reviews', ...adminAuth, reviewController.getAllReviews);
router.patch('/reviews/:id/status', ...adminAuth, reviewController.updateReviewStatus);
router.delete('/reviews/:id', ...adminAuth, reviewController.deleteReview);
router.post('/uploads/image', ...adminAuth, uploadSingle('image'), uploadController.uploadImage);
router.post('/uploads/media', ...adminAuth, uploadMediaSingle('media'), uploadController.uploadMedia);

// ─── Marketing & Promotions ──────────────────────────────────────────────────
// Coupons
router.get('/marketing/coupons', ...adminAuth, marketingController.getAllCoupons);
router.post('/marketing/coupons', ...adminAuth, marketingController.createCoupon);
router.put('/marketing/coupons/:id', ...adminAuth, validate(marketingIdParamSchema, 'params'), marketingController.updateCoupon);
router.delete('/marketing/coupons/:id', ...adminAuth, validate(marketingIdParamSchema, 'params'), marketingController.deleteCoupon);

// Banners
router.get('/marketing/banners', ...adminAuth, marketingController.getAllBanners);
router.post('/marketing/banners', ...adminAuth, marketingController.createBanner);
router.patch('/marketing/banners/reorder', ...adminAuth, marketingController.reorderBanners);
router.put('/marketing/banners/:id', ...adminAuth, validate(marketingIdParamSchema, 'params'), marketingController.updateBanner);
router.delete('/marketing/banners/:id', ...adminAuth, validate(marketingIdParamSchema, 'params'), marketingController.deleteBanner);

// Campaigns
router.get('/marketing/campaigns', ...adminAuth, validate(campaignListQuerySchema, 'query'), marketingController.getAllCampaigns);
router.post('/marketing/campaigns', ...adminAuth, marketingController.createCampaign);
router.put('/marketing/campaigns/:id', ...adminAuth, validate(marketingIdParamSchema, 'params'), marketingController.updateCampaign);
router.delete('/marketing/campaigns/:id', ...adminAuth, validate(marketingIdParamSchema, 'params'), marketingController.deleteCampaign);

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/sales', ...adminAuth, reportController.getSalesReport);
router.get('/reports/inventory', ...adminAuth, reportController.getInventoryReport);

// ─── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications', ...adminAuth, notificationController.getAdminNotifications);
router.put('/notifications/:id/read', ...adminAuth, notificationController.markAsRead);
router.put('/notifications/read-all', ...adminAuth, notificationController.markAllAsRead);

// RFQ routes (protected Admin)
import * as adminRfqController from '../controllers/adminRfq.controller.js';
router.get('/rfq', ...adminAuth, adminRfqController.getAdminRFQs);
router.get('/rfq/stats', ...adminAuth, adminRfqController.getRFQStats);
router.get('/rfq/:id', ...adminAuth, adminRfqController.getAdminRFQDetail);
router.post('/rfq/:id/status', ...adminAuth, adminRfqController.updateRFQStatus);
router.post('/rfq/:id/assign-vendors', ...adminAuth, adminRfqController.assignVendors);
router.post('/rfq/:id/select-vendor', ...adminAuth, adminRfqController.selectVendorQuote);
router.post('/rfq/:id/submit-b2b-approval', ...adminAuth, adminRfqController.submitB2BApproval);
router.post('/rfq/:id/message', ...adminAuth, adminRfqController.sendAdminDiscussionMessage);
router.post('/rfq/:id/vendor/:vendorId/message', ...adminAuth, adminRfqController.sendAdminToVendorMessage);
router.get('/purchase-orders', ...adminAuth, adminRfqController.getAdminPurchaseOrders);
router.get('/purchase-orders/:id', ...adminAuth, adminRfqController.getAdminPurchaseOrderDetail);

// Refurbished Products
router.get('/refurbished-products', ...adminAuth, refurbishedController.getRefurbishedProducts);
router.put('/refurbished-products/:id/status', ...adminAuth, refurbishedController.updateRefurbishedStatus);
router.get('/refurbished-stats', ...adminAuth, refurbishedController.getRefurbishedStats);

// Loyalty Program
router.get('/loyalty/stats', ...adminAuth, loyaltyController.getLoyaltyStats);
router.get('/loyalty/transactions', ...adminAuth, loyaltyController.getLoyaltyTransactions);
router.get('/loyalty/users', ...adminAuth, loyaltyController.getLoyaltyUsers);
router.get('/loyalty/users/:userId', ...adminAuth, loyaltyController.getUserLoyalty);
router.post('/loyalty/users/:userId/credit', ...adminAuth, loyaltyController.creditUserPoints);
router.post('/loyalty/users/:userId/debit', ...adminAuth, loyaltyController.debitUserPoints);
router.post('/loyalty/users/:userId/reset', ...adminAuth, loyaltyController.resetUserPoints);
router.get('/loyalty/users/:userId/history', ...adminAuth, loyaltyController.getUserLoyaltyHistory);
router.get('/loyalty/config', ...adminAuth, loyaltyController.getLoyaltyConfig);
router.put('/loyalty/config', ...adminAuth, loyaltyController.updateLoyaltyConfig);

// ─── Wallet Management ──────────────────────────────────────────────────────────
router.get('/wallet/dashboard', ...adminAuth, walletController.getWalletDashboard);
router.get('/wallet/users', ...adminAuth, walletController.searchWalletUsers);
router.get('/wallet/users/:userId', ...adminAuth, walletController.getUserWallet);
router.get('/wallet/users/:userId/transactions', ...adminAuth, walletController.getUserTransactions);
router.post('/wallet/users/:userId/credit', ...adminAuth, walletController.creditUserWallet);
router.post('/wallet/users/:userId/debit', ...adminAuth, walletController.debitUserWallet);
router.post('/wallet/users/:userId/freeze', ...adminAuth, walletController.freezeUserWallet);
router.post('/wallet/users/:userId/unfreeze', ...adminAuth, walletController.unfreezeUserWallet);

// Settings (Logistics, etc)
router.get('/settings/:key', ...adminAuth, settingsController.getSettings);
router.put('/settings/:key', ...adminAuth, settingsController.updateSettings);

// Product Requests
router.get('/product-requests', ...adminAuth, productRequestController.getAllProductRequests);
router.put('/product-requests/:id/status', ...adminAuth, productRequestController.updateProductRequestStatus);
router.delete('/product-requests/:id', ...adminAuth, productRequestController.deleteProductRequest);
router.get('/product-requests/:id/sourcing-check', ...adminAuth, productRequestController.sourcingCheck);
router.post('/product-requests/:id/assign-sourcing', ...adminAuth, productRequestController.assignSourcing);
router.post('/product-requests/:id/select-fulfillment', ...adminAuth, productRequestController.selectFulfillment);
// --- Vendor Window routes (new) ---
router.get('/product-requests/:id', ...adminAuth, productRequestController.getProductRequestById);
router.post('/product-requests/:id/open-vendor-window', ...adminAuth, productRequestController.openVendorWindow);
router.post('/product-requests/:id/close-vendor-window', ...adminAuth, productRequestController.closeVendorWindow);
router.post('/product-requests/:id/select-vendor-quotation', ...adminAuth, productRequestController.selectVendorQuotation);

// Product Enquiries
router.get('/enquiries', ...adminAuth, productEnquiryController.getAdminEnquiries);
router.put('/enquiries/:id/reply', ...adminAuth, productEnquiryController.replyToEnquiry);

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);
router.get('/auth/profile', ...adminAuth, authController.getProfile);

// 2FA routes
router.get('/auth/2fa/status', ...adminAuth, twoFactorController.get2FAStatus);
router.post('/auth/2fa/enable', ...adminAuth, twoFactorController.initiateEnable2FA);
router.post('/auth/2fa/verify-enable', ...adminAuth, twoFactorController.verifyEnable2FA);
router.post('/auth/2fa/disable', ...adminAuth, twoFactorController.disable2FA);
router.post('/auth/2fa/verify-login', twoFactorController.verifyLogin2FA);
router.post('/auth/2fa/resend', twoFactorController.resendLogin2FAOtp);

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics/dashboard', ...adminAuth, analyticsController.getDashboardStats);
router.get('/analytics/b2b-overview', ...adminAuth, analyticsController.getB2bOverviewStats);
router.get('/analytics/revenue', ...adminAuth, analyticsController.getRevenueData);
router.get('/analytics/order-status', ...adminAuth, analyticsController.getOrderStatusBreakdown);
router.get('/analytics/top-products', ...adminAuth, analyticsController.getTopProducts);
router.get('/analytics/customer-growth', ...adminAuth, analyticsController.getCustomerGrowth);
router.get('/analytics/recent-orders', ...adminAuth, analyticsController.getRecentOrders);
router.get('/analytics/sales', ...adminAuth, analyticsController.getSalesData);
router.get('/analytics/finance-summary', ...adminAuth, analyticsController.getFinancialSummary);
router.get('/analytics/inventory-stats', ...adminAuth, analyticsController.getInventoryStats);

// ─── Orders ───────────────────────────────────────────────────────────────────
router.get('/orders', ...adminAuth, orderController.getAllOrders);
router.get('/orders/:id', ...adminAuth, orderController.getOrderById);
router.patch('/orders/:id/status', ...adminAuth, orderController.updateOrderStatus);
router.patch('/orders/:id/assign-delivery', ...adminAuth, orderController.assignDeliveryBoy);
router.delete('/orders/:id', ...adminAuth, orderController.deleteOrder);

// ---- Purchase Orders --------
router.get('/purchase-orders', ...adminAuth, orderController.getAllPurchaseOrders);
router.patch('/purchase-orders/:id/status', ...adminAuth, orderController.updatePurchaseOrderStatus);
router.patch('/purchase-orders/:id/payment', ...adminAuth, orderController.updatePurchaseOrderPayment);

// ─── Products ─────────────────────────────────────────────────────────────────
router.get('/products', ...adminAuth, catalogController.getAllProducts);
router.get('/products/tax-pricing-rules', ...adminAuth, catalogController.getTaxPricingRules);
router.get('/products/:id', ...adminAuth, catalogController.getProductById);
router.post('/products', ...adminAuth, validate(createProductSchema), catalogController.createProduct);

// ─── PLE Shop Chat Routes ──────────────────────────────────────────────────────
import * as pleShopChatController from '../controllers/pleShopChat.controller.js';
router.get('/ple-shop/my-shops', ...adminAuth, pleShopChatController.getAdminShops);
router.get('/ple-shop/threads', ...adminAuth, pleShopChatController.getPLEShopThreads);
router.get('/ple-shop/threads/:id/messages', ...adminAuth, pleShopChatController.getPLEShopMessages);
router.post('/ple-shop/threads/:id/messages', ...adminAuth, pleShopChatController.sendPLEShopMessage);
router.patch('/ple-shop/threads/:id/read', ...adminAuth, pleShopChatController.markPLEShopRead);

// ─── Admin Managed Vendor Chat Routes ──────────────────────────────────────────
import * as adminManagedVendorChatController from '../controllers/adminManagedVendorChat.controller.js';
router.get('/managed-vendor-chat/threads', ...adminAuth, adminManagedVendorChatController.getAdminManagedVendorThreads);
router.post('/managed-vendor-chat/threads/initiate', ...adminAuth, adminManagedVendorChatController.initiateOrGetThread);
router.get('/managed-vendor-chat/threads/:threadId/messages', ...adminAuth, adminManagedVendorChatController.getAdminManagedVendorMessages);
router.post('/managed-vendor-chat/threads/:threadId/messages', ...adminAuth, adminManagedVendorChatController.sendAdminManagedVendorMessage);
router.patch('/managed-vendor-chat/threads/:threadId/read', ...adminAuth, adminManagedVendorChatController.markAdminManagedVendorThreadRead);

// ─── Admin Chat Moderation Routes ──────────────────────────────────────────────
import * as chatModerationController from '../controllers/chatModeration.controller.js';
router.get('/chat-moderation/violations', ...adminAuth, chatModerationController.getChatViolations);
router.get('/chat-moderation/stats', ...adminAuth, chatModerationController.getChatViolationStats);

export default router;
