import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

/**
 * Wrapper component to synchronize catalog state and route changes cleanly.
 */
const RouteWrapper = ({ children }) => {
  const location = useLocation();
  const [, setCatalogTick] = useState(0);

  useEffect(() => {
    const onCatalogUpdate = () => setCatalogTick((prev) => prev + 1);
    window.addEventListener('catalog-cache-updated', onCatalogUpdate);
    return () => {
      window.removeEventListener('catalog-cache-updated', onCatalogUpdate);
    };
  }, []);

  const isHomePage = location.pathname === '/' || location.pathname === '/home';
  const key = isHomePage 
    ? location.pathname 
    : `${location.pathname}${location.search}`;

  return (
    <div key={key} className="w-full h-full min-h-full">
      {children}
    </div>
  );
};

export default RouteWrapper;
