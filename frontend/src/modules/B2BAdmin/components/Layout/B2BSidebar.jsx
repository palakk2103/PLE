import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiUsers, FiBriefcase, FiUser, FiActivity, FiBell, FiSettings, FiLogOut, FiX, FiFileText, FiTrendingUp, FiMessageCircle, FiDollarSign, FiMessageSquare, FiCreditCard, FiArrowLeft, FiShoppingBag, FiHelpCircle } from 'react-icons/fi';
import { useB2BAdminStore } from '../../store/b2bAdminStore';
import { useB2bStore } from '../../../../shared/store/b2bStore';
import { performUserLogout } from '../../../../shared/utils/userLogout';

const B2BSidebar = ({ isOpen, setIsOpen, isMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, adminProfile } = useB2BAdminStore();
  const isEmployee = adminProfile?.isEmployee || adminProfile?.role === 'b2bEmployee';

  const handleBackToB2BApp = () => {
    try {
      useB2bStore.getState().setUserRole('business_buyer');
    } catch (e) {
      console.error(e);
    }
    navigate('/profile');
    if (isMobile) setIsOpen(false);
  };

  const navItems = [
    { name: 'Dashboard', path: '/b2b-dashboard/overview', icon: FiHome },
    { name: 'Employees', path: '/b2b-dashboard/employees', icon: FiUsers },
    { name: 'RFQs', path: '/b2b-dashboard/rfqs', icon: FiFileText },
    { name: 'Quotations', path: '/b2b-dashboard/quotations', icon: FiTrendingUp },
    { name: 'RFQ Discussions', path: '/b2b-dashboard/discussions', icon: FiMessageCircle },
    { name: 'Shop Chats', path: '/b2b-dashboard/shop-chats', icon: FiMessageSquare },
    { name: 'Purchase Orders', path: '/b2b-dashboard/purchase-orders', icon: FiDollarSign },
    { name: 'Business Wallet', path: '/wallet', icon: FiCreditCard },
    { name: 'Company Profile', path: '/b2b-dashboard/company-profile', icon: FiBriefcase },
    { name: 'Legal Documents', path: '/b2b-dashboard/legal-documents', icon: FiFileText },
    { name: 'Admin Profile', path: '/b2b-dashboard/admin-profile', icon: FiUser },
    { name: 'Request Products', path: '/b2b-dashboard/product-requests', icon: FiBriefcase },
    { name: 'Support Desk', path: '/b2b-dashboard/support', icon: FiHelpCircle },
    { name: 'Notifications', path: '/b2b-dashboard/notifications', icon: FiBell },
    { name: 'Settings', path: '/b2b-dashboard/settings', icon: FiSettings },
  ].filter(item => {
    if (isEmployee) {
      return ['RFQs', 'Quotations', 'RFQ Discussions', 'Shop Chats', 'Request Products', 'Support Desk'].includes(item.name);
    }
    return true;
  });

  const handleLogout = () => {
    performUserLogout('/profile');
  };

  return (
    <aside className="h-full w-64 bg-black shadow-xl flex flex-col z-[10000]">
      {/* Header Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.06] bg-black">
        <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-[#D71920] to-[#B51218] rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <FiBriefcase className="text-white text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-white text-sm truncate">
                {isEmployee ? 'B2B Employee' : 'B2B Admin'}
              </h2>
            </div>
        </div>
        {isMobile && (
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0 lg:hidden"
          >
            <FiX className="text-xl text-gray-400 hover:text-white" />
          </button>
        )}
      </div>

      {/* Back to B2B Store Quick Link */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={handleBackToB2BApp}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.04] hover:bg-[#D71920]/15 text-gray-300 hover:text-white rounded-xl border border-white/[0.08] hover:border-[#D71920]/40 transition-all duration-200 group text-xs font-semibold shadow-sm cursor-pointer"
          title="Go back to B2B User App / Store"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-white/5 group-hover:bg-[#D71920]/30 flex items-center justify-center transition-colors shrink-0">
              <FiArrowLeft className="text-xs text-gray-400 group-hover:text-white transition-colors" />
            </div>
            <span className="truncate">Back to B2B Store</span>
          </div>
          <FiShoppingBag className="text-sm text-gray-500 group-hover:text-red-400 transition-colors shrink-0 ml-1" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 scrollbar-admin">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => isMobile && setIsOpen(false)}
                className={`flex items-center px-4 py-3 mb-1 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#D71920] text-white shadow-sm' 
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon className={`text-xl flex-shrink-0 mr-3 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span className="flex-1">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-white/[0.06]">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-sm font-medium text-[#f43f5e] rounded-xl hover:bg-white/[0.06] transition-colors duration-200"
        >
          <FiLogOut className="mr-3 text-xl" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default B2BSidebar;
