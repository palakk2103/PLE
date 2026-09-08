import { useState, useLayoutEffect, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const getInitialHeaderHeight = () => {
  if (typeof document === 'undefined') return 64;
  const header = document.querySelector('header[class*="fixed"]') || document.querySelector('header');
  return header?.offsetHeight || 64;
};

/**
 * Hook to calculate the height of the header synchronously & dynamically.
 * Eliminates layout jumping on initial page render.
 */
const useMobileHeaderHeight = () => {
  const [headerHeight, setHeaderHeight] = useState(getInitialHeaderHeight);
  const location = useLocation();

  // Use layout effect to sync height before browser paint
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const updateHeight = () => {
      const header = document.querySelector('header[class*="fixed"]') || document.querySelector('header');
      if (header && header.offsetHeight > 0) {
        setHeaderHeight((prev) => (prev !== header.offsetHeight ? header.offsetHeight : prev));
      }
    };

    updateHeight();

    const header = document.querySelector('header[class*="fixed"]') || document.querySelector('header');
    if (!header) return;

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = Math.round(entry.contentRect?.height || entry.target?.offsetHeight || 0);
          if (height > 0) {
            setHeaderHeight((prev) => (prev !== height ? height : prev));
          }
        }
      });
      resizeObserver.observe(header);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [location.pathname]);

  return headerHeight;
};

export default useMobileHeaderHeight;
