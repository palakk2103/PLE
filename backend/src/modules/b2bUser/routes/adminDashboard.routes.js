import express from 'express';
import { getDashboardOverview } from '../controllers/dashboard.controller.js';
import { 
    getEmployees, 
    createEmployee, 
    updateEmployee, 
    deleteEmployee,
    allotWalletFunds
} from '../controllers/employee.controller.js';
import { 
    getCompanyProfile, 
    updateCompanyProfile, 
    getAdminProfile, 
    updateAdminProfile,
    verifyAdminProfileOTP,
    resendAdminProfileOTP,
    uploadLegalDocument,
    submitDocumentResubmission
} from '../controllers/profile.controller.js';
import * as rfqController from '../controllers/rfq.controller.js';
import * as notificationController from '../../user/controllers/notification.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize } from '../../../middlewares/authorize.js';
import { uploadDocumentSingle } from '../../../middlewares/upload.js';

const router = express.Router();

// Apply authentication and authorization for B2B Admin and Employee
router.use(authenticate, authorize('b2bAdmin', 'b2bEmployee'));

const requireAdmin = authorize('b2bAdmin');

// Dashboard
router.get('/dashboard', getDashboardOverview);

// Company Profile (Admin only for editing, both Admin and Employee for viewing)
router.get('/company', getCompanyProfile);
router.put('/company', requireAdmin, updateCompanyProfile);
router.put('/company/legal-document', requireAdmin, uploadDocumentSingle('file'), uploadLegalDocument);
router.post('/company/submit-resubmission', requireAdmin, submitDocumentResubmission);

// Admin Profile (Admin only)
router.get('/profile', requireAdmin, getAdminProfile);
router.put('/profile', requireAdmin, updateAdminProfile);
router.post('/profile/verify-otp', requireAdmin, verifyAdminProfileOTP);
router.post('/profile/resend-otp', requireAdmin, resendAdminProfileOTP);

// Employees (Admin only)
router.get('/employees', requireAdmin, getEmployees);
router.post('/employees', requireAdmin, createEmployee);
router.put('/employees/:id', requireAdmin, updateEmployee);
router.delete('/employees/:id', requireAdmin, deleteEmployee);
router.post('/employees/:id/allot-wallet', requireAdmin, allotWalletFunds);

// Vendors for dropdowns
router.get('/vendors', rfqController.getVendorsForSourcing);

// RFQ Sourcing
router.get('/rfq', rfqController.getRFQs);
router.get('/rfq/stats', rfqController.getRFQStats);
router.post('/rfq', rfqController.createRFQ);
router.post('/rfq/upload', uploadDocumentSingle('file'), rfqController.uploadAttachment);
router.get('/rfq/:id', rfqController.getRFQDetail);
router.put('/rfq/:id', rfqController.updateRFQ);
router.post('/rfq/:id/submit', rfqController.submitRFQ);
router.post('/rfq/:id/withdraw', rfqController.withdrawRFQ);
router.post('/rfq/:id/message', rfqController.sendDiscussionMessage);
router.post('/rfq/:id/confirm-quote', requireAdmin, rfqController.confirmQuote);
router.post('/rfq/:id/approve', requireAdmin, rfqController.confirmQuote);
router.post('/rfq/:id/reject', requireAdmin, rfqController.rejectRFQRecommendation);
router.post('/rfq/:id/request-renegotiation', requireAdmin, rfqController.requestRenegotiation);

// Purchase Orders
router.get('/purchase-orders', rfqController.getPurchaseOrders);
router.get('/purchase-orders/:id', rfqController.getPurchaseOrderDetail);
router.patch('/purchase-orders/:id/pay', requireAdmin, rfqController.payPurchaseOrder);

// Notifications
router.get('/notifications', notificationController.getUserNotifications);
router.put('/notifications/:id/read', notificationController.markUserNotificationAsRead);
router.put('/notifications/read-all', notificationController.markAllUserNotificationsAsRead);
router.delete('/notifications/:id', notificationController.deleteUserNotification);

export default router;
