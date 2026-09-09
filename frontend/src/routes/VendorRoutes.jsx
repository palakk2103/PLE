import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import VendorProtectedRoute from "../modules/Vendor/components/VendorProtectedRoute";
import VendorLayout from "../modules/Vendor/components/Layout/VendorLayout";

// Lazy Loaded Pages
const VendorLogin = lazy(() => import("../modules/Vendor/pages/Login"));
const VendorRegister = lazy(() => import("../modules/Vendor/pages/Register"));
const VendorVerification = lazy(() => import("../modules/Vendor/pages/Verification"));
const VendorForgotPassword = lazy(() => import("../modules/Vendor/pages/ForgotPassword"));
const VendorResetPassword = lazy(() => import("../modules/Vendor/pages/ResetPassword"));
const VendorDashboard = lazy(() => import("../modules/Vendor/pages/Dashboard"));
const VendorProducts = lazy(() => import("../modules/Vendor/pages/Products"));
const VendorManageProducts = lazy(() => import("../modules/Vendor/pages/products/ManageProducts"));
const VendorAddProduct = lazy(() => import("../modules/Vendor/pages/products/AddProduct"));
const VendorBulkProducts = lazy(() => import("../modules/Vendor/pages/products/BulkProducts"));
const VendorProductForm = lazy(() => import("../modules/Vendor/pages/products/ProductForm"));
const VendorOrders = lazy(() => import("../modules/Vendor/pages/Orders"));
const VendorAllOrders = lazy(() => import("../modules/Vendor/pages/orders/AllOrders"));
const VendorBulkOrders = lazy(() => import("../modules/Vendor/pages/orders/BulkOrders"));
const VendorOrderTracking = lazy(() => import("../modules/Vendor/pages/orders/OrderTracking"));
const VendorOrderDetail = lazy(() => import("../modules/Vendor/pages/orders/OrderDetail"));
const VendorAnalytics = lazy(() => import("../modules/Vendor/pages/Analytics"));
const VendorEarnings = lazy(() => import("../modules/Vendor/pages/Earnings"));
const VendorSettings = lazy(() => import("../modules/Vendor/pages/Settings"));
const VendorProfileSettings = lazy(() => import("../modules/Vendor/pages/settings/ProfileSettings"));
const VendorStockManagement = lazy(() => import("../modules/Vendor/pages/StockManagement"));
const VendorWalletHistory = lazy(() => import("../modules/Vendor/pages/WalletHistory"));
const VendorChat = lazy(() => import("../modules/Vendor/pages/Chat"));
const VendorReturnRequests = lazy(() => import("../modules/Vendor/pages/ReturnRequests"));
const VendorReturnRequestDetail = lazy(() => import("../modules/Vendor/pages/returns/ReturnRequestDetail"));
const VendorProductReviews = lazy(() => import("../modules/Vendor/pages/ProductReviews"));
const VendorShippingManagement = lazy(() => import("../modules/Vendor/pages/ShippingManagement"));
const VendorCustomers = lazy(() => import("../modules/Vendor/pages/Customers"));
const VendorCustomerDetail = lazy(() => import("../modules/Vendor/pages/CustomerDetail"));
const VendorInventoryReports = lazy(() => import("../modules/Vendor/pages/InventoryReports"));
const VendorPerformanceMetrics = lazy(() => import("../modules/Vendor/pages/PerformanceMetrics"));
const VendorDocuments = lazy(() => import("../modules/Vendor/pages/Documents"));
const VendorLegalDocuments = lazy(() => import("../modules/Vendor/pages/VendorLegalDocuments"));
const VendorNotifications = lazy(() => import("../modules/Vendor/pages/Notifications"));
const VendorSupportTickets = lazy(() => import("../modules/Vendor/pages/SupportTickets"));
const VendorSupportEscalations = lazy(() => import("../modules/Vendor/pages/SupportEscalations"));
const VendorPickupLocations = lazy(() => import("../modules/Vendor/pages/PickupLocations"));
const VendorReports = lazy(() => import("../modules/Vendor/pages/Reports"));
const VendorLanguageSettings = lazy(() => import("../modules/Vendor/pages/LanguageSettings"));
const VendorB2BEnquiries = lazy(() => import("../modules/Vendor/pages/b2b/B2BEnquiries"));
const VendorB2BEnquiryDetail = lazy(() => import("../modules/Vendor/pages/b2b/B2BEnquiryDetail"));
const VendorB2BCreateQuote = lazy(() => import("../modules/Vendor/pages/b2b/B2BCreateQuote"));
const VendorB2BQuoteDetail = lazy(() => import("../modules/Vendor/pages/b2b/B2BQuoteDetail"));
const VendorB2BOrders = lazy(() => import("../modules/Vendor/pages/b2b/VendorB2BOrders"));
const VendorB2BAnalytics = lazy(() => import("../modules/Vendor/pages/b2b/B2BAnalytics"));
const VendorB2BSettings = lazy(() => import("../modules/Vendor/pages/b2b/B2BSettings"));
const VendorB2BSellerApplication = lazy(() => import("../modules/Vendor/pages/b2b/B2BSellerApplication"));
const VendorDirectRFQs = lazy(() => import("../modules/Vendor/pages/b2b/VendorDirectRFQs"));
const VendorDirectRFQDetail = lazy(() => import("../modules/Vendor/pages/b2b/VendorDirectRFQDetail"));
const VendorDeliverySettings = lazy(() => import("../modules/Vendor/pages/VendorDeliverySettings"));
const VendorFestivalCampaigns = lazy(() => import("../modules/Vendor/pages/FestivalCampaigns"));
const VendorProductRequests = lazy(() => import("../modules/Vendor/pages/ProductRequests"));
const VendorProductEnquiries = lazy(() => import("../modules/Vendor/pages/ProductEnquiries"));
const ManagedVendorAdminChat = lazy(() => import("../modules/Vendor/pages/ManagedVendorAdminChat"));

const OfferDashboard = lazy(() => import("../modules/offers/pages/OfferDashboard"));
const OfferList = lazy(() => import("../modules/offers/pages/OfferList"));
const CreateOffer = lazy(() => import("../modules/offers/pages/CreateOffer"));
const EditOffer = lazy(() => import("../modules/offers/pages/EditOffer"));
const OfferDetails = lazy(() => import("../modules/offers/pages/OfferDetails"));
const VendorPrivacyPolicy = lazy(() => import("../modules/Vendor/pages/PrivacyPolicy"));
const VendorSupport = lazy(() => import("../modules/Vendor/pages/Support"));

export default function VendorRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<VendorLogin />} />
      <Route path="/register" element={<VendorRegister />} />
      <Route path="/verification" element={<VendorVerification />} />
      <Route path="/forgot-password" element={<VendorForgotPassword />} />
      <Route path="/reset-password" element={<VendorResetPassword />} />
      <Route path="/privacy-policy" element={<VendorPrivacyPolicy />} />
      <Route path="/support" element={<VendorSupport />} />
      <Route
        path="/"
        element={
          <VendorProtectedRoute>
            <VendorLayout />
          </VendorProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<VendorDashboard />} />
        <Route path="products" element={<VendorProducts />} />
        <Route path="products/manage-products" element={<VendorManageProducts />} />
        <Route path="products/add-product" element={<VendorAddProduct />} />
        <Route path="products/bulk-upload" element={<VendorBulkProducts />} />
        <Route path="products/:id" element={<VendorProductForm />} />
        <Route path="orders" element={<VendorOrders />} />
        <Route path="orders/all-orders" element={<VendorAllOrders />} />
        <Route path="orders/bulk-orders" element={<VendorBulkOrders />} />
        <Route path="orders/order-tracking" element={<VendorOrderTracking />} />
        <Route path="orders/:id" element={<VendorOrderDetail />} />
        <Route path="analytics" element={<VendorAnalytics />} />
        <Route path="reports" element={<VendorReports />} />
        <Route path="earnings" element={<VendorEarnings />} />
        <Route path="earnings/overview" element={<VendorEarnings />} />
        <Route path="earnings/commission-history" element={<VendorEarnings />} />
        <Route path="earnings/settlement-history" element={<VendorEarnings />} />
        <Route path="stock-management" element={<VendorStockManagement />} />
        <Route path="wallet-history" element={<VendorWalletHistory />} />
        <Route path="chat" element={<VendorChat />} />
        <Route path="notifications" element={<VendorNotifications />} />
        <Route path="return-requests" element={<VendorReturnRequests />} />
        <Route path="return-requests/:id" element={<VendorReturnRequestDetail />} />
        <Route path="product-reviews" element={<VendorProductReviews />} />
        <Route path="shipping-management" element={<VendorShippingManagement />} />
        <Route path="pickup-locations" element={<VendorPickupLocations />} />
        <Route path="customers/:id" element={<VendorCustomerDetail />} />
        <Route path="customers" element={<VendorCustomers />} />
        <Route path="support-tickets" element={<VendorSupportTickets />} />
        <Route path="support-escalations" element={<VendorSupportEscalations />} />
        <Route path="inventory-reports" element={<VendorInventoryReports />} />
        <Route path="performance-metrics" element={<VendorPerformanceMetrics />} />
        <Route path="documents" element={<VendorDocuments />} />
        <Route path="legal-documents" element={<VendorLegalDocuments />} />
        <Route path="language-settings" element={<VendorLanguageSettings />} />
        <Route path="settings" element={<VendorSettings />} />
        <Route path="settings/store" element={<VendorSettings />} />
        <Route path="settings/gst" element={<VendorSettings />} />
        <Route path="settings/payment" element={<VendorSettings />} />
        <Route path="settings/payment-settings" element={<VendorSettings />} />
        <Route path="settings/shipping" element={<VendorSettings />} />
        <Route path="settings/shipping-settings" element={<VendorSettings />} />
        <Route path="settings/business" element={<VendorSettings />} />

        {/* B2B Enquiry Routes */}
        <Route path="b2b-application" element={<VendorB2BSellerApplication />} />
        <Route path="b2b-enquiries" element={<VendorB2BEnquiries />} />
        <Route path="b2b-enquiries/all" element={<VendorB2BEnquiries />} />
        <Route path="b2b-enquiries/application" element={<VendorB2BSellerApplication />} />
        <Route path="b2b-enquiries/:id" element={<VendorB2BEnquiryDetail />} />
        <Route path="b2b-enquiries/:id/create-quote" element={<VendorB2BCreateQuote />} />
        <Route path="b2b-enquiries/:id/quote/:quoteId" element={<VendorB2BQuoteDetail />} />
        <Route path="b2b-enquiries/orders" element={<VendorB2BOrders />} />
        <Route path="b2b-enquiries/analytics" element={<VendorB2BAnalytics />} />
        <Route path="b2b-enquiries/settings" element={<VendorB2BSettings />} />

        {/* Direct RFQ Routes */}
        <Route path="direct-rfqs" element={<VendorDirectRFQs />} />
        <Route path="direct-rfqs/:id" element={<VendorDirectRFQDetail />} />

        {/* Offers & Promotion Management System (Seller) */}
        <Route path="my-offers" element={<Navigate to="dashboard" replace />} />
        <Route path="my-offers/dashboard" element={<OfferDashboard />} />
        <Route path="my-offers/list" element={<OfferList />} />
        <Route path="my-offers/create" element={<CreateOffer />} />
        <Route path="my-offers/edit/:id" element={<EditOffer />} />
        <Route path="my-offers/details/:id" element={<OfferDetails />} />

        <Route path="delivery-settings" element={<VendorDeliverySettings />} />
        <Route path="festival-campaigns" element={<VendorFestivalCampaigns />} />
        <Route path="product-requests" element={<VendorProductRequests />} />
        <Route path="product-enquiries" element={<VendorProductEnquiries />} />
        <Route path="admin-chat" element={<ManagedVendorAdminChat />} />
        <Route path="chat" element={<VendorChat />} />
        <Route path="profile" element={<VendorProfileSettings />} />
      </Route>
    </Routes>
  );
}
