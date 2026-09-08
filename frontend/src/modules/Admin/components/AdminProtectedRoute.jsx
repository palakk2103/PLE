import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuthStore } from '../store/adminStore';

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

const AdminProtectedRoute = ({ children }) => {
  const { isAuthenticated, token, refreshToken } = useAdminAuthStore();
  const location = useLocation();
  const accessToken = token || localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
  const activeRefreshToken = refreshToken || localStorage.getItem('adminRefreshToken') || sessionStorage.getItem('adminRefreshToken');
  const payload = decodeJwtPayload(accessToken);
  const role = String(payload?.role || '').toLowerCase();
  const tokenExpiryMs =
    typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  const isExpired = tokenExpiryMs ? Date.now() >= tokenExpiryMs : false;

  if (!isAuthenticated && !accessToken && !activeRefreshToken) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // If accessToken is expired but a refreshToken exists, silently refresh in the background
  if (isExpired && activeRefreshToken) {
    useAdminAuthStore.getState().refreshSession().catch(() => {});
  } else if (isExpired && !activeRefreshToken) {
    useAdminAuthStore.getState().logout();
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (role && role !== 'admin' && role !== 'superadmin') {
    useAdminAuthStore.getState().logout();
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
};

export default AdminProtectedRoute;
