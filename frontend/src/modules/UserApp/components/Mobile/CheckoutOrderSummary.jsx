import { FiShoppingBag } from "react-icons/fi";
import { formatPrice } from "../../../../shared/utils/helpers";
import { formatVariantLabel, getVariantSignature } from "../../../../shared/utils/variant";
import { useLoyaltyStore } from "../../../../shared/store/loyaltyStore";

const OrderSummary = ({
  itemsByVendor,
  total,
  discount,
  shipping,
  tax,
  finalTotal,
  pointsDiscount = 0,
  isEstimatingShipping = false,
  paymentMethod = 'card',
  courierBreakdown = null,
  liveGstRates = {},
  gstSlabs = []
}) => {
  return (
    <div className="glass-card rounded-xl p-4">
      <h3 className="text-base font-bold text-gray-800 mb-3">Order Summary</h3>
      <div className="space-y-3 mb-4">
        {itemsByVendor.map((vendorGroup) => (
          <div key={vendorGroup.vendorId} className="space-y-2 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-50 to-red-100 rounded-lg border border-red-200/50 shadow-sm">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-400 to-red-650 flex items-center justify-center flex-shrink-0">
                <FiShoppingBag className="text-white text-[10px]" />
              </div>
              <span className="text-sm font-bold text-red-700 flex-1">{vendorGroup.vendorName}</span>
              <span className="text-xs font-semibold text-red-600 bg-white px-2 py-0.5 rounded-md">
                {formatPrice(vendorGroup.subtotal)}
              </span>
            </div>
            <div className="space-y-2 pl-2">
              {vendorGroup.items.map((item, itemIndex) => {
                const itemGst = Number(liveGstRates[String(item.id)] ?? item.gstRate ?? item.resolvedGstRate ?? item.taxRate ?? 18);
                const itemTaxAmount = ((item.price * item.quantity * itemGst) / 100);
                return (
                  <div
                    key={`${item.id}-${itemIndex}-${getVariantSignature(item?.variant || {})}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate text-xs">{item.name}</p>
                      <p className="text-gray-600 text-xs">
                        {formatPrice(item.price)} x {item.quantity}
                      </p>
                      {formatVariantLabel(item?.variant) && (
                        <p className="text-[11px] text-gray-500">{formatVariantLabel(item?.variant)}</p>
                      )}
                      <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                        {itemGst}% GST (+{formatPrice(itemTaxAmount)})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-semibold text-gray-800">{formatPrice(total)}</span>
        </div>
        {discount - pointsDiscount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Coupon Discount</span>
            <span>-{formatPrice(discount - pointsDiscount)}</span>
          </div>
        )}
        {pointsDiscount > 0 && (
          <div className="flex justify-between text-amber-600">
            <span>Points Discount</span>
            <span>-{formatPrice(pointsDiscount)}</span>
          </div>
        )}

        {/* Delivery Fee with Shiprocket Breakdown */}
        <div className="pt-1.5 border-t border-dashed border-gray-200 space-y-1.5">
          <div className="flex justify-between text-gray-600 items-center">
            <span className="flex items-center gap-1.5 font-medium">
              <span>Delivery Fee</span>
              {isEstimatingShipping && (
                <span className="inline-block w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" title="Calculating Shiprocket rates..." />
              )}
              <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {paymentMethod === 'cash' || paymentMethod === 'cod' ? 'COD' : 'Prepaid'}
              </span>
            </span>
            <span className="font-bold text-gray-900">
              {shipping === 0 ? <span className="text-green-600 font-semibold">FREE</span> : formatPrice(shipping)}
            </span>
          </div>

          {courierBreakdown && Object.keys(courierBreakdown).length > 0 && (() => {
            const couriers = Object.values(courierBreakdown).filter(Boolean);
            if (!couriers.length) return null;
            const primary = couriers[0];
            return (
              <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200/60 text-xs space-y-1">
                <div className="flex items-center justify-between text-blue-900 font-bold text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    {primary.source === 'shiprocket' ? '🚀 Shiprocket Live Rate' : '📦 Assigned Courier'}
                  </span>
                  <span>{primary.estimatedDays || '2–4 Business Days'}</span>
                </div>
                <div className="text-[11px] text-blue-800 flex items-center justify-between">
                  <span className="truncate">{primary.courierName || 'Standard Express Line'}</span>
                  <span className="font-semibold">{formatPrice(primary.rate ?? shipping)}</span>
                </div>
                {couriers.length > 1 && (
                  <p className="text-[10px] text-blue-600 pt-1 border-t border-blue-200/50">
                    Multi-vendor order: {couriers.length} parcels dispatched separately.
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* GST Section with Slabs Breakdown */}
        <div className="pt-1.5 border-t border-dashed border-gray-200 space-y-1.5">
          <div className="flex justify-between text-gray-600">
            <span className="font-medium">Estimated GST & Taxes</span>
            <span className="font-bold text-gray-900">{formatPrice(tax)}</span>
          </div>

          {gstSlabs && gstSlabs.length > 0 && (
            <div className="p-2 rounded-xl bg-gray-50 border border-gray-200/60 space-y-1 text-xs">
              <div className="flex items-center justify-between font-bold text-gray-700 text-[11px]">
                <span>Configured GST Slabs</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">CGST + SGST</span>
              </div>
              {gstSlabs.map((slab) => (
                <div key={slab.rate} className="flex items-center justify-between text-[11px] text-gray-600">
                  <span>GST @ {slab.rate}% ({slab.count} items, {formatPrice(slab.taxableAmount)})</span>
                  <span className="font-semibold text-gray-800">{formatPrice(slab.taxAmount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t border-gray-200">
          <span>Total</span>
          <span className="text-red-700 font-black">{formatPrice(finalTotal)}</span>
        </div>
      </div>
      
      {/* Estimated loyalty points earned */}
      <LoyaltyEarnEstimate totalToEarnFrom={Math.max(0, total - discount)} />
    </div>
  );
};

const LoyaltyEarnEstimate = ({ totalToEarnFrom }) => {
  const { rules } = useLoyaltyStore();
  if (!rules?.enabled || totalToEarnFrom <= 0) return null;
  const points = Math.floor((totalToEarnFrom / (rules.purchaseAmountUnit || 100)) * (rules.purchaseToPointsRatio || 5));
  if (points <= 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-gray-150 text-center text-xs text-emerald-800 font-semibold flex items-center justify-center gap-1">
      <span>🎯 You will earn:</span>
      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-black">
        {points} Points
      </span>
    </div>
  );
};

export default OrderSummary;

