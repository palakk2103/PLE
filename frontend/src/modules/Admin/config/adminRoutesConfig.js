/**
 * Centralized Admin Routing Configuration
 * 
 * Provides a single source of truth for the custom admin route prefix,
 * preventing scattered route strings and ensuring maintainable navigation.
 */

export const ADMIN_BASE_ROUTE = '/ple-ops-desk';
export const ADMIN_LOGIN_ROUTE = `${ADMIN_BASE_ROUTE}/login`;
export const ADMIN_DASHBOARD_ROUTE = `${ADMIN_BASE_ROUTE}/dashboard`;

/**
 * Returns a fully qualified admin route for a given relative subpath.
 * e.g. getAdminPath('orders') -> '/ple-ops-desk/orders'
 */
export const getAdminPath = (subPath = '') => {
  const clean = String(subPath || '').replace(/^\/+/, '');
  return clean ? `${ADMIN_BASE_ROUTE}/${clean}` : ADMIN_BASE_ROUTE;
};

/**
 * Checks whether a given path is an admin portal route.
 * e.g. isAdminPath('/ple-ops-desk/products') -> true
 */
export const isAdminPath = (pathname = '') => {
  const clean = String(pathname || '').toLowerCase();
  return clean === ADMIN_BASE_ROUTE || clean.startsWith(`${ADMIN_BASE_ROUTE}/`);
};

export default {
  ADMIN_BASE_ROUTE,
  ADMIN_LOGIN_ROUTE,
  ADMIN_DASHBOARD_ROUTE,
  getAdminPath,
  isAdminPath,
};
