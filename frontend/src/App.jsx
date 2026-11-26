import { Suspense, useEffect } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import toast, { Toaster, useToasterStore } from "react-hot-toast";

import CartDrawer from "./shared/components/Cart/CartDrawer";
import ErrorBoundary from "./shared/components/ErrorBoundary/ErrorBoundary";
import ScrollToTop from "./shared/components/ScrollToTop";
import AppBootstrap from "./shared/components/AppBootstrap";
import OfflineDetector from "./shared/components/OfflineDetector";
import AppSuspenseLoader from "./shared/components/AppSuspenseLoader";
import SEO from "./shared/components/SEO/SEO";

import { isLandingDomain } from "./shared/utils/domain";
import LandingRoutes from "./routes/LandingRoutes";
import PortalRoutes from "./routes/PortalRoutes";

// Helper component to limit active toast notifications to exactly 1
const ToastLimitHandler = () => {
  const { toasts } = useToasterStore();

  useEffect(() => {
    // Only allow 1 visible toast at a time
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= 1)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  return null;
};

const ActiveRoutes = () => {
  if (isLandingDomain()) {
    return <LandingRoutes />;
  }
  return <PortalRoutes />;
};

function App() {
  return (
    <ErrorBoundary>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}>
        <SEO />
        <OfflineDetector>
          <AppBootstrap />
          <ScrollToTop />
          <Suspense fallback={<AppSuspenseLoader />}>
            <ActiveRoutes />
          </Suspense>
          <CartDrawer />
          <Toaster
            position="top-right"
            containerStyle={{
              zIndex: 999999,
            }}
            gutter={10}
            toastOptions={{
              duration: 3000,
              style: {
                background: "#ffffff",
                color: "#1f2937",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: 1.45,
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                borderLeft: "4px solid #6b7280",
                boxShadow:
                  "0 10px 25px -5px rgba(0,0,0,0.12), 0 4px 10px -4px rgba(0,0,0,0.08)",
                maxWidth: "min(380px, calc(100vw - 32px))",
                wordBreak: "break-word",
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: "#16a34a",
                  secondary: "#fff",
                },
                style: {
                  borderLeft: "4px solid #16a34a",
                  background: "#f0fdf4",
                  color: "#14532d",
                },
              },
              error: {
                duration: 4500,
                iconTheme: {
                  primary: "#dc2626",
                  secondary: "#fff",
                },
                style: {
                  borderLeft: "4px solid #dc2626",
                  background: "#fef2f2",
                  color: "#7f1d1d",
                },
              },
              loading: {
                style: {
                  borderLeft: "4px solid #2563eb",
                },
              },
            }}
          />
          <ToastLimitHandler />
        </OfflineDetector>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
