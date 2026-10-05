import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import B2BProtectedRoute from "../modules/B2BAdmin/components/B2BProtectedRoute";
import B2BDashboardLayout from "../modules/B2BAdmin/components/Layout/B2BDashboardLayout";
import { useB2BAdminStore } from "../modules/B2BAdmin/store/b2bAdminStore";

// Lazy Loaded Pages
const B2BDashboardOverview = lazy(() => import("../modules/B2BAdmin/pages/DashboardOverview"));
const B2BEmployeeManagement = lazy(() => import("../modules/B2BAdmin/pages/EmployeeManagement"));
const B2BCompanyProfile = lazy(() => import("../modules/B2BAdmin/pages/CompanyProfile"));
const B2BLegalDocuments = lazy(() => import("../modules/B2BAdmin/pages/LegalDocuments"));
const B2BAdminProfile = lazy(() => import("../modules/B2BAdmin/pages/AdminProfile"));
const B2BEmployeeProfile = lazy(() => import("../modules/B2BAdmin/pages/EmployeeProfile"));
const B2BActivityLogs = lazy(() => import("../modules/B2BAdmin/pages/ActivityLogs"));
const B2BNotifications = lazy(() => import("../modules/B2BAdmin/pages/Notifications"));
const B2BDashboardSettings = lazy(() => import("../modules/B2BAdmin/pages/Settings"));
const B2BRFQs = lazy(() => import("../modules/B2BAdmin/pages/RFQs"));
const B2BCreateRFQ = lazy(() => import("../modules/B2BAdmin/pages/CreateRFQ"));
const B2BRFQDetail = lazy(() => import("../modules/B2BAdmin/pages/RFQDetail"));
const B2BQuotations = lazy(() => import("../modules/B2BAdmin/pages/Quotations"));
const B2BRFQDiscussions = lazy(() => import("../modules/B2BAdmin/pages/RFQDiscussions"));
const B2BPurchaseOrders = lazy(() => import("../modules/B2BAdmin/pages/PurchaseOrders"));
const ShopChats = lazy(() => import("../modules/B2BAdmin/pages/ShopChats"));
const UserProductRequestHistory = lazy(() => import("../modules/UserApp/pages/ProductRequestHistory"));
const UserProductRequestDetail = lazy(() => import("../modules/UserApp/pages/ProductRequestDetail"));
const UserProductRequestForm = lazy(() => import("../modules/UserApp/pages/ProductRequestForm"));
const AdminSupportDesk = lazy(() => import("../modules/B2BAdmin/pages/AdminSupportDesk"));

const B2BIndexRoute = () => {
  const { adminProfile } = useB2BAdminStore();
  const isEmployee = adminProfile?.isEmployee || adminProfile?.role === 'b2bEmployee';
  if (isEmployee) {
    return <Navigate to="/b2b-dashboard/rfqs" replace />;
  }
  return <Navigate to="/b2b-dashboard/overview" replace />;
};

export default function B2BRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <B2BProtectedRoute>
            <B2BDashboardLayout />
          </B2BProtectedRoute>
        }
      >
        <Route index element={<B2BIndexRoute />} />
        <Route path="overview" element={<B2BDashboardOverview />} />
        <Route path="employees" element={<B2BEmployeeManagement />} />
        <Route path="employees/:id" element={<B2BEmployeeProfile />} />
        <Route path="rfqs" element={<B2BRFQs />} />
        <Route path="rfqs/new" element={<B2BCreateRFQ />} />
        <Route path="rfqs/:id" element={<B2BRFQDetail />} />
        <Route path="direct-rfqs/:id" element={<B2BRFQDetail />} />
        <Route path="quotations" element={<B2BQuotations />} />
        <Route path="discussions" element={<B2BRFQDiscussions />} />
        <Route path="shop-chats" element={<ShopChats />} />
        <Route path="purchase-orders" element={<B2BPurchaseOrders />} />
        <Route path="company-profile" element={<B2BCompanyProfile />} />
        <Route path="legal-documents" element={<B2BLegalDocuments />} />
        <Route path="admin-profile" element={<B2BAdminProfile />} />
        <Route path="activity-logs" element={<B2BActivityLogs />} />
        <Route path="notifications" element={<B2BNotifications />} />
        <Route path="settings" element={<B2BDashboardSettings />} />
        <Route path="product-requests" element={<UserProductRequestHistory />} />
        <Route path="product-requests/new" element={<UserProductRequestForm />} />
        <Route path="product-requests/:id" element={<UserProductRequestDetail />} />
        <Route path="support" element={<AdminSupportDesk />} />
        <Route path="support-desk" element={<Navigate to="/b2b-dashboard/support" replace />} />
      </Route>
    </Routes>
  );
}
