import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FiEdit3 } from 'react-icons/fi';
import MobileHeader from './MobileHeader';
import DesktopHeader from './DesktopHeader';
import DesktopFooter from './DesktopFooter';
import MobileBottomNav from './MobileBottomNav';
import MobileCartBar from './MobileCartBar';
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

      const isLegalPath = pathname.startsWith('/legal/') || pathname === '/privacy-policy' || pathname === '/support' || pathname === '/terms-and-conditions' || pathname === '/user-agreement' || pathname === '/return-policy' || pathname === '/warranty-policy' || pathname === '/business-onboarding-policy' || pathname === '/execution-acceptance-policy';

      const paddingClasses = shouldNoPadding 
        ? "px-0" 
        : (isBusiness ? "px-2 xs:px-3 sm:px-4 md:px-4 lg:px-6 xl:px-8" : "px-2 xs:px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12");

      return (
        <>
          {!isAuthPage && !isCheckoutPage && !isProfileOptionPage && !isOrderConfirmationPage && !isTrackOrderPage && <DesktopHeader />}
          {shouldShowHeader && <MobileHeader />}
          <main
            className={`min-h-screen w-full max-w-full overflow-x-hidden ${paddingClasses} ${shouldShowBottomNav && !isKeyboardVisible ? 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]' : ''} ${showCartBar && !isKeyboardVisible ? 'pb-[calc(6rem+env(safe-area-inset-bottom,0px))]' : ''}`}
            style={{ paddingTop: shouldShowHeader ? `${headerHeight}px` : '0px' }}
          >
            {children}
          </main>
          {!isAuthPage && !isCheckoutPage && <DesktopFooter />}
          {shouldShowBottomNav && <MobileBottomNav />}
          <CartDrawer />

          {/* 
          {!isAuthPage && !isCheckoutPage && !isLegalPath && createPortal(
            <Link
              to="/product-request/new"
          className="fixed right-4 z-[9998] safe-area-bottom px-5 py-3 rounded-full text-white shadow-2xl flex items-center justify-center gap-2 hover:scale-105 active:scale-[0.95] transition-all duration-300 group font-bold text-xs"
          style={{ 
            bottom: pathname.startsWith('/product/') ? "calc(6.5rem + 10px)" : "calc(4rem + 10px)",
            background: "linear-gradient(135deg, #9B1C1C 0%, #7B0A0A 50%, #4C0505 100%)"
          }}
          title="Can't find a product? Request it!"
        >
          <FiEdit3 className="text-sm shrink-0" />
          <span>Request Product</span>
        </Link>,
        document.body
      )}
      */}
    </>
  );
};

export default MobileLayout;


