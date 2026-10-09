/**
 * Admin API Service
 * All admin API calls go through this file.
 * Uses the single central axios instance from api.js which automatically:
 *  - Attaches Authorization: Bearer <adminToken> for /admin/* routes
 *  - Shows error toasts on failure
 *  - Redirects to /admin/login on 401
 */
import api from '../../../shared/utils/api';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const adminLogin = (credentials, password) => {
    if (typeof credentials === 'object' && credentials !== null) {
        return api.post('/admin/auth/login', credentials);
    }
    return api.post('/admin/auth/login', { email: credentials, password });
};

export const getAdminProfile = () =>
    api.get('/admin/auth/profile');

// ─── Analytics / Dashboard ────────────────────────────────────────────────────
export const getDashboardStats = (params = {}) =>
    api.get('/admin/analytics/dashboard', { params });

export const getB2bOverviewStats = (params = {}) =>
    api.get('/admin/analytics/b2b-overview', { params });

export const getRevenueData = (period = 'monthly', params = {}) =>
    api.get('/admin/analytics/revenue', { params: { period, ...params } });

export const getOrderStatusBreakdown = (params = {}) =>
    api.get('/admin/analytics/order-status', { params });

export const getTopProducts = (params = {}) =>
    api.get('/admin/analytics/top-products', { params });

export const getCustomerGrowth = (period = 'monthly') =>
    api.get('/admin/analytics/customer-growth', { params: { period } });

export const getRecentOrders = (params = {}) =>
    api.get('/admin/analytics/recent-orders', { params });

export const getSalesData = (period = 'monthly', params = {}) =>
    api.get('/admin/analytics/sales', { params: { period, ...params } });

export const getFinancialSummary = (period = 'monthly', params = {}) =>
    api.get('/admin/analytics/finance-summary', { params: { period, ...params } });

export const getInventoryStats = () =>
    api.get('/admin/analytics/inventory-stats');

// ─── Orders ───────────────────────────────────────────────────────────────────
export const getAllOrders = (params = {}) =>
    api.get('/admin/orders', { params });

export const getOrderById = (id) =>
    api.get(`/admin/orders/${id}`);

export const updateOrderStatus = (id, status) =>
    api.patch(`/admin/orders/${id}/status`, { status });

export const assignDeliveryBoy = (id, deliveryBoyId) =>
    api.patch(`/admin/orders/${id}/assign-delivery`, { deliveryBoyId });

export const deleteOrder = (id) =>
    api.delete(`/admin/orders/${id}`);

// ---- Purchase Orders --------
export const getAllPurchaseOrders = (params = {}) =>
    api.get('/admin/purchase-orders', { params });

export const updatePurchaseOrderStatus = (id, status) =>
    api.patch(`/admin/purchase-orders/${id}/status`, { status });

export const updatePurchaseOrderPayment = (id, paymentStatus) =>
    api.patch(`/admin/purchase-orders/${id}/payment`, { paymentStatus });

// ─── Products ─────────────────────────────────────────────────────────────────
export const getAllProducts = (params = {}) =>
    api.get('/admin/products', { params });

export const getProductById = (id) =>
    api.get(`/admin/products/${id}`);

export const createProduct = (data) =>
    api.post('/admin/products', data);

export const updateProduct = (id, data) =>
    api.put(`/admin/products/${id}`, data);

export const deleteProduct = (id) =>
    api.delete(`/admin/products/${id}`);

export const getTaxPricingRules = () =>
    api.get('/admin/products/tax-pricing-rules');

export const updateTaxPricingRules = (data) =>
    api.put('/admin/products/tax-pricing-rules', data);

// ─── Categories ───────────────────────────────────────────────────────────────
export const getAllCategories = (params = {}) =>
    api.get('/admin/categories', { params });

export const getPublicCategories = () =>
    api.get('/categories/all');

export const createCategory = (data) =>
    api.post('/admin/categories', data);

export const updateCategory = (id, data) =>
    api.put(`/admin/categories/${id}`, data);

export const reviewCategory = (id, data) =>
    api.patch(`/admin/categories/${id}/review`, data);

export const deleteCategory = (id) =>
    api.delete(`/admin/categories/${id}`);

export const reorderCategories = (categoryIds) =>
    api.patch('/admin/categories/reorder', { categoryIds });

// ─── Brands ───────────────────────────────────────────────────────────────────
export const getAllBrands = (params = {}) =>
    api.get('/admin/brands', { params });

export const getPublicBrands = () =>
    api.get('/brands/all');

export const createBrand = (data) =>
    api.post('/admin/brands', data);

export const updateBrand = (id, data) =>
    api.put(`/admin/brands/${id}`, data);

export const reviewBrand = (id, data) =>
    api.patch(`/admin/brands/${id}/review`, data);

export const deleteBrand = (id) =>
    api.delete(`/admin/brands/${id}`);

// ─── Vendors ──────────────────────────────────────────────────────────────────
export const getAllVendors = (params = {}) =>
    api.get('/admin/vendors', { params });

export const getVendorById = (id) =>
    api.get(`/admin/vendors/${id}`);

export const updateVendorStatus = (id, status, reason = '') =>
    api.patch(`/admin/vendors/${id}/status`, { status, reason });

export const verifyVendorBusiness = (id) =>
    api.patch(`/admin/vendors/${id}/verify-business`);

export const rejectVendorBusiness = (id, remark) =>
    api.patch(`/admin/vendors/${id}/reject-business`, { remark });

export const unflagVendor = (id, reason = '') =>
    api.patch(`/admin/vendors/${id}/unflag`, { reason });

export const rejectUnflagAppeal = (id, remarks = '') =>
    api.patch(`/admin/vendors/${id}/reject-unflag-appeal`, { remarks });

export const flagVendor = (id, reason = '') =>
    api.patch(`/admin/vendors/${id}/flag`, { reason });

export const updateCommissionRate = (id, commissionRate) =>
    api.patch(`/admin/vendors/${id}/commission`, { commissionRate });

export const getVendorCommissions = (id, params = {}) =>
    api.get(`/admin/vendors/${id}/commissions`, { params });

export const getVendorDocuments = (id) =>
    api.get(`/admin/vendors/${id}/documents`);

export const updateVendorDocumentStatus = (docId, status) =>
    api.patch(`/admin/vendors/documents/${docId}/status`, { status });

// ─── Customers ────────────────────────────────────────────────────────────────
export const getAllCustomers = (params = {}) =>
    api.get('/admin/customers', { params });

export const getCustomerById = (id) =>
    api.get(`/admin/customers/${id}`);

export const updateCustomer = (id, data) =>
    api.put(`/admin/customers/${id}`, data);

export const updateCustomerStatus = (id, isActive) =>
    api.patch(`/admin/customers/${id}/status`, { isActive });

export const deleteCustomerAddress = (customerId, addressId) =>
    api.delete(`/admin/customers/${customerId}/addresses/${addressId}`);

export const getCustomerOrders = (id, params = {}) =>
    api.get(`/admin/customers/${id}/orders`, { params });

export const getCustomerTransactions = (params = {}) =>
    api.get('/admin/customers/transactions', { params });

export const getCustomerAddresses = (params = {}) =>
    api.get('/admin/customers/addresses', { params });

// ─── Delivery Boys ────────────────────────────────────────────────────────────
export const getAllDeliveryBoys = (params = {}) =>
    api.get('/admin/delivery-boys', { params });

export const createDeliveryBoy = (data) =>
    api.post('/admin/delivery-boys', data);

export const getDeliveryBoyById = (id) =>
    api.get(`/admin/delivery-boys/${id}`);

export const updateDeliveryBoyStatus = (id, isActive) =>
    api.patch(`/admin/delivery-boys/${id}/status`, { isActive });

export const updateDeliveryBoyApplicationStatus = (id, applicationStatus, reason = '') =>
    api.patch(`/admin/delivery-boys/${id}/application-status`, { applicationStatus, reason });

export const settleCash = (id, amount) =>
    api.post(`/admin/delivery-boys/${id}/settle-cash`, { amount });

export const updateDeliveryBoy = (id, data) =>
    api.put(`/admin/delivery-boys/${id}`, data);

export const deleteDeliveryBoy = (id) =>
    api.delete(`/admin/delivery-boys/${id}`);

// ─── Return Requests ──────────────────────────────────────────────────────────
export const getAllReturnRequests = (params = {}) =>
    api.get('/admin/return-requests', { params });

export const getReturnRequestById = (id) =>
    api.get(`/admin/return-requests/${id}`);

export const updateReturnRequestStatus = (id, statusOrPayload, adminNote = '') => {
    const payload =
        typeof statusOrPayload === 'object' && statusOrPayload !== null
            ? statusOrPayload
            : { status: statusOrPayload, adminNote };
    return api.patch(`/admin/return-requests/${id}/status`, payload);
};

// ——— Reviews —————————————————————————————————————————————————————————————————————
export const getAllReviews = (params = {}) =>
    api.get('/admin/reviews', { params });

export const updateReviewStatus = (id, status) =>
    api.patch(`/admin/reviews/${id}/status`, { status });

export const deleteReview = (id) =>
    api.delete(`/admin/reviews/${id}`);

// ——— Support Tickets —————————————————————————————————————————————————————————————
export const getAllTickets = (params = {}) =>
    api.get('/admin/support/tickets', { params });

export const getTicketById = (id) =>
    api.get(`/admin/support/tickets/${id}`);

export const updateTicketStatus = (id, status, note = '') =>
    api.patch(`/admin/support/tickets/${id}/status`, { status, note });

export const addTicketMessage = (id, message, attachment = null) =>
    api.post(`/admin/support/tickets/${id}/messages`, { message, attachment });

export const deleteTicket = (id) =>
    api.delete(`/admin/support/tickets/${id}`);

export const getAllTicketTypes = (params = {}) =>
    api.get('/admin/support/ticket-types', { params });

export const createTicketType = (data) =>
    api.post('/admin/support/ticket-types', data);

export const updateTicketType = (id, data) =>
    api.put(`/admin/support/ticket-types/${id}`, data);

export const deleteTicketType = (id) =>
    api.delete(`/admin/support/ticket-types/${id}`);


// ─── Reports ──────────────────────────────────────────────────────────────────
export const getSalesReport = (params = {}) =>
    api.get('/admin/reports/sales', { params });

export const getInventoryReport = (params = {}) =>
    api.get('/admin/reports/inventory', { params });

// ─── Settings ─────────────────────────────────────────────────────────────────
export const getSettings = () =>
    api.get('/admin/settings');

export const updateSettings = (data) =>
    api.put('/admin/settings', data);

export const getSettingByKey = (key) =>
    api.get(`/admin/settings/${key}`);

export const updateSettingByKey = (key, data) =>
    api.put(`/admin/settings/${key}`, data);

// ─── Marketing & Promotions ──────────────────────────────────────────────────
// Coupons
export const getAllCoupons = (params) => api.get('/admin/marketing/coupons', { params });
export const createCoupon = (data) => api.post('/admin/marketing/coupons', data);
export const updateCoupon = (id, data) => api.put(`/admin/marketing/coupons/${id}`, data);
export const deleteCoupon = (id) => api.delete(`/admin/marketing/coupons/${id}`);

// Banners
export const getAllBanners = () => api.get('/admin/marketing/banners');
export const createBanner = (data) => api.post('/admin/marketing/banners', data);
export const reorderBanners = (items) => api.patch('/admin/marketing/banners/reorder', { items });
export const updateBanner = (id, data) => api.put(`/admin/marketing/banners/${id}`, data);
export const deleteBanner = (id) => api.delete(`/admin/marketing/banners/${id}`);

// Campaigns
export const getAllCampaigns = (params) => api.get('/admin/marketing/campaigns', { params });
export const createCampaign = (data) => api.post('/admin/marketing/campaigns', data);
export const updateCampaign = (id, data) => api.put(`/admin/marketing/campaigns/${id}`, data);
export const deleteCampaign = (id) => api.delete(`/admin/marketing/campaigns/${id}`);

// Image Uploads
export const uploadAdminImage = (file, folder = 'general', publicId) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);
    if (publicId) {
        formData.append('publicId', publicId);
    }
    return api.post('/admin/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

// Media Uploads (Image and Video)
export const uploadAdminMedia = (file, folder = 'general', publicId) => {
    const formData = new FormData();
    formData.append('media', file);
    formData.append('folder', folder);
    if (publicId) {
        formData.append('publicId', publicId);
    }
    return api.post('/admin/uploads/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};


// ─── Notifications ────────────────────────────────────────────────────────────
export const sendPushNotification = (data) =>
    api.post('/admin/notifications/push', data);

export const sendCustomMessage = (data) =>
    api.post('/admin/notifications/message', data);

// ─── Policies ─────────────────────────────────────────────────────────────────
export const getPolicy = (type) =>
    api.get(`/admin/policies/${type}`);

export const updatePolicy = (type, content) =>
    api.put(`/admin/policies/${type}`, { content });

// ─── Header Notifications ─────────────────────────────────────────────────────
export const getAdminNotifications = (params) => api.get('/admin/notifications', { params });
export const markNotificationAsRead = (id) => api.put(`/admin/notifications/${id}/read`);
export const markAllNotificationsAsRead = () => api.put('/admin/notifications/read-all');

// ─── B2B Users ────────────────────────────────────────────────────────────────// B2B User Endpoints
export const getAllB2BUsers = async (params) => {
  const res = await api.get('/admin/b2b-users', { params });
  return res.data;
};

export const getB2BUserById = async (id) => {
  const res = await api.get(`/admin/b2b-users/${id}`);
  return res.data;
};

export const updateB2BUserStatus = async (id, status, reason) => {
  const res = await api.patch(`/admin/b2b-users/${id}/status`, { status, reason });
  return res.data;
};

export const deleteB2BUser = async (id) => {
  const res = await api.delete(`/admin/b2b-users/${id}`);
  return res.data;
};

export const getB2BAnalytics = async (params) => {
  const res = await api.get('/admin/b2b-users/analytics', { params });
  return res.data;
};

// ─── CMS ──────────────────────────────────────────────────────────────────────
export const getAboutContent = () => api.get('/admin/cms/about');
export const updateAboutContent = (data) => api.put('/admin/cms/about', data);

export const getPortfolios = (params) => api.get('/admin/cms/portfolio', { params });
export const createPortfolio = (data) => api.post('/admin/cms/portfolio', data);
export const updatePortfolio = (id, data) => api.put(`/admin/cms/portfolio/${id}`, data);
export const deletePortfolio = (id) => api.delete(`/admin/cms/portfolio/${id}`);

export const getPortfolioPage = () => api.get('/admin/cms/portfolio-page');
export const updatePortfolioPage = (data) => api.put('/admin/cms/portfolio-page', data);

// ─── Agreement Template Management ──────────────────────────────────────────
export const getAgreementTemplates = (params) => api.get('/admin/b2b-users/agreement-templates', { params });
export const getAgreementTemplateConfigs = () => api.get('/admin/b2b-users/agreement-templates/configs');
export const uploadAgreementTemplateGeneric = (formData) =>
    api.post('/admin/b2b-users/agreement-templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
export const updateAgreementTemplateStatus = (id, status) => api.patch(`/admin/b2b-users/agreement-templates/${id}/status`, { status });
export const deleteAgreementTemplateGeneric = (id) => api.delete(`/admin/b2b-users/agreement-templates/${id}`);

// ─── Account Team Management ───────────────────────────────────────────────────
export const getNextIdentityId = (identityClass = 'employee') =>
    api.get('/admin/account-team/next-id', { params: { class: identityClass } });

export const provisionAccountTeamMember = (data) =>
    api.post('/admin/account-team/provision', data);

export const getAccountTeamMembers = (params = {}) =>
    api.get('/admin/account-team', { params });

export const getAccountTeamMemberById = (id) =>
    api.get(`/admin/account-team/${id}`);

export const updateAccountTeamMember = (id, data) =>
    api.patch(`/admin/account-team/${id}`, data);

export const toggleAccountTeamMemberStatus = (id, status) =>
    api.patch(`/admin/account-team/${id}/status`, { status });

export const resetAccountTeamCredentials = (id, data) =>
    api.post(`/admin/account-team/${id}/reset-credentials`, data);

// ─── Audit / Activity Logs ─────────────────────────────────────────────────────
export const getAuditLogs = (params = {}) =>
    api.get('/admin/audit-logs', { params });

export const getAuditLogFilters = () =>
    api.get('/admin/audit-logs/filters');

export const getAuditLogById = (id) =>
    api.get(`/admin/audit-logs/${id}`);

// ─── Finance, Withdrawals & Settlements ───────────────────────────────────────
export const getAdminFinanceOverview = () =>
    api.get('/admin/finance/overview');

export const getAdminWithdrawals = (params = {}) =>
    api.get('/admin/finance/withdrawals', { params });

export const getAdminWithdrawalById = (id) =>
    api.get(`/admin/finance/withdrawals/${id}`);

export const approveAdminWithdrawal = (id, data = {}) =>
    api.patch(`/admin/finance/withdrawals/${id}/approve`, data);

export const rejectAdminWithdrawal = (id, data = {}) =>
    api.patch(`/admin/finance/withdrawals/${id}/reject`, data);

export const recordAdminManualPayout = (id, data) =>
    api.post(`/admin/finance/withdrawals/${id}/record-payout`, data);

export const getAdminSettlements = (params = {}) =>
    api.get('/admin/finance/settlements', { params });

export const getAdminSettlementById = (id) =>
    api.get(`/admin/finance/settlements/${id}`);

export const getAdminFinanceTransactions = (params = {}) =>
    api.get('/admin/finance/transactions', { params });

export const getAdminPayoutSettings = () =>
    api.get('/admin/finance/settings');

export const updateAdminPayoutSettings = (data) =>
    api.put('/admin/finance/settings', data);

export const getAdminVendorWallet = (vendorId) =>
    api.get(`/admin/finance/vendor/${vendorId}/wallet`);


