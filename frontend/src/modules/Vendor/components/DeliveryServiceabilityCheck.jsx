import { useState } from 'react';
import { FiMapPin, FiCheckCircle, FiXCircle, FiSearch } from 'react-icons/fi';
import { checkDeliveryServiceability } from '../services/vendorService';

/**
 * Vendor-side "can I deliver to this pincode?" checker (Shiprocket-style).
 */
const DeliveryServiceabilityCheck = () => {
  const [pincode, setPincode] = useState('');
  const [cod, setCod] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!/^\d{6}$/.test(pincode)) {
      setError('Enter a valid 6-digit pincode.');
      return;
    }
    setLoading(true);
    try {
      const res = await checkDeliveryServiceability({ pincode, cod });
      setResult(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Could not check serviceability.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-white/5 p-4 sm:p-6">
      <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
        <FiMapPin /> Check delivery serviceability
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Enter the customer's delivery pincode to see if delivery is available from your pickup location.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <input
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          placeholder="Customer pincode"
          className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm w-44 bg-transparent"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} /> Cash on delivery
        </label>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer"
        >
          <FiSearch /> {loading ? 'Checking…' : 'Check'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className={`mt-4 p-4 rounded-xl border ${result.serviceable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`flex items-center gap-2 font-bold ${result.serviceable ? 'text-emerald-700' : 'text-red-700'}`}>
            {result.serviceable ? <FiCheckCircle /> : <FiXCircle />}
            {result.serviceable ? 'Delivery available' : 'Delivery not available'} · {result.pickupPincode} → {result.deliveryPincode}
          </div>
          {!result.serviceable && result.reason && <p className="text-xs text-red-600 mt-1">{result.reason}</p>}
          {result.serviceable && (
            <>
              <p className="text-xs text-gray-600 mt-1">
                COD: {result.codAvailable ? 'available' : 'not available'}
                {result.selectedCourier?.courierName && ` · Recommended: ${result.selectedCourier.courierName}`}
                {result.selectedCourier?.etd && ` · ETA ${result.selectedCourier.etd}`}
              </p>
              {result.couriers?.length > 0 && (
                <ul className="mt-2 text-xs text-gray-700 divide-y divide-emerald-100">
                  {result.couriers.map((c, i) => (
                    <li key={i} className="py-1 flex justify-between gap-2">
                      <span>{c.name}</span>
                      <span>₹{c.rate} {c.etd ? `· ${c.etd}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryServiceabilityCheck;
