import { FiCheckCircle, FiClock, FiMapPin, FiStar } from 'react-icons/fi';

/**
 * The seller header customers see. Shared by the vendor's live preview and the customer Seller page,
 * so what the vendor previews is exactly what customers get.
 */
const StorefrontPreview = ({ vendor, rating = 0, productCount = null, children }) => {
  const sp = vendor?.storeProfile || {};
  const theme = sp.theme || {};
  const primary = theme.primaryColor || '#7B0A0A';
  const accent = theme.accentColor || '#F59E0B';
  const b = sp.business || {};
  const name = vendor?.storeName || vendor?.name || '';

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm" data-testid="storefront" style={{ '--store-primary': primary, '--store-accent': accent }}>
      <div className="h-28 sm:h-36 w-full" style={sp.bannerUrl ? { backgroundImage: `url("${sp.bannerUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(135deg, ${primary}, ${accent})` }} data-testid="storefront-banner" />
      <div className="px-4 pb-4">
        <div className="-mt-10 flex items-end gap-3">
          <div className="w-20 h-20 rounded-full bg-white p-1 shadow-md overflow-hidden shrink-0" style={{ border: `3px solid ${accent}` }}>
            {vendor?.storeLogo ? (
              <img src={vendor.storeLogo} alt={name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ background: primary }}>{name.charAt(0).toUpperCase()}</div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <h2 className="text-lg font-bold" style={{ color: primary }} data-testid="storefront-name">{name}</h2>
          {vendor?.isVerified && <FiCheckCircle className="text-blue-500" title="Verified seller" />}
        </div>
        {sp.tagline && <p className="text-sm text-gray-600" data-testid="storefront-tagline">{sp.tagline}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          {rating > 0 && <span className="inline-flex items-center gap-1"><FiStar className="text-yellow-500 fill-yellow-500" />{rating} Ratings</span>}
          {productCount !== null && <span>{productCount} Products</span>}
          {sp.businessHours && <span className="inline-flex items-center gap-1"><FiClock className="text-gray-400" />{sp.businessHours}</span>}
        </div>

        {sp.about && <p className="mt-3 text-sm text-gray-700 whitespace-pre-line" data-testid="storefront-about">{sp.about}</p>}

        {(b.businessName || b.gstNumber || b.address?.text || b.ownerName) && (
          <dl className="mt-4 rounded-xl p-3 text-sm space-y-1.5" style={{ background: `${primary}0F` }} data-testid="storefront-business">
            {b.businessName && <div className="flex justify-between gap-3"><dt className="text-gray-500">Business</dt><dd className="font-medium text-right">{b.businessName}{b.tradeName && b.tradeName !== b.businessName ? ` (${b.tradeName})` : ''}</dd></div>}
            {b.ownerName && <div className="flex justify-between gap-3"><dt className="text-gray-500">Owner</dt><dd className="font-medium text-right">{b.ownerName}</dd></div>}
            {b.businessType && <div className="flex justify-between gap-3"><dt className="text-gray-500">Type</dt><dd className="text-right">{b.businessType}</dd></div>}
            {b.gstNumber && (
              <div className="flex justify-between gap-3"><dt className="text-gray-500">GST No.</dt>
                <dd className="font-mono font-medium text-right inline-flex items-center gap-1">{b.gstNumber}{b.gstVerified && <FiCheckCircle className="text-green-600" title="Verified by PLE" />}</dd></div>
            )}
            {b.address?.text && <div className="flex justify-between gap-3"><dt className="text-gray-500 inline-flex items-center gap-1"><FiMapPin />Address</dt><dd className="text-right">{b.address.text}</dd></div>}
          </dl>
        )}
        {children}
      </div>
    </div>
  );
};

export default StorefrontPreview;
