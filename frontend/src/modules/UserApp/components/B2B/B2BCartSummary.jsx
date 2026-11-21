import React from 'react';
import { useBusinessBuyer } from '../../hooks/useBusinessBuyer';
import { getProductById } from '../../data/catalogData';
import { formatPrice } from '../../../../shared/utils/helpers';
import { FiTrendingDown, FiPercent, FiClock, FiAlertCircle } from 'react-icons/fi';

export const B2BCartSummary = ({ cartItems, subtotal }) => {
  const { isBusiness, getWholesaleSpecs } = useBusinessBuyer();

  if (!isBusiness || !cartItems || cartItems.length === 0) return null;

  // Let's compute detailed GST slabs, total retail cost, and MOQ check
  let totalGST = 0;
  let totalSavings = 0;
  let hasMoqIssues = false;
  const moqWarnings = [];

  cartItems.forEach((item) => {
    const specs = getWholesaleSpecs(item.id, item.price);
    
    // Check if item meets MOQ in the cart
    if (item.quantity < specs.moq) {
      hasMoqIssues = true;
      moqWarnings.push(`${item.name} needs min. ${specs.moq} ${item.unit || 'Piece'}s`);
    }

    // Savings = Retail Price vs Wholesale Price
    // For fashion products, our mock wholesale is already calculated and inserted as price in cart line.
    // Let's assume the base retail price was about 25% higher
    // Use the product's real retail price when we have it; otherwise fall back to an estimate.
    const catalogRetail = Number(getProductById(item.id)?.price);
    const estimatedRetailPrice = catalogRetail > item.price
      ? catalogRetail
      : Math.round((item.price / 0.8) * 100) / 100;
    const itemSavings = (estimatedRetailPrice - item.price) * item.quantity;
    totalSavings += itemSavings;

    // GST input tax calculation
    const gstPercent = specs.gstSlab || 12;
    // item.price is GST inclusive. Let's compute GST amount: Price - (Price / (1 + GST%))
    const itemPriceExcludingGst = item.price / (1 + gstPercent / 100);
    const itemGst = (item.price - itemPriceExcludingGst) * item.quantity;
    totalGST += itemGst;
  });

  return (
    <div className="bg-red-50/30 rounded-2xl p-4 border border-red-200/40 space-y-3.5 mt-2 mb-4">
      <div className="flex items-center justify-between border-b border-red-100/50 pb-2">
        <span className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
          <FiTrendingDown />
          <span>Business Order Summary</span>
        </span>
        <span className="text-[10px] font-extrabold bg-red-100 text-[#7B0A0A] px-2 py-0.5 rounded-full uppercase">
          Wholesale Active
        </span>
      </div>

      {hasMoqIssues && (
        <div className="bg-red-50 text-red-700 p-2.5 rounded-xl border border-red-100 text-[11px] font-semibold space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            <FiAlertCircle className="w-4 h-4 text-red-500" />
            <span>MOQ Requirement Warning</span>
          </div>
          <ul className="list-disc list-inside pl-1 space-y-0.5 font-medium">
            {moqWarnings.slice(0, 3).map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-gray-650">
          <span>Gross Subtotal:</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-red-650 font-semibold">
          <span className="flex items-center gap-1">
            <FiPercent />
            <span>GST Input Tax Credit (Claimable):</span>
          </span>
          <span>{formatPrice(totalGST)}</span>
        </div>
        <div className="flex justify-between text-red-700 font-bold">
          <span>Estimated Business Savings:</span>
          <span>-{formatPrice(totalSavings)}</span>
        </div>
        <div className="flex justify-between text-gray-700 pt-1 border-t border-dashed border-red-100 font-medium">
          <span className="flex items-center gap-1 text-[11px]">
            <FiClock />
            <span>Payment Terms:</span>
          </span>
          <span className="text-[11px] font-bold text-gray-900">NET 30 (Credit Available)</span>
        </div>
      </div>
    </div>
  );
};

export default B2BCartSummary;
