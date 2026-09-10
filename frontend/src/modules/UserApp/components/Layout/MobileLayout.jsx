import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import MobileHeader from './MobileHeader';
import DesktopHeader from './DesktopHeader';
import DesktopFooter from './DesktopFooter';
import MobileBottomNav from './MobileBottomNav';
import CartDrawer from '../../../../shared/components/Cart/CartDrawer';
import useMobileHeaderHeight from '../../hooks/useMobileHeaderHeight';
import useKeyboardVisible from '../../../../shared/hooks/useKeyboardVisible';
import { useUIStore } from '../../../../shared/store/useStore';
import { useB2bStore } from '../../../../shared/store/b2bStore';

const MobileLayout = ({ children, showBottomNav = true, showCartBar = true, noPadding = null }) => {
  const location = useLocation();
  const headerHeight = useMobileHeaderHeight();
  const isBusiness = useB2bStore((state) => state.userRole === 'business_buyer');
  const isKeyboardVisible = useKeyboardVisible();
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pathname = location.pathname.toLowerCase();

  // Hide header and bottom nav on login, register, and verification pages
  const isAuthPage = pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verification' ||
    pathname === '/b2b/login' ||
    pathname === '/b2b/register';

  const isCheckoutPage = pathname === '/checkout';
  const isOrderConfirmationPage = pathname.startsWith('/order-confirmation');
  const isTrackOrderPage = pathname.startsWith('/track-order');
  const isLocationSelectorOpen = useUIStore((state) => state.isLocationSelectorOpen);

  const isProfileOptionPage = 
    pathname === '/profile' ||
    pathname === '/orders' ||
    pathname.startsWith('/orders/') ||
    pathname === '/returns' ||
    pathname.startsWith('/returns/') ||
    pathname === '/wishlist' ||
    pathname === '/addresses' ||
    pathname === '/notifications' ||
    pathname === '/wallet' ||
    pathname === '/settings' ||
    pathname === '/help-support' ||
    pathname === '/support' ||
    pathname === '/support-tickets' ||
    pathname.startsWith('/support-chat/') ||
    pathname.startsWith('/chat/vendor/') ||
    pathname === '/chats' ||
    pathname.startsWith('/product-requests') ||
    pathname.startsWith('/product-request/') ||
    pathname.startsWith('/rfq/') ||
    pathname === '/privacy-policy' ||
    pathname === '/terms-and-conditions' ||
    pathname === '/user-agreement' ||
    pathname === '/return-policy' ||
    pathname === '/warranty-policy' ||
    pathname === '/about-us' ||
    pathname.startsWith('/legal/');

  const shouldNoPadding = noPadding !== null ? noPadding : isProfileOptionPage;
  
  // Respect the showBottomNav prop and hide on auth pages or when location selector is open
  const shouldShowBottomNav = showBottomNav && !isAuthPage && !isLocationSelectorOpen;
  // Hide header on categories, search, wishlist, profile, returns, order confirmation, track order, and auth pages
  const shouldShowHeader = !isAuthPage &&
    pathname !== '/categories' &&
    pathname !== '/search' &&
    pathname !== '/refurbished-categories' &&
    !isProfileOptionPage &&
    !isCheckoutPage &&
    !isOrderConfirmationPage &&
    !isTrackOrderPage;

  // Ensure body scroll is restored when component mounts
  useEffect(() => {
    document.body.style.overflowY = '';
    return () => {
      document.body.style.overflowY = '';
    };
  }, []);

  const paddingClasses = shouldNoPadding 
    ? "px-0" 
    : (isBusiness ? "px-0 md:px-4 lg:px-6 xl:px-8" : "px-0 md:px-6 lg:px-8 xl:px-12");

  return (
    <>
      {!isAuthPage && !isCheckoutPage && !isProfileOptionPage && !isOrderConfirmationPage && !isTrackOrderPage && <DesktopHeader />}
      {shouldShowHeader && <MobileHeader />}
      <main
        className={`min-h-screen w-full max-w-full overflow-x-hidden ${paddingClasses} ${shouldShowBottomNav && !isKeyboardVisible ? 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]' : ''} ${showCartBar && !isKeyboardVisible ? 'pb-[calc(6rem+env(safe-area-inset-bottom,0px))]' : ''}`}
        style={{ paddingTop: (shouldShowHeader && !isDesktop) ? `${headerHeight}px` : '0px' }}
      >
        {children}
      </main>
      {!isAuthPage && !isCheckoutPage && <DesktopFooter />}
      {shouldShowBottomNav && <MobileBottomNav />}
      <CartDrawer />
    </>
  );
};

export default MobileLayout;
