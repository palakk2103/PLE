import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import B2BSidebar from './B2BSidebar';
import B2BHeader from './B2BHeader';

const B2BDashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out print:hidden`}
      >
        <B2BSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} isMobile={isMobile} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="print:hidden">
          <B2BHeader toggleSidebar={toggleSidebar} />
        </div>

        {/* Main section */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-[#0A0A0A] p-4 lg:p-6 transition-colors duration-200">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 lg:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default B2BDashboardLayout;
