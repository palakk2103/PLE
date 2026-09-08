import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL, AUTH_REDIRECT_LOCK_KEY, AUTH_REDIRECT_LOCK_MS } from './constants';
import { products as mockProductsList } from '../../data/products';


const AUTH_SCOPES = {
  admin: {
    prefix: '/admin',
    accessKey: 'adminToken',
    refreshKey: 'adminRefreshToken',
    persistKey: 'admin-auth-storage',
    loginPath: '/admin/login',
    areaPrefix: '/admin',
  },
  vendor: {
    prefix: '/vendor',
    accessKey: 'vendor-token',
    refreshKey: 'vendor-refresh-token',
    persistKey: 'vendor-auth-storage',
    loginPath: '/vendor/login',
    areaPrefix: '/vendor',
  },
  delivery: {
    prefix: '/delivery',
    accessKey: 'delivery-token',
    refreshKey: 'delivery-refresh-token',
    persistKey: 'delivery-auth-storage',
    loginPath: '/delivery/login',
    areaPrefix: '/delivery',
  },
  b2bAdmin: {
    prefix: '/b2b-user',
    accessKey: 'b2bAdminToken',
    refreshKey: 'b2bAdminRefreshToken', // Not implemented yet, but keeping for structure
    persistKey: 'b2badmin-auth-storage', // Need to match exactly what is in b2bAdminStore.js
    loginPath: '/',
    areaPrefix: '/b2b-dashboard',
  },
  user: {
    prefix: '/user',
    accessKey: 'token',
    refreshKey: 'refresh-token',
    persistKey: 'auth-storage',
    loginPath: '/',
    areaPrefix: '/',
  },
};

const EXCLUDED_AUTH_SUFFIXES = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/verify-reset-otp',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/logout',
];

const refreshInFlight = {
  admin: null,
  vendor: null,
  delivery: null,
  user: null,
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getStorageItem = (key) => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

const setStorageItem = (key, value) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
  sessionStorage.removeItem(key);
};

const removeStorageItem = (key) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
};

const redirectTo = (path) => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const currentPath = window.location.pathname;
  const lockUntil = Number(sessionStorage.getItem(AUTH_REDIRECT_LOCK_KEY) || 0);

  if (currentPath === path) return;
  if (now < lockUntil) return;

  sessionStorage.setItem(AUTH_REDIRECT_LOCK_KEY, String(now + AUTH_REDIRECT_LOCK_MS));
  window.location.href = path;
};

const getScopeFromUrl = (url = '') => {
  if (url.startsWith('/admin')) return 'admin';
  if (url.startsWith('/vendor')) return 'vendor';
  if (url.startsWith('/delivery')) return 'delivery';
  if (url.startsWith('/b2b-user')) return 'b2bAdmin';
  return 'user';
};

const getScopeFromPath = (path = window.location.pathname) => {
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/vendor')) return 'vendor';
  if (path.startsWith('/delivery')) return 'delivery';
  if (path.startsWith('/b2b-dashboard')) return 'b2bAdmin';
  return 'user';
};

const isExcludedAuthRequest = (scope, url = '') => {
  const { prefix } = AUTH_SCOPES[scope];
  return EXCLUDED_AUTH_SUFFIXES.some((suffix) => url.startsWith(`${prefix}${suffix}`));
};

const clearScopeAuth = async (scope) => {
  const config = AUTH_SCOPES[scope];
  removeStorageItem(config.accessKey);
  removeStorageItem(config.refreshKey);
  removeStorageItem(config.persistKey);
  
  try {
    if (scope === 'b2bAdmin') {
      const { useB2BAdminStore } = await import('../../modules/B2BAdmin/store/b2bAdminStore');
      if (useB2BAdminStore && useB2BAdminStore.getState) {
        useB2BAdminStore.getState().logout();
      }
    } else if (scope === 'user') {
      const { useAuthStore } = await import('../store/authStore');
      if (useAuthStore && useAuthStore.getState) {
        useAuthStore.getState().logout();
      }
    } else if (scope === 'admin') {
      const { useAdminAuthStore } = await import('../../modules/Admin/store/adminStore');
      if (useAdminAuthStore && useAdminAuthStore.getState) {
        useAdminAuthStore.getState().logout();
      }
    } else if (scope === 'vendor') {
      const { useVendorAuthStore } = await import('../../modules/Vendor/store/vendorAuthStore');
      if (useVendorAuthStore && useVendorAuthStore.getState) {
        useVendorAuthStore.getState().logout();
      }
    } else if (scope === 'delivery') {
      const { useDeliveryAuthStore } = await import('../../modules/Delivery/store/deliveryStore');
      if (useDeliveryAuthStore && useDeliveryAuthStore.getState) {
        useDeliveryAuthStore.getState().logout();
      }
    }
  } catch (err) {
    console.error(`Failed to dynamically import and logout store for scope: ${scope}`, err);
  }
};

const shouldAttemptRefresh = (error, scope) => {
  if (error?.response?.status !== 401) return false;
  if (!scope || !AUTH_SCOPES[scope]) return false;

  const refreshToken = getStorageItem(AUTH_SCOPES[scope].refreshKey);
  if (!refreshToken) return false;

  const originalRequest = error.config || {};
  if (originalRequest._retry) return false;

  const url = originalRequest.url || '';
  if (isExcludedAuthRequest(scope, url)) return false;

  return true;
};

const runRefresh = async (scope) => {
  if (refreshInFlight[scope]) {
    return refreshInFlight[scope];
  }

  const config = AUTH_SCOPES[scope];
  const currentRefreshToken = getStorageItem(config.refreshKey);
  if (!currentRefreshToken) {
    throw new Error('No refresh token available.');
  }

  refreshInFlight[scope] = axios
    .post(`${API_BASE_URL}${config.prefix}/auth/refresh`, {
      refreshToken: currentRefreshToken,
    })
    .then((response) => {
      const payload = response?.data?.data || response?.data || {};
      const nextAccessToken = payload?.accessToken;
      const nextRefreshToken = payload?.refreshToken;
      if (!nextAccessToken || !nextRefreshToken) {
        throw new Error('Invalid refresh response from server.');
      }

      setStorageItem(config.accessKey, nextAccessToken);
      setStorageItem(config.refreshKey, nextRefreshToken);

      return nextAccessToken;
    })
    .finally(() => {
      refreshInFlight[scope] = null;
    });

  return refreshInFlight[scope];
};

const memoryCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const isCacheableUrl = (url = '') => {
  if (url.includes('/categories') || url.includes('/admin/categories')) {
    return true;
  }
  if (url.includes('/products') && !url.includes('/products/refurb_')) {
    return true;
  }
  return false;
};

const getCacheKey = (config) => {
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  const scope = getScopeFromUrl(url);
  return `${scope}:${url}:${params}`;
};

const clearCacheByUrlMatch = (url = '') => {
  const lowerUrl = url.toLowerCase();
  for (const key of memoryCache.keys()) {
    if (lowerUrl.includes('/products') && key.includes('/products')) {
      memoryCache.delete(key);
    } else if (lowerUrl.includes('/categories') && key.includes('/categories')) {
      memoryCache.delete(key);
    }
  }
};

api.interceptors.request.use(
  (config) => {
    const scope = getScopeFromUrl(config.url || '');
    let token = getStorageItem(AUTH_SCOPES[scope].accessKey);

    // Prioritize B2B Admin token for shared '/user' endpoints if the user is acting as a B2B Admin
    if (scope === 'user') {
      const b2bToken = getStorageItem('b2bAdminToken');
      if (b2bToken) {
        token = b2bToken;
      }
    }

    if (token) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (config.data instanceof FormData) {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      } else if (config.headers) {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }

    // In-memory caching logic
    const method = config.method?.toLowerCase() || '';
    if (method === 'get' && isCacheableUrl(config.url)) {
      const cacheKey = getCacheKey(config);
      const cached = memoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        config.adapter = () => {
          return Promise.resolve({
            data: cached.data,
            headers: config.headers,
            config,
            request: null,
            status: 200,
            statusText: 'OK',
          });
        };
      }
    } else if (method !== 'get') {
      // Invalidate related cache entries on mutation
      clearCacheByUrlMatch(config.url || '');
    }

    // Invalidate full cache on logout requests
    if (config.url?.includes('/logout') || config.url?.includes('/auth/logout')) {
      memoryCache.clear();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

const getFilteredMockCircularProducts = (params = {}) => {
  let list = mockProductsList.filter(p => p.condition && p.condition !== 'brand_new');
  
  if (params.category) {
    const catId = String(params.category).trim();
    list = list.filter(p => String(p.categoryId).trim() === catId);
  }
  
  if (params.brand) {
    const brandId = String(params.brand).trim();
    list = list.filter(p => String(p.brandId).trim() === brandId);
  }
  
  if (params.vendor) {
    const vendorId = String(params.vendor).trim();
    list = list.filter(p => String(p.vendorId).trim() === vendorId);
  }

  if (params.condition) {
    const condition = String(params.condition).trim();
    if (condition !== 'all' && condition !== 'brand_new') {
      list = list.filter(p => String(p.condition).trim() === condition);
    } else if (condition === 'brand_new') {
      return [];
    }
  }
  
  if (params.q) {
    const q = String(params.q).trim().toLowerCase();
    list = list.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.description && p.description.toLowerCase().includes(q))
    );
  }
  
  if (params.minPrice) {
    const min = parseFloat(params.minPrice);
    if (!isNaN(min)) {
      list = list.filter(p => p.price >= min);
    }
  }
  
  if (params.maxPrice) {
    const max = parseFloat(params.maxPrice);
    if (!isNaN(max)) {
      list = list.filter(p => p.price <= max);
    }
  }
  
  return list;
};

api.interceptors.response.use(
  (response) => {
    const url = response.config?.url || '';
    
    const method = response.config?.method?.toLowerCase() || '';
    if (method === 'get' && isCacheableUrl(url) && response.status === 200) {
      const cacheKey = getCacheKey(response.config);
      memoryCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
    }

    return response.data;
  },
  async (error) => {
    const originalRequest = error.config || {};
    const scope = getScopeFromUrl(originalRequest.url || '');
    const currentPath = window.location.pathname;
    const pathScope = getScopeFromPath(currentPath);

    if (shouldAttemptRefresh(error, scope)) {
      try {
        const nextAccessToken = await runRefresh(scope);
        originalRequest._retry = true;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        return api(originalRequest);
      } catch {
        // fallback to existing session-expired handling below
      }
    }

    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      '';

    // Do not show error toast on silent 401 background checks or cancelled requests
    if (status !== 401 && message && !axios.isCancel(error)) {
      toast.error(message);
    }

    if (status === 401) {
      const hadAuthHeader = !!(originalRequest.headers?.Authorization || originalRequest.headers?.authorization);
      const activeScope = pathScope;
      
      // Only clear scope auth if the request was actually authenticated and refresh failed
      if (hadAuthHeader) {
        await clearScopeAuth(scope);
        if (scope !== activeScope) {
          return Promise.reject(error);
        }

        const routeConfig = AUTH_SCOPES[scope];
        if (scope === 'user') {
          const isAuthPage =
            currentPath === '/login' ||
            currentPath === '/register' ||
            currentPath === '/verification' ||
            currentPath === '/forgot-password' ||
            currentPath === '/reset-password';
          if (!isAuthPage) {
            redirectTo(routeConfig.loginPath);
          }
        } else if (currentPath.startsWith(routeConfig.areaPrefix) && currentPath !== routeConfig.loginPath) {
          toast.error('Session expired. Please login again.');
          redirectTo(routeConfig.loginPath);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
