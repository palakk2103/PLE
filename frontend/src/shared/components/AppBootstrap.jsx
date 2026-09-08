import { useEffect } from "react";
import api from "../utils/api";
import { useAuthStore } from "../store/authStore";
import { useVendorAuthStore } from "../../modules/Vendor/store/vendorAuthStore";
import { useDeliveryAuthStore } from "../../modules/Delivery/store/deliveryStore";
import { useAdminAuthStore } from "../../modules/Admin/store/adminStore";
import { useB2BAdminStore } from "../../modules/B2BAdmin/store/b2bAdminStore";
import { useB2bStore } from "../store/b2bStore";
import socketService from "../utils/socket";
import toast from "react-hot-toast";
import { 
  initializePushNotifications, 
  registerFCMToken, 
  setupForegroundNotificationHandler, 
  unregisterFCMToken 
} from "../../services/pushNotificationService";

const PRODUCTS_CACHE_KEY = "user-catalog-products-cache";
const VENDORS_CACHE_KEY = "user-catalog-vendors-cache";
const BRANDS_CACHE_KEY = "user-catalog-brands-cache";

const normalizeProduct = (raw) => {
  const vendorObj =
    raw?.vendorId && typeof raw.vendorId === "object" ? raw.vendorId : null;
  const brandObj =
    raw?.brandId && typeof raw.brandId === "object" ? raw.brandId : null;
  const categoryObj =
    raw?.categoryId && typeof raw.categoryId === "object" ? raw.categoryId : null;

  return {
    ...raw,
    id: raw?._id || raw?.id,
    vendorId: vendorObj?._id || raw?.vendorId,
    brandId: brandObj?._id || raw?.brandId,
    categoryId: categoryObj?._id || raw?.categoryId,
    vendorName: raw?.vendorName || vendorObj?.storeName || "",
    brandName: raw?.brandName || brandObj?.name || "",
    categoryName: raw?.categoryName || categoryObj?.name || "",
    image: raw?.image || raw?.images?.[0] || "",
    images: Array.isArray(raw?.images) ? raw.images : raw?.image ? [raw.image] : [],
  };
};

const normalizeVendor = (raw) => ({
  ...raw,
  id: raw?._id || raw?.id,
});

const normalizeBrand = (raw) => ({
  ...raw,
  id: raw?._id || raw?.id,
});

const AppBootstrap = () => {
  const user = useAuthStore((state) => state.user);
  const mainAuthIsAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const b2bAuthIsAuthenticated = useB2BAdminStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Initialize authentication stores to synchronize tokens and clear stale loading flags
    try { useAuthStore.getState().initialize(); } catch (e) { console.warn(e); }
    try { useVendorAuthStore.getState().initialize(); } catch (e) { console.warn(e); }
    try { useDeliveryAuthStore.getState().initialize(); } catch (e) { console.warn(e); }
    try { useAdminAuthStore.getState().initialize(); } catch (e) { console.warn(e); }
    
    // Initialize FCM Service Worker
    initializePushNotifications();
  }, []);

  useEffect(() => {
    // Self-healing synchronization for B2B session states
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const refreshToken = localStorage.getItem('refresh-token') || sessionStorage.getItem('refresh-token');
      const b2bToken = localStorage.getItem('b2bAdminToken') || sessionStorage.getItem('b2bAdminToken');
      const mainAuth = useAuthStore.getState();
      const b2bAuth = useB2BAdminStore.getState();

      const role = mainAuth.user?.role;
      const isB2BUser = role === 'b2bAdmin' || role === 'b2bEmployee' || mainAuth.user?.isEmployee;

      if (!token && !b2bToken && !refreshToken) {
        if (mainAuth.isAuthenticated) {
          try { mainAuth.logout(); } catch (e) {}
        }
        if (b2bAuth.isAuthenticated) {
          try { b2bAuth.logout(); } catch (e) {}
        }
      } else if (b2bAuth.isAuthenticated && b2bToken && !mainAuth.isAuthenticated) {
        localStorage.setItem('token', b2bToken);
        sessionStorage.setItem('token', b2bToken);
        useAuthStore.setState({ isAuthenticated: true, token: b2bToken, user: b2bAuth.adminProfile });
      } else if (mainAuth.isAuthenticated && token && isB2BUser && !b2bAuth.isAuthenticated) {
        localStorage.setItem('b2bAdminToken', token);
        sessionStorage.setItem('b2bAdminToken', token);
        useB2BAdminStore.setState({ isAuthenticated: true, adminProfile: mainAuth.user });
      } else if (mainAuth.isAuthenticated && !isB2BUser && b2bAuth.isAuthenticated) {
        try { b2bAuth.logout(); } catch (e) {}
      }

      // Synchronize the B2B store portal role to business_buyer if authenticated as a B2B user,
      // or to customer if the authenticated user is a standard B2C customer.
      if (mainAuth.isAuthenticated || b2bAuth.isAuthenticated) {
        const b2bStore = useB2bStore.getState();
        if (isB2BUser) {
          if (b2bStore.userRole !== 'business_buyer') {
            b2bStore.setUserRole('business_buyer');
          }
        } else {
          if (b2bStore.userRole !== 'customer') {
            b2bStore.setUserRole('customer');
          }
        }
      }
    } catch (e) {
      console.warn("B2B self-healing sync failed:", e);
    }
  }, [mainAuthIsAuthenticated, b2bAuthIsAuthenticated, user]);

  useEffect(() => {
    let cancelled = false;

    const syncCatalog = async () => {
      try {
        const [productsRes, vendorsRes, brandsRes] = await Promise.allSettled([
          api.get("/products", { params: { page: 1, limit: 500 } }),
          api.get("/vendors/all", { params: { status: "approved", page: 1, limit: 200 } }),
          api.get("/brands/all"),
        ]);

        let updated = false;

        if (productsRes.status === "fulfilled" && !cancelled) {
          const payload = productsRes.value?.data;
          const list = Array.isArray(payload?.products)
            ? payload.products.map(normalizeProduct)
            : [];
          if (list.length) {
            localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(list));
            updated = true;
          }
        }

        if (vendorsRes.status === "fulfilled" && !cancelled) {
          const payload = vendorsRes.value?.data;
          const list = Array.isArray(payload?.vendors)
            ? payload.vendors.map(normalizeVendor)
            : [];
          if (list.length) {
            localStorage.setItem(VENDORS_CACHE_KEY, JSON.stringify(list));
            updated = true;
          }
        }

        if (brandsRes.status === "fulfilled" && !cancelled) {
          const payload = brandsRes.value?.data;
          const list = Array.isArray(payload) ? payload.map(normalizeBrand) : [];
          if (list.length) {
            localStorage.setItem(BRANDS_CACHE_KEY, JSON.stringify(list));
            updated = true;
          }
        }

        if (updated && !cancelled) {
          window.dispatchEvent(new Event("catalog-cache-updated"));
        }
      } catch {
        // Keep static fallback silently.
      }
    };

    syncCatalog();
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    if (!user?.id) {
      // Unregister token on logout
      unregisterFCMToken();
      return;
    }
    
    // Register FCM Token for logged-in user
    registerFCMToken(true).catch(err => console.warn('FCM registration skipped or failed:', err));
    
    // Setup foreground notifications listener
    const unsubscribeForeground = setupForegroundNotificationHandler((payload) => {
      console.log('Foreground push notification received in AppBootstrap:', payload);
      // Optional in-app toast for push notification
      toast(payload.notification.title + '\n' + payload.notification.body, {
        icon: '📬',
        duration: 5000,
        position: 'top-right'
      });
    });

    const socket = socketService.getSocket();
    socket.emit('join_user_room', user.id);
    
    const handleReturnUpdate = (data) => {
      toast.success(data.message || `Return request status updated to ${data.status}`, {
        duration: 5000,
        position: 'top-right',
        style: { background: '#10B981', color: '#fff', fontWeight: 'bold' }
      });
      window.dispatchEvent(new CustomEvent('return-status-updated', { detail: data }));
    };
    
    socket.on('return_status_updated', handleReturnUpdate);
    
    return () => {
      if (typeof unsubscribeForeground === 'function') {
        unsubscribeForeground();
      }
      socket.off('return_status_updated', handleReturnUpdate);
      socket.emit('leave_user_room', user.id);
    };
  }, [user?.id]);

  return null;
};

export default AppBootstrap;
