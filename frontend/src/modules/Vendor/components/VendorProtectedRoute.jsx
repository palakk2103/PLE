import { Navigate, useLocation } from 'react-router-dom';
import { useVendorAuthStore } from '../store/vendorAuthStore';

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = window.atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const VendorProtectedRoute = ({ children }) => {
  const { isAuthenticated, token, refreshToken } = useVendorAuthStore();
  const location = useLocation();
  const accessToken =
    token ||
    localStorage.getItem('vendor-token') ||
    sessionStorage.getItem('vendor-token');
  const activeRefreshToken =
    refreshToken ||
    localStorage.getItem('vendor-refresh-token') ||
    sessionStorage.getItem('vendor-refresh-token');
  const payload = decodeJwtPayload(accessToken);
  const role = String(payload?.role || '').toLowerCase();
  const tokenExpiryMs =
    typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  const isExpired = tokenExpiryMs ? Date.now() >= tokenExpiryMs : false;

  if (!isAuthenticated && !accessToken && !activeRefreshToken) {
    return <Navigate to="/vendor/login" state={{ from: location }} replace />;
  }

  // If accessToken is expired but a refreshToken exists, silently refresh in the background
  if (isExpired && activeRefreshToken) {
    useVendorAuthStore.getState().refreshSession().catch(() => {});
  } else if (isExpired && !activeRefreshToken) {
    useVendorAuthStore.getState().logout();
    return <Navigate to="/vendor/login" state={{ from: location }} replace />;
  }

  if (role && role !== 'vendor' && role !== 'managed_vendor') {
    useVendorAuthStore.getState().logout();
    return <Navigate to="/vendor/login" state={{ from: location }} replace />;
  }

  return children;
};

export default VendorProtectedRoute;
