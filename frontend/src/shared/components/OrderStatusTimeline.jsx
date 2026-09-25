import React from 'react';
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
} from 'react-icons/fi';
import { Link } from 'react-router-dom';

const STEPS = [
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

const OrderStatusTimeline = ({ order, showTrackingLink = true }) => {
  if (!order) return null;

  const rawStatus = String(order.status || 'pending').toLowerCase();
  const isCancelled = rawStatus === 'cancelled';
  const isReturned = rawStatus === 'returned';

  const currentIndex = ORDER_PROGRESS_INDEX[rawStatus] ?? (rawStatus === 'shipped' ? 2 : 0);

  // Helper to extract timestamp from order field or statusHistory
  const getStepTimestamp = (step) => {
    // 1. Direct field on order
    if (order[step.dateField]) {
      return formatTimestamp(order[step.dateField]);
    }
    // 2. Fallback to order.date for pending
    if (step.key === 'pending' && order.date) {
      return formatTimestamp(order.date);
    }
    // 3. Fallback to statusHistory array
    if (Array.isArray(order.statusHistory)) {
      const historyEntry = order.statusHistory.find((h) => h.status === step.key);
      if (historyEntry?.timestamp) {
        return formatTimestamp(historyEntry.timestamp);
      }
    }
    return null;
  };

  return (
    <div className="w-full space-y-4">
      {/* Exception Status Banner (Cancelled / Returned) */}
      {isCancelled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-50/90 border border-red-200 flex items-start gap-3"
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

      {isReturned && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gray-50 border border-gray-300 flex items-start gap-3"
        >
          <div className="p-2 rounded-full bg-gray-200 text-gray-700 flex-shrink-0 mt-0.5">
            <FiRotateCcw className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-gray-900">Order Returned</h4>
            <p className="text-xs text-gray-600 mt-0.5">
              The return process for this order has been completed.
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Stepper Timeline */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 border border-gray-200/80 shadow-sm bg-white">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h3 className="text-base font-bold text-gray-900">Order Progress</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Live status updates for #{order.orderId || order.id}
            </p>
          </div>
          {order.trackingNumber && showTrackingLink && (
            <Link
              to={`/orders/${order.orderId || order.id}/track`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#7B0A0A] bg-red-50 hover:bg-red-100 transition-colors border border-red-200/50"
            >
              <FiNavigation className="w-3.5 h-3.5" />
              Live Track
            </Link>
          )}
        </div>

        {/* Desktop / Tablet Horizontal Stepper */}
        <div className="hidden sm:block">
          <div className="relative flex items-center justify-between">
            {/* Background connecting rail */}
            <div className="absolute top-5 left-6 right-6 h-1 bg-gray-200 -z-0 rounded-full" />
            {/* Filled active connecting rail */}
            <div
              className="absolute top-5 left-6 h-1 bg-gradient-to-r from-emerald-500 to-[#7B0A0A] -z-0 rounded-full transition-all duration-500"
              style={{
                width: isCancelled || isReturned
                  ? '0%'
                  : `${Math.min(100, Math.max(0, (currentIndex / (STEPS.length - 1)) * 100))}%`,
              }}
            />

            {STEPS.map((step, idx) => {
              const isCompleted = !isCancelled && !isReturned && currentIndex > idx;
              const isCurrent = !isCancelled && !isReturned && currentIndex === idx;
              const isFuture = isCancelled || isReturned || currentIndex < idx;
              const timestamp = getStepTimestamp(step);
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
                        ? 'bg-gradient-to-br from-[#AE020B] to-[#7B0A0A] text-white ring-4 ring-red-100 shadow-lg shadow-red-900/30 animate-pulse'
                        : 'bg-white border-2 border-gray-300 text-gray-400'
                    }`}
                  >
                    <StepIcon className="w-5 h-5" />
                  </motion.div>

                  {/* Label */}
                  <p
                    className={`text-xs mt-2 font-bold leading-tight ${
                      isCurrent
                        ? 'text-[#7B0A0A]'
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

          {STEPS.map((step, idx) => {
            const isCompleted = !isCancelled && !isReturned && currentIndex > idx;
            const isCurrent = !isCancelled && !isReturned && currentIndex === idx;
            const isFuture = isCancelled || isReturned || currentIndex < idx;
            const timestamp = getStepTimestamp(step);
            const StepIcon = step.icon;

            return (
              <div key={step.key} className="flex items-start gap-3 relative z-10">
                {/* Circle Indicator */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : isCurrent
                      ? 'bg-gradient-to-br from-[#AE020B] to-[#7B0A0A] text-white ring-4 ring-red-100 shadow-sm animate-pulse'
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
                          ? 'text-[#7B0A0A]'
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
        {order.trackingNumber && (
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
