import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useB2BAdminStore } from '../store/b2bAdminStore';

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

const B2BProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useB2BAdminStore();
  const location = useLocation();
  const accessToken =
    sessionStorage.getItem('b2bAdminToken') ||
    localStorage.getItem('b2bAdminToken');
  const payload = decodeJwtPayload(accessToken);
  const role = String(payload?.role || '').toLowerCase();
  const tokenExpiryMs =
    typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  const isExpired = tokenExpiryMs ? Date.now() >= tokenExpiryMs : false;

  if (!isAuthenticated && !accessToken) {
    // Redirect to the portal selection page
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (isExpired) {
    useB2BAdminStore.getState().logout();
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If token role is present and not a valid B2B role, logout and redirect
  if (role && !['b2badmin', 'b2bemployee', 'customer'].includes(role)) {
    useB2BAdminStore.getState().logout();
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

export default B2BProtectedRoute;

