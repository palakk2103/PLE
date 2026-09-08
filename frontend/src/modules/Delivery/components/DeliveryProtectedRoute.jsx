import { Navigate, useLocation } from 'react-router-dom';
import { useDeliveryAuthStore } from '../store/deliveryStore';

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

const DeliveryProtectedRoute = ({ children }) => {
  const { isAuthenticated, token, refreshToken } = useDeliveryAuthStore();
  const location = useLocation();
  const accessToken = token || localStorage.getItem('delivery-token') || sessionStorage.getItem('delivery-token');
  const activeRefreshToken = refreshToken || localStorage.getItem('delivery-refresh-token') || sessionStorage.getItem('delivery-refresh-token');
  const payload = decodeJwtPayload(accessToken);
  const role = String(payload?.role || '').toLowerCase();
  const tokenExpiryMs =
    typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  const isExpired = tokenExpiryMs ? Date.now() >= tokenExpiryMs : false;

  if (!isAuthenticated && !accessToken && !activeRefreshToken) {
    return <Navigate to="/delivery/login" state={{ from: location }} replace />;
  }

  // If accessToken is expired but a refreshToken exists, silently refresh in the background
  if (isExpired && activeRefreshToken) {
    useDeliveryAuthStore.getState().refreshSession().catch(() => {});
  } else if (isExpired && !activeRefreshToken) {
    useDeliveryAuthStore.getState().logout();
    return <Navigate to="/delivery/login" state={{ from: location }} replace />;
  }

  if (role && role !== 'delivery') {
    useDeliveryAuthStore.getState().logout();
    return <Navigate to="/delivery/login" state={{ from: location }} replace />;
  }

  return children;
};

export default DeliveryProtectedRoute;
