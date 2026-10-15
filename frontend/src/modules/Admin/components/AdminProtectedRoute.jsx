import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuthStore } from '../store/adminStore';
import { ADMIN_LOGIN_ROUTE, ADMIN_DASHBOARD_ROUTE, getAdminPath } from '../config/adminRoutesConfig';

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
    return <Navigate to={ADMIN_LOGIN_ROUTE} state={{ from: location }} replace />;
  }

  // If accessToken is expired but a refreshToken exists, silently refresh in the background
  if (isExpired && activeRefreshToken) {
    useAdminAuthStore.getState().refreshSession().catch(() => {});
  } else if (isExpired && !activeRefreshToken) {
    useAdminAuthStore.getState().logout();
    return <Navigate to={ADMIN_LOGIN_ROUTE} state={{ from: location }} replace />;
  }

  const isSuperAdminOnlyPath = (path) => {
    return (
      path.startsWith(getAdminPath('account-team')) ||
      path.startsWith(getAdminPath('audit-logs')) ||
      path.startsWith(getAdminPath('settings')) ||
      path.startsWith(getAdminPath('firebase')) ||
      path.startsWith(getAdminPath('policies'))
    );
  };

  if (role && role !== 'admin' && role !== 'superadmin' && role !== 'account_team') {
    useAdminAuthStore.getState().logout();
    return <Navigate to={ADMIN_LOGIN_ROUTE} state={{ from: location }} replace />;
  }

  // Account Team users cannot access Super Admin-only management/audit routes
  if (role === 'account_team' && isSuperAdminOnlyPath(location.pathname)) {
    return <Navigate to={ADMIN_DASHBOARD_ROUTE} replace />;
  }

  return children;
};

export default AdminProtectedRoute;
