import { useState, useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';
import { WifiOff } from 'lucide-react';
import { ADMIN_BASE_ROUTE } from '../../modules/Admin/config/adminRoutesConfig';

const OfflineDetector = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { theme } = useThemeStore();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isUserAppPath = !window.location.pathname.startsWith(ADMIN_BASE_ROUTE) &&
                         !window.location.pathname.startsWith('/admin') && 
                         !window.location.pathname.startsWith('/vendor') && 
                         !window.location.pathname.startsWith('/delivery');

  if (!isOnline && isUserAppPath) {
    const isDark = theme === 'dark';
    return (
      <div className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center px-6 text-center transition-colors duration-300 ${
        isDark ? 'bg-[#0D0D0D]' : 'bg-[#FAFAFA]'
      }`}>
        <div className="max-w-md w-full flex flex-col items-center p-8 rounded-3xl md:bg-transparent transition-all duration-300">
          {/* Animated Premium Icon Container */}
          <div className={`relative flex items-center justify-center w-28 h-28 rounded-full mb-8 transition-colors duration-300 ${
            isDark ? 'bg-[#1A1A1A]/80 text-[#FF4D4D]' : 'bg-[#F2F2F2] text-[#AE020B]'
          } shadow-xl`}>
            {/* Outer Ripple Effect */}
            <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
              isDark ? 'bg-[#FF4D4D]' : 'bg-[#AE020B]'
            }`} style={{ animationDuration: '2s' }} />
            
            {/* Inner Ripple Effect */}
            <div className={`absolute -inset-2 rounded-full animate-pulse opacity-10 ${
              isDark ? 'bg-[#FF4D4D]' : 'bg-[#AE020B]'
            }`} style={{ animationDuration: '3s' }} />
            
            <WifiOff className="w-12 h-12 stroke-[1.75] relative z-10 drop-shadow-md" />
          </div>

          {/* Title */}
          <h1 className={`text-2xl md:text-3xl font-black mb-3 tracking-tight transition-colors duration-300 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Connection Lost
          </h1>

          {/* Description */}
          <p className={`text-sm md:text-base mb-8 leading-relaxed max-w-xs transition-colors duration-300 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            You are currently offline. Please check your network connection and try again.
          </p>

          {/* Reload Button */}
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:max-w-xs bg-[#AE020B] hover:bg-[#8d0209] active:scale-[0.98] text-white py-3.5 px-8 rounded-2xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-red-900/10 dark:hover:shadow-black/30"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default OfflineDetector;
