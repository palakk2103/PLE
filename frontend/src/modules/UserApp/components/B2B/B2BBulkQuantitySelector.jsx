import React from 'react';
import { useBusinessBuyer } from '../../hooks/useBusinessBuyer';
import { formatPrice } from '../../../../shared/utils/helpers';
import { FiPlus, FiMinus, FiBox } from 'react-icons/fi';

export const B2BBulkQuantitySelector = ({ product, quantity, onChange }) => {
  const { getWholesaleSpecs } = useBusinessBuyer();
  const specs = getWholesaleSpecs(product.id, product.price);
  
  const moq = specs.moq;
  const cartonSize = specs.unitsPerCarton;

  const handleIncrement = () => {
    onChange(quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity > moq) {
      onChange(quantity - 1);
    }
  };

  const handleQuickAdd = (amount) => {
    const targetQty = quantity >= moq ? quantity + amount : moq + amount - 1;
    onChange(targetQty);
  };

  const handleSetExact = (amount) => {
    onChange(amount);
  };

  const currentCartons = Math.floor(quantity / cartonSize);
  const remainderUnits = quantity % cartonSize;

  return (
    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-4">
      {/* Tier display */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <FiBox className="text-primary-500" />
          <span>Wholesale Price Tiers</span>
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {specs.tiers.map((tier, idx) => {
            const isActive = quantity >= tier.minQty && (idx === specs.tiers.length - 1 || quantity < specs.tiers[idx + 1].minQty);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSetExact(tier.minQty)}
                className={`p-2.5 rounded-xl border text-center transition-all duration-200 flex flex-col justify-center items-center ${
                  isActive
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                    : 'border-gray-200 bg-white hover:border-primary-300'
                }`}
              >
                <span className="text-[10px] text-gray-500 font-medium">{tier.minQty}+ Units</span>
                <span className={`text-xs font-extrabold ${isActive ? 'text-primary-700' : 'text-gray-900'}`}>
                  {formatPrice(tier.price)}
                </span>
                <span className="text-[8px] text-primary-600 font-bold bg-primary-100/50 px-1 rounded mt-1">
                  {tier.price < product.price ? `Save ${Math.round(((product.price - tier.price) / product.price) * 100)}%` : 'Standard price'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Order Quantity</span>
          {quantity < moq && (
            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">
              Min Order (MOQ): {moq} {product.unit}s
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center border-2 border-gray-200 rounded-xl bg-white overflow-hidden flex-1 max-w-[200px]">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={quantity <= moq}
              className="p-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FiMinus />
            </button>
            <input
              type="number"
              min={moq}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                onChange(val);
              }}
              className="w-full text-center font-bold text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-base"
            />
            <button
              type="button"
              onClick={handleIncrement}
              className="p-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <FiPlus />
            </button>
          </div>

          <div className="text-xs text-gray-500 font-medium">
            <span className="font-bold text-gray-800">{currentCartons} Carton(s)</span>
            {remainderUnits > 0 && <span> + {remainderUnits} Unit(s)</span>}
            <p className="text-[10px] text-gray-400 mt-0.5">(1 Carton = {cartonSize} {product.unit}s)</p>
          </div>
        </div>
      </div>

      {/* Quick Add Buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => handleSetExact(moq)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        >
          Min MOQ ({moq})
        </button>
        <button
          type="button"
          onClick={() => handleQuickAdd(cartonSize)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        >
          +1 Carton (+{cartonSize})
        </button>
        <button
          type="button"
          onClick={() => handleQuickAdd(cartonSize * 2)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        >
          +2 Cartons (+{cartonSize * 2})
        </button>
        <button
          type="button"
          onClick={() => handleQuickAdd(cartonSize * 5)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        >
          +5 Cartons (+{cartonSize * 5})
        </button>
      </div>
    </div>
  );
};

export default B2BBulkQuantitySelector;
