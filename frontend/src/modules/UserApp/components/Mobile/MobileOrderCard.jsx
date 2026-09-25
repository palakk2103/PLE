import { Link } from 'react-router-dom';
import { FiPackage, FiChevronRight, FiCalendar, FiDollarSign, FiShoppingBag } from 'react-icons/fi';
import { formatPrice } from '../../../../shared/utils/helpers';
import { motion } from 'framer-motion';
import { formatVariantLabel } from '../../../../shared/utils/variant';

const MobileOrderCard = ({ order }) => {
  const variantLabels = Array.isArray(order?.items)
    ? order.items
      .map((item) => formatVariantLabel(item?.variant))
      .filter(Boolean)
    : [];
  const variantSummary = variantLabels.length === 1
    ? variantLabels[0]
    : variantLabels.length > 1
      ? `${variantLabels.length} variant selections`
      : '';

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'text-green-700 bg-green-50 border border-green-200';
      case 'out_for_delivery':
        return 'text-purple-700 bg-purple-50 border border-purple-200';
      case 'shipped':
        return 'text-blue-700 bg-blue-50 border border-blue-200';
      case 'processing':
        return 'text-amber-700 bg-amber-50 border border-amber-200';
      case 'cancelled':
        return 'text-red-700 bg-red-50 border border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'Order Confirmed';
      case 'processing':
        return 'Packed';
      case 'shipped':
        return 'Shipped';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'returned':
        return 'Returned';
      default:
        return status || 'Confirmed';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-4 mb-4"
    >
      <Link to={`/orders/${order.id}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#AE020B] to-[#7B0A0A] flex items-center justify-center flex-shrink-0">
              <FiPackage className="text-white text-xl" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-base">Order #{order.id}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <FiCalendar className="text-xs" />
                {new Date(order.date || order.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <FiChevronRight className="text-gray-400 text-xl" />
        </div>

        <div className="space-y-2 mb-3">
          {/* Vendor Count */}
          {order.vendorItems && order.vendorItems.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 bg-red-50 rounded-lg mb-2">
              <FiShoppingBag className="text-[#7B0A0A] text-xs" />
              <span className="text-xs font-semibold text-red-700">
                {order.vendorItems.length} {order.vendorItems.length === 1 ? 'Vendor' : 'Vendors'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Items</span>
            <span className="text-sm font-semibold text-gray-800">
              {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
            </span>
          </div>
          {variantSummary && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Variant</span>
              <span className="text-xs font-semibold text-gray-700 text-right max-w-[62%] truncate">
                {variantSummary}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 flex items-center gap-1">
              <FiDollarSign className="text-xs" />
              Total
            </span>
            <span className="text-base font-bold text-[#7B0A0A]">
              {formatPrice(order.total || order.amount || 0)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(
                order.status
              )}`}
            >
              {getStatusLabel(order.status)}
            </span>
            {order.loyaltyPointsEarned > 0 && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg text-[10px] font-black">
                +{order.loyaltyPointsEarned} Pts
              </span>
            )}
            {order.loyaltyPointsRedeemed > 0 && (
              <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-lg text-[10px] font-black">
                -{order.loyaltyPointsRedeemed} Pts
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">View Details</span>
        </div>
      </Link>
    </motion.div>
  );
};

export default MobileOrderCard;

