
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

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

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user, token, refreshToken } = useAuthStore();
  const location = useLocation();
  const accessToken = token || localStorage.getItem('token') || sessionStorage.getItem('token');
  const activeRefreshToken = refreshToken || localStorage.getItem('refresh-token') || sessionStorage.getItem('refresh-token');
  const tokenPayload = decodeJwtPayload(accessToken);
  const resolvedRole = String(user?.role || tokenPayload?.role || '').toLowerCase();
  const tokenExpiryMs =
    typeof tokenPayload?.exp === 'number' ? tokenPayload.exp * 1000 : null;
  const isExpired = tokenExpiryMs ? Date.now() >= tokenExpiryMs : false;

  if (!isAuthenticated && !accessToken && !activeRefreshToken) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If accessToken is expired but a refreshToken exists, silently refresh in the background
  if (isExpired && activeRefreshToken) {
    useAuthStore.getState().refreshSession().catch(() => {});
  } else if (isExpired && !activeRefreshToken) {
    useAuthStore.getState().logout();
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (resolvedRole && !['customer', 'business_buyer', 'b2badmin', 'b2bemployee'].includes(resolvedRole)) {
    useAuthStore.getState().logout();
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
