import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../shared/components/Auth/ProtectedRoute";
import RouteWrapper from "../shared/components/RouteWrapper";

// Lazy Loaded Pages
const UserProductRequestForm = lazy(() => import("../modules/UserApp/pages/ProductRequestForm"));
const UserProductRequestHistory = lazy(() => import("../modules/UserApp/pages/ProductRequestHistory"));
const UserProductRequestDetail = lazy(() => import("../modules/UserApp/pages/ProductRequestDetail"));

// Core Mobile/UserApp Pages (Statically Imported for Quick Opening)
import MobileHome from "../modules/UserApp/pages/Home";
import MobileProductDetail from "../modules/UserApp/pages/ProductDetail";
import MobileCategories from "../modules/UserApp/pages/categories";
import MobileSearch from "../modules/UserApp/pages/Search";

// Secondary Mobile/UserApp Pages (Lazy Loaded)
const RefurbishedCatalog = lazy(() => import("../modules/UserApp/pages/RefurbishedCatalog"));
const MobileSeller = lazy(() => import("../modules/UserApp/pages/Seller"));
const MobileCategory = lazy(() => import("../modules/UserApp/pages/Category"));
const MobileBrand = lazy(() => import("../modules/UserApp/pages/Brand"));
const MobileCheckout = lazy(() => import("../modules/UserApp/pages/Checkout"));
const MobileLogin = lazy(() => import("../modules/UserApp/pages/Login"));
const MobileHelpSupport = lazy(() => import("../modules/UserApp/pages/HelpSupport"));
const MySupportTickets = lazy(() => import("../modules/UserApp/pages/MySupportTickets"));
const SupportChat = lazy(() => import("../modules/UserApp/pages/SupportChat"));
const CustomerVendorChat = lazy(() => import("../modules/UserApp/pages/CustomerVendorChat"));
const CustomerChatsList = lazy(() => import("../modules/UserApp/pages/CustomerChatsList"));
const MobileRegister = lazy(() => import("../modules/UserApp/pages/Register"));
const MobileVerification = lazy(() => import("../modules/UserApp/pages/Verification"));
const MobileForgotPassword = lazy(() => import("../modules/UserApp/pages/ForgotPassword"));
const MobileResetPassword = lazy(() => import("../modules/UserApp/pages/ResetPassword"));
const MobileProfile = lazy(() => import("../modules/UserApp/pages/Profile"));
const MobileWallet = lazy(() => import("../modules/UserApp/pages/Wallet"));
const MobileSettings = lazy(() => import("../modules/UserApp/pages/Settings"));

const UserNotifications = lazy(() => import("../modules/UserApp/pages/Notifications"));
const MobileOrders = lazy(() => import("../modules/UserApp/pages/Orders"));
const MobileOrderDetail = lazy(() => import("../modules/UserApp/pages/OrderDetail"));
const LoyaltyHistory = lazy(() => import("../modules/UserApp/pages/LoyaltyHistory"));
const MobileRFQDetail = lazy(() => import("../modules/UserApp/pages/RFQDetail"));
const MobileAddresses = lazy(() => import("../modules/UserApp/pages/Addresses"));
const MobileWishlist = lazy(() => import("../modules/UserApp/pages/Wishlist"));
const MobileOffers = lazy(() => import("../modules/UserApp/pages/Offers"));
const FestivalLandingPage = lazy(() => import("../modules/UserApp/pages/FestivalLandingPage"));
const MobileDailyDeals = lazy(() => import("../modules/UserApp/pages/DailyDeals"));
const MobileFlashSale = lazy(() => import("../modules/UserApp/pages/DailyDeals")); // Wait, DailyDeals or FlashSale? Let's check original imports: lazy(() => import("./modules/UserApp/pages/FlashSale"))
const MobileNewArrivals = lazy(() => import("../modules/UserApp/pages/NewArrivals"));
const MobileCampaignSale = lazy(() => import("../modules/UserApp/pages/CampaignSale"));
const MobileTrackOrder = lazy(() => import("../modules/UserApp/pages/TrackOrder"));
const MobileOrderConfirmation = lazy(() => import("../modules/UserApp/pages/OrderConfirmation"));
const PortalSelection = lazy(() => import("../modules/UserApp/pages/PortalSelection"));
const PortalWelcome = lazy(() => import("../modules/UserApp/pages/PortalWelcome"));
const UserPrivacyPolicy = lazy(() => import("../modules/UserApp/pages/PrivacyPolicy"));
const UserSupport = lazy(() => import("../modules/UserApp/pages/Support"));
const UserTermsConditions = lazy(() => import("../modules/UserApp/pages/TermsConditions"));
const UserAgreement = lazy(() => import("../modules/UserApp/pages/UserAgreement"));
const LegalPage = lazy(() => import("../modules/UserApp/pages/LegalPage"));
const UserReturnPolicy = lazy(() => import("../modules/UserApp/pages/ReturnPolicy"));
const UserWarrantyPolicy = lazy(() => import("../modules/UserApp/pages/WarrantyPolicy"));
const BusinessOnboardingPolicy = lazy(() => import("../modules/UserApp/pages/BusinessOnboardingPolicy"));
const ExecutionAcceptancePolicy = lazy(() => import("../modules/UserApp/pages/ExecutionAcceptancePolicy"));
const ShippingDeliveryPolicy = lazy(() => import("../modules/UserApp/pages/ShippingDeliveryPolicy"));
const AboutUs = lazy(() => import("../modules/UserApp/pages/AboutUs"));
const Returns = lazy(() => import("../modules/UserApp/pages/Returns"));
const ReturnRequestForm = lazy(() => import("../modules/UserApp/pages/ReturnRequestForm"));
const ReturnDetail = lazy(() => import("../modules/UserApp/pages/ReturnDetail"));

// Sub-routes modules
import AdminRoutes from "./AdminRoutes";
import VendorRoutes from "./VendorRoutes";
import DeliveryRoutes from "./DeliveryRoutes";
import B2BRoutes from "./B2BRoutes";

export default function PortalRoutes() {
  return (
    <Routes>
      {/* Backward Compatibility Redirects */}
      <Route path="/portal" element={<Navigate to="/" replace />} />
      <Route path="/portal/retail" element={<Navigate to="/retail" replace />} />
      <Route path="/portal/business" element={<Navigate to="/business" replace />} />

      {/* Main Selection & Welcome pages directly on root domain */}
      <Route
        path="/"
        element={
          <RouteWrapper>
            <PortalSelection />
          </RouteWrapper>
        }
      />
      <Route
        path="/retail"
        element={
          <RouteWrapper>
            <PortalWelcome type="retail" />
          </RouteWrapper>
        }
      />
      <Route
        path="/business"
        element={
          <RouteWrapper>
            <PortalWelcome type="business" />
          </RouteWrapper>
        }
      />

      {/* Delegated Route Domains */}
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route path="/vendor/*" element={<VendorRoutes />} />
      <Route path="/delivery/*" element={<DeliveryRoutes />} />
      <Route path="/b2b-dashboard/*" element={<B2BRoutes />} />

      {/* Mobile Portal Pages */}
      <Route
        path="/home"
        element={
          <RouteWrapper>
            <MobileHome />
          </RouteWrapper>
        }
      />
      <Route
        path="/product/:id"
        element={
          <RouteWrapper>
            <MobileProductDetail />
          </RouteWrapper>
        }
      />
      <Route
        path="/seller/:id"
        element={
          <RouteWrapper>
            <MobileSeller />
          </RouteWrapper>
        }
      />
      <Route
        path="/category/:id"
        element={
          <RouteWrapper>
            <MobileCategory />
          </RouteWrapper>
        }
      />
      <Route
        path="/brand/:id"
        element={
          <RouteWrapper>
            <MobileBrand />
          </RouteWrapper>
        }
      />
      <Route
        path="/categories"
        element={
          <RouteWrapper>
            <MobileCategories />
          </RouteWrapper>
        }
      />
      <Route
        path="/refurbished-categories"
        element={
          <RouteWrapper>
            <RefurbishedCatalog />
          </RouteWrapper>
        }
      />
      <Route
        path="/search"
        element={
          <RouteWrapper>
            <MobileSearch />
          </RouteWrapper>
        }
      />
      <Route
        path="/checkout"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileCheckout />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />

      <Route
        path="/login"
        element={
          <RouteWrapper>
            <MobileLogin isB2BRoute={false} />
          </RouteWrapper>
        }
      />
      <Route
        path="/b2b/login"
        element={
          <RouteWrapper>
            <MobileLogin isB2BRoute={true} />
          </RouteWrapper>
        }
      />
      <Route
        path="/register"
        element={
          <RouteWrapper>
            <MobileRegister isB2BRoute={false} />
          </RouteWrapper>
        }
      />
      <Route
        path="/b2b/register"
        element={
          <RouteWrapper>
            <MobileRegister isB2BRoute={true} />
          </RouteWrapper>
        }
      />
      <Route
        path="/verification"
        element={
          <RouteWrapper>
            <MobileVerification />
          </RouteWrapper>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <RouteWrapper>
            <MobileForgotPassword />
          </RouteWrapper>
        }
      />
      <Route
        path="/reset-password"
        element={
          <RouteWrapper>
            <MobileResetPassword />
          </RouteWrapper>
        }
      />
      <Route
        path="/wishlist"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileWishlist />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/offers"
        element={
          <RouteWrapper>
            <MobileOffers />
          </RouteWrapper>
        }
      />
      <Route
        path="/festival-campaign"
        element={
          <RouteWrapper>
            <FestivalLandingPage />
          </RouteWrapper>
        }
      />
      <Route
        path="/daily-deals"
        element={
          <RouteWrapper>
            <MobileDailyDeals />
          </RouteWrapper>
        }
      />
      <Route
        path="/flash-sale"
        element={
          <RouteWrapper>
            <MobileDailyDeals />
          </RouteWrapper>
        }
      />
      <Route
        path="/new-arrivals"
        element={
          <RouteWrapper>
            <MobileNewArrivals />
          </RouteWrapper>
        }
      />
      <Route
        path="/sale/:slug"
        element={
          <RouteWrapper>
            <MobileCampaignSale />
          </RouteWrapper>
        }
      />
      <Route
        path="/order-confirmation/:orderId"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileOrderConfirmation />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/orders/:orderId"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileOrderDetail />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/rfq/:id"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileRFQDetail />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/track-order/:orderId"
        element={
          <RouteWrapper>
            <MobileTrackOrder />
          </RouteWrapper>
        }
      />
      <Route
        path="/profile"
        element={
          <RouteWrapper>
            <MobileProfile />
          </RouteWrapper>
        }
      />
      <Route
        path="/wallet"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileWallet />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/settings"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileSettings />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />

      <Route
        path="/loyalty-history"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <LoyaltyHistory />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/help-support"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileHelpSupport />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/support-tickets"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MySupportTickets />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/support-chat/:id"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <SupportChat />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/chat/vendor/:threadId"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <CustomerVendorChat />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/chats"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <CustomerChatsList />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/privacy-policy"
        element={
          <RouteWrapper>
            <UserPrivacyPolicy />
          </RouteWrapper>
        }
      />
      <Route
        path="/support"
        element={
          <RouteWrapper>
            <UserSupport />
          </RouteWrapper>
        }
      />
      <Route
        path="/terms-and-conditions"
        element={
          <RouteWrapper>
            <UserTermsConditions />
          </RouteWrapper>
        }
      />
      <Route
        path="/user-agreement"
        element={
          <RouteWrapper>
            <UserAgreement />
          </RouteWrapper>
        }
      />
      <Route
        path="/business-onboarding-policy"
        element={
          <RouteWrapper>
            <BusinessOnboardingPolicy />
          </RouteWrapper>
        }
      />
      <Route
        path="/execution-acceptance-policy"
        element={
          <RouteWrapper>
            <ExecutionAcceptancePolicy />
          </RouteWrapper>
        }
      />
      <Route
        path="/shipping-and-delivery-policy"
        element={
          <RouteWrapper>
            <ShippingDeliveryPolicy />
          </RouteWrapper>
        }
      />
      <Route
        path="/legal/:type"
        element={
          <RouteWrapper>
            <LegalPage />
          </RouteWrapper>
        }
      />
      <Route
        path="/return-policy"
        element={
          <RouteWrapper>
            <UserReturnPolicy />
          </RouteWrapper>
        }
      />
      <Route
        path="/warranty-policy"
        element={
          <RouteWrapper>
            <UserWarrantyPolicy />
          </RouteWrapper>
        }
      />
      <Route
        path="/about-us"
        element={
          <RouteWrapper>
            <AboutUs />
          </RouteWrapper>
        }
      />
      <Route
        path="/notifications"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <UserNotifications />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/orders"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileOrders />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/addresses"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <MobileAddresses />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/returns"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <Returns />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/returns/request/:orderId"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <ReturnRequestForm />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/returns/:id"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <ReturnDetail />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/product-request/new"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <UserProductRequestForm />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/product-requests/new"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <UserProductRequestForm />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/product-requests"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <UserProductRequestHistory />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />
      <Route
        path="/product-requests/:id"
        element={
          <RouteWrapper>
            <ProtectedRoute>
              <UserProductRequestDetail />
            </ProtectedRoute>
          </RouteWrapper>
        }
      />

      {/* Portal fallback for unknown routes redirects to selection */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
