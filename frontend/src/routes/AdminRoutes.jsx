import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminProtectedRoute from "../modules/Admin/components/AdminProtectedRoute";
import AdminLayout from "../modules/Admin/components/Layout/AdminLayout";

// Lazy Loaded Pages
const AdminLogin = lazy(() => import("../modules/Admin/pages/Login"));
const Dashboard = lazy(() => import("../modules/Admin/pages/Dashboard"));
const AccountTeamList = lazy(() => import("../modules/Admin/pages/accountTeam/AccountTeamList"));
const AuditLogs = lazy(() => import("../modules/Admin/pages/auditLogs/AuditLogs"));
const Products = lazy(() => import("../modules/Admin/pages/Products"));
const ProductForm = lazy(() => import("../modules/Admin/pages/ProductForm"));
const AdminOrders = lazy(() => import("../modules/Admin/pages/Orders"));
const OrderDetail = lazy(() => import("../modules/Admin/pages/OrderDetail"));
const ReturnRequests = lazy(() => import("../modules/Admin/pages/ReturnRequests"));
const ReturnRequestDetail = lazy(() => import("../modules/Admin/pages/ReturnRequestDetail"));
const Categories = lazy(() => import("../modules/Admin/pages/Categories"));
const Brands = lazy(() => import("../modules/Admin/pages/Brands"));
const Customers = lazy(() => import("../modules/Admin/pages/Customers"));
const Campaigns = lazy(() => import("../modules/Admin/pages/Campaigns"));
const Banners = lazy(() => import("../modules/Admin/pages/Banners"));
const Reviews = lazy(() => import("../modules/Admin/pages/Reviews"));
const Analytics = lazy(() => import("../modules/Admin/pages/Analytics"));
const Content = lazy(() => import("../modules/Admin/pages/Content"));
const Settings = lazy(() => import("../modules/Admin/pages/Settings"));
const More = lazy(() => import("../modules/Admin/pages/More"));
const PromoCodes = lazy(() => import("../modules/Admin/pages/PromoCodes"));
const AllOrders = lazy(() => import("../modules/Admin/pages/orders/AllOrders"));
const OrderTracking = lazy(() => import("../modules/Admin/pages/orders/OrderTracking"));
const Invoice = lazy(() => import("../modules/Admin/pages/orders/Invoice"));
const ManageProducts = lazy(() => import("../modules/Admin/pages/products/ManageProducts"));
const TaxPricing = lazy(() => import("../modules/Admin/pages/products/TaxPricing"));
const ProductRatings = lazy(() => import("../modules/Admin/pages/products/ProductRatings"));
const ManageCategories = lazy(() => import("../modules/Admin/pages/categories/ManageCategories"));
const CategoryOrder = lazy(() => import("../modules/Admin/pages/categories/CategoryOrder"));
const ManageBrands = lazy(() => import("../modules/Admin/pages/brands/ManageBrands"));
const ViewCustomers = lazy(() => import("../modules/Admin/pages/customers/ViewCustomers"));
const CustomerAddresses = lazy(() => import("../modules/Admin/pages/customers/Addresses"));
const Transactions = lazy(() => import("../modules/Admin/pages/customers/Transactions"));
const CustomerDetailPage = lazy(() => import("../modules/Admin/pages/customers/CustomerDetailPage"));
const DeliveryBoys = lazy(() => import("../modules/Admin/pages/delivery/DeliveryBoys"));
const CashCollection = lazy(() => import("../modules/Admin/pages/delivery/CashCollection"));
const AssignDelivery = lazy(() => import("../modules/Admin/pages/delivery/AssignDelivery"));
const Vendors = lazy(() => import("../modules/Admin/pages/Vendors"));
const ManageVendors = lazy(() => import("../modules/Admin/pages/vendors/ManageVendors"));
const PendingApprovals = lazy(() => import("../modules/Admin/pages/vendors/PendingApprovals"));
const VendorDetail = lazy(() => import("../modules/Admin/pages/vendors/VendorDetail"));
const CommissionRates = lazy(() => import("../modules/Admin/pages/vendors/CommissionRates"));
const AdminVendorAnalytics = lazy(() => import("../modules/Admin/pages/vendors/VendorAnalytics"));
const ManagedShops = lazy(() => import("../modules/Admin/pages/vendors/ManagedShops"));
const ManagedShopDetails = lazy(() => import("../modules/Admin/pages/vendors/ManagedShopDetails"));
const AdminProductApprovals = lazy(() => import("../modules/Admin/pages/vendors/ProductApprovals"));
const B2BSellerRequests = lazy(() => import("../modules/Admin/pages/vendors/B2BSellerRequests"));
const B2BUsersDashboard = lazy(() => import("../modules/Admin/pages/b2b-users/B2BUsersDashboard"));
const ManageB2BUsers = lazy(() => import("../modules/Admin/pages/b2b-users/ManageB2BUsers"));
const PendingB2BApprovals = lazy(() => import("../modules/Admin/pages/b2b-users/PendingB2BApprovals"));
const B2BAnalytics = lazy(() => import("../modules/Admin/pages/b2b-users/B2BAnalytics"));
const B2BMarketplace = lazy(() => import("../modules/Admin/pages/b2b/B2BMarketplace"));
const BusinessUsers = lazy(() => import("../modules/Admin/pages/b2b/BusinessUsers"));
const B2BProducts = lazy(() => import("../modules/Admin/pages/b2b/B2BProducts"));
const B2BOrders = lazy(() => import("../modules/Admin/pages/b2b/B2BOrders"));
const B2BSettings = lazy(() => import("../modules/Admin/pages/b2b/B2BSettings"));
const CompanyManagement = lazy(() => import("../modules/Admin/pages/b2b/CompanyManagement"));
const AgreementTemplateManagement = lazy(() => import("../modules/Admin/pages/b2b/AgreementTemplateManagement"));
const AdminB2BEnquiries = lazy(() => import("../modules/Admin/pages/b2b-enquiries/AdminB2BEnquiries"));
const AdminRFQDetail = lazy(() => import("../modules/Admin/pages/b2b-enquiries/AdminRFQDetail"));
const AdminSellerResponses = lazy(() => import("../modules/Admin/pages/b2b-enquiries/AdminSellerResponses"));
const AdminRFQDisputes = lazy(() => import("../modules/Admin/pages/b2b-enquiries/AdminRFQDisputes"));
const AdminRFQSpamMonitor = lazy(() => import("../modules/Admin/pages/b2b-enquiries/AdminRFQSpamMonitor"));
const RefurbishedMarketplace = lazy(() => import("../modules/Admin/pages/refurbished/RefurbishedMarketplace"));
const RefurbishedDashboard = lazy(() => import("../modules/Admin/pages/refurbished/RefurbishedDashboard"));
const ProductApprovals = lazy(() => import("../modules/Admin/pages/refurbished/ProductApprovals"));
const FraudModeration = lazy(() => import("../modules/Admin/pages/refurbished/FraudModeration"));
const ComplaintsReturns = lazy(() => import("../modules/Admin/pages/refurbished/ComplaintsReturns"));
const RefurbishedCategories = lazy(() => import("../modules/Admin/pages/refurbished/RefurbishedCategories"));
const HomeSliders = lazy(() => import("../modules/Admin/pages/offers/HomeSliders"));
const FestivalOffers = lazy(() => import("../modules/Admin/pages/offers/FestivalOffers"));
const PushNotifications = lazy(() => import("../modules/Admin/pages/notifications/PushNotifications"));
const CustomMessages = lazy(() => import("../modules/Admin/pages/notifications/CustomMessages"));
const AllNotifications = lazy(() => import("../modules/Admin/pages/notifications/AllNotifications"));
const LiveChat = lazy(() => import("../modules/Admin/pages/support/LiveChat"));
const PLEShopChats = lazy(() => import("../modules/Admin/pages/support/PLEShopChats"));
const TicketTypes = lazy(() => import("../modules/Admin/pages/support/TicketTypes"));
const Tickets = lazy(() => import("../modules/Admin/pages/support/Tickets"));
const AdminManagedVendorChatHub = lazy(() => import("../modules/Admin/pages/managedVendor/AdminManagedVendorChatHub"));
const SalesReport = lazy(() => import("../modules/Admin/pages/reports/SalesReport"));
const InventoryReport = lazy(() => import("../modules/Admin/pages/reports/InventoryReport"));
const RevenueOverview = lazy(() => import("../modules/Admin/pages/finance/RevenueOverview"));
const ProfitLoss = lazy(() => import("../modules/Admin/pages/finance/ProfitLoss"));
const OrderTrends = lazy(() => import("../modules/Admin/pages/finance/OrderTrends"));
const PaymentBreakdown = lazy(() => import("../modules/Admin/pages/finance/PaymentBreakdown"));
const TaxReports = lazy(() => import("../modules/Admin/pages/finance/TaxReports"));
const RefundReports = lazy(() => import("../modules/Admin/pages/finance/RefundReports"));
const GeneralSettings = lazy(() => import("../modules/Admin/pages/settings/GeneralSettings"));
const PaymentShippingSettings = lazy(() => import("../modules/Admin/pages/settings/PaymentShippingSettings"));
const OrdersCustomersSettings = lazy(() => import("../modules/Admin/pages/settings/OrdersCustomersSettings"));
const ProductsInventorySettings = lazy(() => import("../modules/Admin/pages/settings/ProductsInventorySettings"));
const ContentFeaturesSettings = lazy(() => import("../modules/Admin/pages/settings/ContentFeaturesSettings"));
const NotificationsSEOSettings = lazy(() => import("../modules/Admin/pages/settings/NotificationsSEOSettings"));
const PrivacyPolicy = lazy(() => import("../modules/Admin/pages/policies/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("../modules/Admin/pages/policies/RefundPolicy"));
const TermsConditions = lazy(() => import("../modules/Admin/pages/policies/TermsConditions"));
const PushConfig = lazy(() => import("../modules/Admin/pages/firebase/PushConfig"));
const Authentication = lazy(() => import("../modules/Admin/pages/firebase/Authentication"));
const AdminDeliveryManager = lazy(() => import("../modules/Admin/pages/AdminDeliveryManager"));

// Admin Loyalty Program Pages
const AdminLoyaltyDashboard = lazy(() => import("../modules/Admin/pages/loyalty/Dashboard"));
const AdminLoyaltyRules = lazy(() => import("../modules/Admin/pages/loyalty/Rules"));
const AdminLoyaltyUsers = lazy(() => import("../modules/Admin/pages/loyalty/Users"));

// Admin Wallet Management
const AdminWalletDashboard = lazy(() => import("../modules/Admin/pages/wallet/AdminWalletDashboard"));

// Product Requests System Pages
const AdminProductRequestsDashboard = lazy(() => import("../modules/Admin/pages/ProductRequestsDashboard"));

// Chat Moderation
const ChatModerationDashboard = lazy(() => import("../modules/Admin/pages/ChatModerationDashboard"));

// Product Enquiries System Pages
const AdminProductEnquiries = lazy(() => import("../modules/Admin/pages/AdminProductEnquiries"));

// Offers & Promotion Management System Pages
const OfferDashboard = lazy(() => import("../modules/offers/pages/OfferDashboard"));
const OfferList = lazy(() => import("../modules/offers/pages/OfferList"));
const CreateOffer = lazy(() => import("../modules/offers/pages/CreateOffer"));
const EditOffer = lazy(() => import("../modules/offers/pages/EditOffer"));
const OfferDetails = lazy(() => import("../modules/offers/pages/OfferDetails"));

// Landing Page CMS Pages
const LandingPageCMSLayout = lazy(() => import("../modules/Admin/pages/landing-page/LandingPageCMSLayout"));
const LandingPageDashboard = lazy(() => import("../modules/Admin/pages/landing-page/LandingPageDashboard"));
const HeroEditor = lazy(() => import("../modules/Admin/pages/landing-page/HeroEditor"));
const ServicesEditor = lazy(() => import("../modules/Admin/pages/landing-page/ServicesEditor"));
const FeaturesEditor = lazy(() => import("../modules/Admin/pages/landing-page/FeaturesEditor"));
const ComparisonEditor = lazy(() => import("../modules/Admin/pages/landing-page/ComparisonEditor"));
const StatsEditor = lazy(() => import("../modules/Admin/pages/landing-page/StatsEditor"));
const TestimonialsEditor = lazy(() => import("../modules/Admin/pages/landing-page/TestimonialsEditor"));
const ProductShowcaseEditor = lazy(() => import("../modules/Admin/pages/landing-page/ProductShowcaseEditor"));
const PricingEditor = lazy(() => import("../modules/Admin/pages/landing-page/PricingEditor"));
const FAQEditor = lazy(() => import("../modules/Admin/pages/landing-page/FAQEditor"));
const GalleryEditor = lazy(() => import("../modules/Admin/pages/landing-page/GalleryEditor"));
const ContactEditor = lazy(() => import("../modules/Admin/pages/landing-page/ContactEditor"));
const FooterEditor = lazy(() => import("../modules/Admin/pages/landing-page/FooterEditor"));
const SEOSettingsEditor = lazy(() => import("../modules/Admin/pages/landing-page/SEOSettingsEditor"));
const BlogEditor = lazy(() => import("../modules/Admin/pages/landing-page/BlogEditor"));
const AdLandingPagesEditor = lazy(() => import("../modules/Admin/pages/landing-page/AdLandingPagesEditor"));
const PortfolioHighlightsEditor = lazy(() => import("../modules/Admin/pages/landing-page/PortfolioHighlightsEditor"));
const CPOEditor = lazy(() => import("../modules/Admin/pages/landing-page/CPOEditor"));
const GPOEditor = lazy(() => import("../modules/Admin/pages/landing-page/GPOEditor"));
const SmartDealsEditor = lazy(() => import("../modules/Admin/pages/landing-page/SmartDealsEditor"));
const LoyaltyRewardsEditor = lazy(() => import("../modules/Admin/pages/landing-page/LoyaltyRewardsEditor"));
const ZeroMaintenanceEditor = lazy(() => import("../modules/Admin/pages/landing-page/ZeroMaintenanceEditor"));
const CatalogueEditor = lazy(() => import("../modules/Admin/pages/landing-page/CatalogueEditor"));
const CategoriesShowcaseEditor = lazy(() => import("../modules/Admin/pages/landing-page/CategoriesShowcaseEditor"));

const AboutPageDashboard = lazy(() => import("../modules/Admin/pages/about-page/AboutPageDashboard"));


// Portfolio Page CMS Pages
const PortfolioPageDashboard = lazy(() => import("../modules/Admin/pages/portfolio-page/PortfolioPageDashboard"));

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route
        path="/"
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="account-team" element={<AccountTeamList />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="products/manage-products" element={<ManageProducts />} />
        <Route path="products/tax-pricing" element={<TaxPricing />} />
        <Route path="products/product-ratings" element={<ProductRatings />} />
        <Route path="more" element={<More />} />
        <Route path="categories" element={<Categories />} />
        <Route path="categories/manage-categories" element={<ManageCategories />} />
        <Route path="categories/category-order" element={<CategoryOrder />} />
        <Route path="brands" element={<Brands />} />
        <Route path="brands/manage-brands" element={<ManageBrands />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="orders/:id/invoice" element={<Invoice />} />
        <Route path="orders/all-orders" element={<AllOrders />} />
        <Route path="orders/order-tracking" element={<OrderTracking />} />
        <Route path="return-requests" element={<ReturnRequests />} />
        <Route path="return-requests/:id" element={<ReturnRequestDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/view-customers" element={<ViewCustomers />} />
        <Route path="customers/addresses" element={<CustomerAddresses />} />
        <Route path="customers/transactions" element={<Transactions />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />

        <Route path="delivery" element={<DeliveryBoys />} />
        <Route path="delivery/delivery-boys" element={<DeliveryBoys />} />
        <Route path="delivery/cash-collection" element={<CashCollection />} />
        <Route path="delivery/assign-delivery" element={<AssignDelivery />} />
        <Route path="delivery-control" element={<AdminDeliveryManager />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="vendors/manage-vendors" element={<ManageVendors />} />
        <Route path="vendors/pending-approvals" element={<PendingApprovals />} />
        <Route path="vendors/commission-rates" element={<CommissionRates />} />
        <Route path="vendors/vendor-analytics" element={<AdminVendorAnalytics />} />
        <Route path="vendors/:id" element={<VendorDetail />} />
        <Route path="vendors/managed-shops" element={<ManagedShops />} />
        <Route path="vendors/managed-shops/:id" element={<ManagedShopDetails />} />
        <Route path="vendors/product-approvals" element={<AdminProductApprovals />} />
        <Route path="vendors/b2b-requests" element={<B2BSellerRequests />} />

        <Route path="b2b-users" element={<B2BUsersDashboard />} />
        <Route path="b2b-users/manage" element={<ManageB2BUsers />} />
        <Route path="b2b-users/pending" element={<PendingB2BApprovals />} />
        <Route path="b2b-users/analytics" element={<B2BAnalytics />} />

        <Route path="b2b" element={<B2BMarketplace />} />
        <Route path="b2b/business-users" element={<BusinessUsers />} />
        <Route path="b2b/b2b-products" element={<B2BProducts />} />
        <Route path="b2b/b2b-orders" element={<B2BOrders />} />
        <Route path="b2b/b2b-settings" element={<B2BSettings />} />
        <Route path="b2b/companies" element={<CompanyManagement />} />
        <Route path="b2b/agreement-template" element={<AgreementTemplateManagement />} />

        <Route path="b2b-enquiries" element={<AdminB2BEnquiries />} />
        <Route path="b2b-enquiries/all" element={<AdminB2BEnquiries />} />
        <Route path="b2b-enquiries/:id" element={<AdminRFQDetail />} />
        <Route path="b2b-enquiries/seller-responses" element={<AdminSellerResponses />} />
        <Route path="b2b-enquiries/disputes" element={<AdminRFQDisputes />} />
        <Route path="b2b-enquiries/spam" element={<AdminRFQSpamMonitor />} />

        <Route path="refurbished" element={<RefurbishedMarketplace />} />
        <Route path="refurbished/dashboard" element={<RefurbishedDashboard />} />
        <Route path="refurbished/approvals" element={<ProductApprovals />} />
        <Route path="refurbished/moderation" element={<FraudModeration />} />
        <Route path="refurbished/complaints" element={<ComplaintsReturns />} />
        <Route path="refurbished/categories" element={<RefurbishedCategories />} />

        <Route path="offers" element={<HomeSliders />} />
        <Route path="offers/home-sliders" element={<HomeSliders />} />
        <Route path="offers/festival-offers" element={<FestivalOffers />} />

        <Route path="offers-management" element={<Navigate to="dashboard" replace />} />
        <Route path="offers-management/dashboard" element={<OfferDashboard />} />
        <Route path="offers-management/list" element={<OfferList />} />
        <Route path="offers-management/create" element={<CreateOffer />} />
        <Route path="offers-management/edit/:id" element={<EditOffer />} />
        <Route path="offers-management/details/:id" element={<OfferDetails />} />

        <Route path="promocodes" element={<PromoCodes />} />
        <Route path="notifications" element={<AllNotifications />} />
        <Route path="notifications/push-notifications" element={<PushNotifications />} />
        <Route path="notifications/custom-messages" element={<CustomMessages />} />
        <Route path="support" element={<Tickets />} />
        <Route path="support/live-chat" element={<LiveChat />} />
        <Route path="ple-shop-chats" element={<PLEShopChats />} />
        <Route path="managed-vendor-chats" element={<AdminManagedVendorChatHub />} />
        <Route path="support/ticket-types" element={<TicketTypes />} />
        <Route path="support/tickets" element={<Tickets />} />
        <Route path="reports" element={<SalesReport />} />
        <Route path="reports/sales-report" element={<SalesReport />} />
        <Route path="reports/inventory-report" element={<InventoryReport />} />
        <Route path="finance" element={<RevenueOverview />} />
        <Route path="finance/revenue-overview" element={<RevenueOverview />} />
        <Route path="finance/profit-loss" element={<ProfitLoss />} />
        <Route path="finance/order-trends" element={<OrderTrends />} />
        <Route path="finance/payment-breakdown" element={<PaymentBreakdown />} />
        <Route path="finance/tax-reports" element={<TaxReports />} />
        <Route path="finance/refund-reports" element={<RefundReports />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Navigate to="/admin/settings/general" replace />} />
        <Route path="settings/general" element={<Settings />} />
        <Route path="settings/payment-shipping" element={<Settings />} />
        <Route path="settings/orders-customers" element={<Settings />} />
        <Route path="settings/products-inventory" element={<Settings />} />
        <Route path="settings/content-features" element={<Settings />} />
        <Route path="settings/notifications-seo" element={<Settings />} />
        <Route path="policies" element={<PrivacyPolicy />} />
        <Route path="policies/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="policies/refund-policy" element={<RefundPolicy />} />
        <Route path="policies/terms-conditions" element={<TermsConditions />} />
        <Route path="firebase" element={<PushConfig />} />
        <Route path="firebase/push-config" element={<PushConfig />} />
        <Route path="firebase/authentication" element={<Authentication />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="banners" element={<Banners />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="content" element={<Content />} />
        <Route path="product-requests" element={<AdminProductRequestsDashboard />} />
        <Route path="product-enquiries" element={<AdminProductEnquiries />} />

        <Route path="loyalty" element={<Navigate to="dashboard" replace />} />
        <Route path="loyalty/dashboard" element={<AdminLoyaltyDashboard />} />
        <Route path="loyalty/rules" element={<AdminLoyaltyRules />} />
        <Route path="loyalty/users" element={<AdminLoyaltyUsers />} />

        <Route path="wallet-management" element={<AdminWalletDashboard />} />

        <Route path="landing-page" element={<LandingPageCMSLayout />}>
          <Route index element={<LandingPageDashboard />} />
          <Route path="hero" element={<HeroEditor />} />
          <Route path="services" element={<ServicesEditor />} />
          <Route path="features" element={<FeaturesEditor />} />
          <Route path="comparison" element={<ComparisonEditor />} />
          <Route path="stats" element={<StatsEditor />} />
          <Route path="testimonials" element={<TestimonialsEditor />} />
          <Route path="products" element={<ProductShowcaseEditor />} />
          <Route path="pricing" element={<PricingEditor />} />
          <Route path="faq" element={<FAQEditor />} />
          <Route path="gallery" element={<GalleryEditor />} />
          <Route path="contact" element={<ContactEditor />} />
          <Route path="footer" element={<FooterEditor />} />
          <Route path="seo" element={<SEOSettingsEditor />} />
          <Route path="blogs" element={<BlogEditor />} />
          <Route path="ad-landing-pages" element={<AdLandingPagesEditor />} />
          <Route path="portfolio-highlights" element={<PortfolioHighlightsEditor />} />
          <Route path="cpo" element={<CPOEditor />} />
          <Route path="gpo" element={<GPOEditor />} />
          <Route path="smart-deals" element={<SmartDealsEditor />} />
          <Route path="loyalty-rewards" element={<LoyaltyRewardsEditor />} />
          <Route path="zero-maintenance" element={<ZeroMaintenanceEditor />} />
          <Route path="catalogue" element={<CatalogueEditor />} />
          <Route path="product-categories" element={<CategoriesShowcaseEditor />} />
        </Route>

        <Route path="about-page/*" element={<AboutPageDashboard />} />
        <Route path="portfolio-page/*" element={<PortfolioPageDashboard />} />
        <Route path="chat-moderation" element={<ChatModerationDashboard />} />

      </Route>
    </Routes>
  );
}
