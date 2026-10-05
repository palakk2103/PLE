import { FiMail, FiPhone, FiShoppingBag, FiDollarSign, FiEye } from 'react-icons/fi';
import Badge from '../../../../shared/components/Badge';
import { formatCurrency } from '../../utils/adminHelpers';

const CustomerCard = ({ customer, onView }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:shadow-md transition-all flex flex-col justify-between h-full min-w-0 overflow-hidden w-full">
      {/* Top Header: Name, Contact & Status Badge */}
      <div className="flex items-start justify-between gap-3 mb-4 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 
            className="font-bold text-gray-800 text-base mb-1.5 truncate" 
            title={customer.name}
          >
            {customer.name}
          </h3>
          <div 
            className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 min-w-0" 
            title={customer.email}
          >
            <FiMail className="text-gray-400 shrink-0 text-xs" />
            <span className="truncate">{customer.email}</span>
          </div>
          {customer.phone ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 min-w-0">
              <FiPhone className="text-gray-400 shrink-0 text-xs" />
              <span className="truncate">{customer.phone}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400 min-w-0">
              <FiPhone className="text-gray-300 shrink-0 text-xs" />
              <span className="text-[11px] italic truncate">No phone added</span>
            </div>
          )}
        </div>

        <div className="shrink-0">
          <Badge 
            variant={customer.status === 'active' ? 'success' : 'error'}
            className="capitalize text-[11px] px-2.5 py-0.5 whitespace-nowrap"
          >
            {customer.status}
          </Badge>
        </div>
      </div>

      {/* Stats Section: Orders & Total Spent */}
      <div className="grid grid-cols-2 gap-2.5 mb-4 pt-3 border-t border-gray-100 min-w-0">
        <div className="bg-gray-50/80 rounded-lg p-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-gray-500 mb-0.5 min-w-0">
            <FiShoppingBag className="text-xs shrink-0 text-primary-600" />
            <span className="text-[11px] font-medium truncate">Orders</span>
          </div>
          <p className="font-bold text-gray-800 text-sm truncate">{customer.orders || 0}</p>
        </div>
        <div className="bg-gray-50/80 rounded-lg p-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-gray-500 mb-0.5 min-w-0">
            <FiDollarSign className="text-xs shrink-0 text-green-600" />
            <span className="text-[11px] font-medium truncate">Total Spent</span>
          </div>
          <p 
            className="font-bold text-gray-800 text-sm truncate" 
            title={formatCurrency(customer.totalSpent || 0)}
          >
            {formatCurrency(customer.totalSpent || 0)}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onView(customer)}
        className="w-full mt-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-semibold text-xs shadow-sm"
      >
        <FiEye className="text-sm shrink-0" />
        View Details
      </button>
    </div>
  );
};

export default CustomerCard;
