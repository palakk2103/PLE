import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiCheck,
  FiPackage,
  FiTruck,
  FiNavigation,
  FiCheckCircle,
  FiXCircle,
  FiRotateCcw,
  FiClock,
  FiDollarSign,
  FiArrowRight,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { formatPrice } from '../utils/helpers';

const DELIVERY_STEPS = [
  {
    key: 'pending',
    label: 'Order Confirmed',
    description: 'Order placed & payment verified',
    icon: FiCheck,
    dateField: 'createdAt',
  },
  {
    key: 'processing',
    label: 'Packed',
    description: 'Items packed & prepared for dispatch',
    icon: FiPackage,
    dateField: 'processingAt',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    description: 'In transit to distribution hub',
    icon: FiTruck,
    dateField: 'shippedAt',
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    description: 'With delivery partner on the way',
    icon: FiNavigation,
    dateField: 'outForDeliveryAt',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Successfully delivered to customer',
    icon: FiCheckCircle,
    dateField: 'deliveredAt',
  },
];

const RETURN_STEPS = [
  {
    key: 'requested',
    label: 'Return Requested',
    description: 'Customer submitted return request',
    icon: FiRotateCcw,
  },
  {
    key: 'approved',
    label: 'Return Accepted',
    description: 'Verified & approved by seller',
    icon: FiCheck,
  },
  {
    key: 'picked_up',
    label: 'Item Received',
    description: 'Item received & inventory restored',
    icon: FiPackage,
  },
  {
    key: 'refunded',
    label: 'Refund Dispatched',
    description: 'Sent to Bank / Wallet',
    icon: FiDollarSign,
  },
];

const ORDER_PROGRESS_INDEX = {
  pending: 0,
  processing: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
};

const formatTimestamp = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const OrderStatusTimeline = ({ order, returnRequest = null, showTrackingLink = true }) => {
  if (!order) return null;

  const rawStatus = String(order.status || 'pending').toLowerCase();
  const isCancelled = rawStatus === 'cancelled';
  const isReturned = rawStatus === 'returned' || !!returnRequest;
  const [viewMode, setViewMode] = useState(isReturned ? 'return' : 'delivery');

  // Delivery progress index
  const deliveryIndex = ORDER_PROGRESS_INDEX[rawStatus] ?? (rawStatus === 'shipped' ? 2 : (rawStatus === 'delivered' || isReturned ? 4 : 0));

  // Return progress index
  let returnIndex = 0;
  if (isReturned) {
    const retStatus = String(returnRequest?.status || '').toLowerCase();
    const refStatus = String(returnRequest?.refundStatus || order.refundDetails?.status || '').toLowerCase();
    const isPaymentRefunded = order.paymentStatus === 'refunded' || refStatus === 'processed' || refStatus === 'completed';

    if (rawStatus === 'returned' || isPaymentRefunded || retStatus === 'completed') {
      returnIndex = 3; // All return & refund steps completed
    } else if (retStatus === 'processing' || retStatus === 'pickup_scheduled' || retStatus === 'picked_up') {
      returnIndex = 2;
    } else if (retStatus === 'approved') {
      returnIndex = 1;
    } else {
      returnIndex = 0;
    }
  }

  // Active steps based on viewMode
  const isShowingReturn = isReturned && viewMode === 'return';
  const activeSteps = isShowingReturn ? RETURN_STEPS : DELIVERY_STEPS;
  const activeIndex = isShowingReturn ? returnIndex : deliveryIndex;

  // Helper to extract timestamp from order field or statusHistory
  const getDeliveryTimestamp = (step) => {
    if (order[step.dateField]) return formatTimestamp(order[step.dateField]);
    if (step.key === 'pending' && order.date) return formatTimestamp(order.date);
    if (Array.isArray(order.statusHistory)) {
      const historyEntry = order.statusHistory.find((h) => h.status === step.key);
      if (historyEntry?.timestamp) return formatTimestamp(historyEntry.timestamp);
    }
    return null;
  };

  const getReturnTimestamp = (step, idx) => {
    if (idx > returnIndex) return null;
    if (idx === 0) {
      return formatTimestamp(returnRequest?.requestDate || returnRequest?.createdAt || order.updatedAt);
    }
    if (idx === 1) {
      return formatTimestamp(returnRequest?.updatedAt || order.updatedAt);
    }
    if (idx === 2) {
      return formatTimestamp(returnRequest?.updatedAt || order.updatedAt);
    }
    if (idx === 3) {
      return formatTimestamp(order.refundDetails?.processedAt || returnRequest?.refundDetails?.processedAt || order.updatedAt);
    }
    return null;
  };

  const getStepTimestamp = (step, idx) => {
    return isShowingReturn ? getReturnTimestamp(step, idx) : getDeliveryTimestamp(step);
  };

  return (
    <div className="w-full space-y-4">
      {/* Cancelled Banner */}
      {isCancelled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-50/90 border border-red-200 flex items-start gap-3 shadow-sm"
        >
          <div className="p-2 rounded-full bg-red-100 text-red-600 flex-shrink-0 mt-0.5">
            <FiXCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-red-900">Order Cancelled</h4>
            <p className="text-xs text-red-700 mt-0.5">
              {order.cancellationReason || 'This order was cancelled.'}
            </p>
            {order.cancelledAt && (
              <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                <FiClock className="w-3 h-3" />
                Cancelled on {formatTimestamp(order.cancelledAt)}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Return & Refund Completed Banner */}
      {isReturned && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-start gap-3.5 shadow-sm"
        >
          <div className="p-2.5 rounded-xl bg-emerald-600 text-white flex-shrink-0 shadow-sm mt-0.5">
            <FiRotateCcw className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-emerald-950">
                Return Accepted & Refund Processed
              </h4>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white tracking-wide">
                Refund Completed
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              Your return request has been verified and completed. Refund of{' '}
              <span className="font-bold">
                {formatPrice(returnRequest?.refundAmount || order.refundDetails?.totalRefunded || order.total)}
              </span>{' '}
              has been processed to {returnRequest?.refundDestination || order.refundDetails?.destination || 'your account'}.
            </p>
            {returnRequest?.id && (
              <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between">
                <span className="text-[11px] text-emerald-800 font-semibold">
                  Return ID: #{returnRequest.id}
                </span>
                <Link
                  to={`/returns/${returnRequest.id}`}
                  className="text-xs font-bold text-[#7B0A0A] hover:underline flex items-center gap-1"
                >
                  <span>View Return Details</span>
                  <FiArrowRight className="text-xs" />
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Stepper Timeline */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 border border-gray-200/80 shadow-sm bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              {isShowingReturn ? 'Return & Refund Progress' : 'Order Progress'}
              {isReturned && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Return Mode
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isShowingReturn
                ? `Live return and refund status for #${order.orderId || order.id}`
                : `Live delivery updates for #${order.orderId || order.id}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle between Return Steps and Delivery Steps if returned */}
            {isReturned && (
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'return' ? 'delivery' : 'return')}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {viewMode === 'return' ? 'View Delivery Steps' : 'View Return Steps'}
              </button>
            )}

            {!isShowingReturn && order.trackingNumber && showTrackingLink && (
              <Link
                to={`/orders/${order.orderId || order.id}/track`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#7B0A0A] bg-red-50 hover:bg-red-100 transition-colors border border-red-200/50"
              >
                <FiNavigation className="w-3.5 h-3.5" />
                Live Track
              </Link>
            )}
          </div>
        </div>

        {/* Desktop / Tablet Horizontal Stepper */}
        <div className="hidden sm:block">
          <div className="relative flex items-center justify-between">
            {/* Background connecting rail */}
            <div className="absolute top-5 left-6 right-6 h-1 bg-gray-200 -z-0 rounded-full" />
            {/* Filled active connecting rail */}
            <div
              className={`absolute top-5 left-6 h-1 ${
                isShowingReturn
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                  : 'bg-gradient-to-r from-emerald-500 to-[#7B0A0A]'
              } -z-0 rounded-full transition-all duration-500`}
              style={{
                width: isCancelled
                  ? '0%'
                  : `${Math.min(100, Math.max(0, (activeIndex / (activeSteps.length - 1)) * 100))}%`,
              }}
            />

            {activeSteps.map((step, idx) => {
              const isCompleted = !isCancelled && activeIndex > idx;
              const isCurrent = !isCancelled && activeIndex === idx;
              const isFuture = isCancelled || activeIndex < idx;
              const timestamp = getStepTimestamp(step, idx);
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="flex flex-col items-center text-center z-10 w-24">
                  {/* Circle Indicator */}
                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : isCurrent
                        ? isShowingReturn
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-lg shadow-emerald-800/20'
                          : 'bg-gradient-to-br from-[#AE020B] to-[#7B0A0A] text-white ring-4 ring-red-100 shadow-lg shadow-red-900/30 animate-pulse'
                        : 'bg-white border-2 border-gray-300 text-gray-400'
                    }`}
                  >
                    <StepIcon className="w-5 h-5" />
                  </motion.div>

                  {/* Label */}
                  <p
                    className={`text-xs mt-2 font-bold leading-tight ${
                      isCurrent
                        ? isShowingReturn ? 'text-emerald-700' : 'text-[#7B0A0A]'
                        : isCompleted
                        ? 'text-gray-800'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </p>

                  {/* Timestamp */}
                  {timestamp ? (
                    <span className="text-[10px] text-gray-500 mt-1 font-medium">
                      {timestamp}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300 mt-1">
                      {isFuture ? 'Pending' : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Vertical Stepper */}
        <div className="block sm:hidden space-y-4 relative pl-3">
          {/* Vertical connecting line */}
          <div className="absolute left-[26px] top-3 bottom-6 w-0.5 bg-gray-200" />

          {activeSteps.map((step, idx) => {
            const isCompleted = !isCancelled && activeIndex > idx;
            const isCurrent = !isCancelled && activeIndex === idx;
            const isFuture = isCancelled || activeIndex < idx;
            const timestamp = getStepTimestamp(step, idx);
            const StepIcon = step.icon;

            return (
              <div key={step.key} className="flex items-start gap-3 relative z-10">
                {/* Circle Indicator */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : isCurrent
                      ? isShowingReturn
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-sm'
                        : 'bg-gradient-to-br from-[#AE020B] to-[#7B0A0A] text-white ring-4 ring-red-100 shadow-sm animate-pulse'
                      : 'bg-white border-2 border-gray-300 text-gray-400'
                  }`}
                >
                  <StepIcon className="w-3.5 h-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h5
                      className={`text-xs font-bold leading-tight ${
                        isCurrent
                          ? isShowingReturn ? 'text-emerald-700' : 'text-[#7B0A0A]'
                          : isCompleted
                          ? 'text-gray-800'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </h5>
                    {timestamp && (
                      <span className="text-[10px] text-gray-500 font-medium">
                        {timestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tracking number badge footer if available */}
        {!isShowingReturn && order.trackingNumber && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Tracking Number:
            </span>
            <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
              {order.trackingNumber}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderStatusTimeline;
