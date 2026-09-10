/**
 * Utility helper to determine the current execution domain/hostname.
 * Support landing (plebusiness.com) and portal (peoplesleagueofelectronics.com).
 * Includes automatic detection for Play Store Android App / TWA / WebView / Standalone mode.
 */

// Helper to check if running inside Android / iOS app or WebView / PWA standalone mode
export const isAppOrWebView = () => {
  if (typeof window === 'undefined') return false;

  const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();

  // Android WebView detection ("; wv" or "Version/X.X ... Chrome")
  const isAndroidWebView = ua.includes('; wv') || (ua.includes('android') && ua.includes('version/') && ua.includes('chrome'));

  // iOS WebView detection
  const isIOSWebView = /(iphone|ipod|ipad).*applewebkit(?!.*safari)/i.test(ua);

  // Standalone PWA / TWA mode / Android App referrer
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                       window.navigator.standalone === true ||
                       (document.referrer && document.referrer.startsWith('android-app://'));

  // Custom app tokens/markers or framework hooks
  const isCustomApp = ua.includes('ple') || ua.includes('twa') || ua.includes('mobile_app') || Boolean(window.Capacitor || window.cordova);

  const urlParams = new URLSearchParams(window.location.search);
  const isParamApp = urlParams.get('app') === 'true' || urlParams.get('twa') === 'true';

  return isAndroidWebView || isIOSWebView || isStandalone || isCustomApp || isParamApp;
};

// Check if the current URL path is a portal/ecommerce specific route
const isPortalPath = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  
  const portalPathPrefixes = [
    '/home',
    '/retail',
    '/business',
    '/portal',
    '/login',
    '/register',
    '/verification',
    '/forgot-password',
    '/reset-password',
    '/profile',
    '/orders',
    '/order-confirmation',
    '/track-order',
    '/checkout',
    '/cart',
    '/categories',
    '/category',
    '/brand',
    '/seller',
    '/search',
    '/product',
    '/wishlist',
    '/addresses',
    '/wallet',
    '/settings',
    '/help-support',
    '/support',
    '/notifications',
    '/b2b',
    '/admin',
    '/vendor',
    '/delivery',
    '/daily-deals',
    '/flash-sale',
    '/new-arrivals',
    '/offers',
    '/refurbished-categories',
    '/product-request'
  ];

  return portalPathPrefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'));
};

export const getCurrentDomain = () => {
  if (typeof window === 'undefined') return 'portal';

  // If inside mobile app / WebView / Play Store app, ALWAYS return portal
  if (isAppOrWebView()) {
    return 'portal';
  }

  // If navigating directly to any portal page, ALWAYS return portal
  if (isPortalPath()) {
    return 'portal';
  }

  const hostname = window.location.hostname;

  // Developer testing overrides
  const override = localStorage.getItem('domain_override');
  if (override === 'landing' || override === 'portal') {
    return override;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const domainParam = urlParams.get('__domain');
  if (domainParam === 'landing' || domainParam === 'portal') {
    localStorage.setItem('domain_override', domainParam);
    return domainParam;
  }

  // Production domain mapping
  if (hostname.includes('plebusiness.com')) {
    return 'landing';
  }
  if (hostname.includes('peoplesleagueofelectronics.com')) {
    return 'portal';
  }

  // Default fallback for development and unknown hosts
  return 'portal';
};

export const isLandingDomain = () => {
  if (isAppOrWebView()) return false;
  if (isPortalPath()) return false;
  return getCurrentDomain() === 'landing';
};

export const isPortalDomain = () => !isLandingDomain();
