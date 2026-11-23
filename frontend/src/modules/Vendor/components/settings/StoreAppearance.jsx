import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiImage, FiUpload, FiTrash2, FiCheckCircle, FiMapPin, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../../../shared/utils/api';
import { uploadVendorImage } from '../../services/vendorService';
import StorefrontPreview from './StorefrontPreview';

const DEFAULT_THEME = { primaryColor: '#7B0A0A', accentColor: '#F59E0B' };
const HEX = /^#[0-9a-fA-F]{6}$/;

const ColorField = ({ label, value, onChange, disabled, testId }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} disabled={disabled} className="h-10 w-12 rounded border border-gray-300 cursor-pointer" aria-label={label} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={7} data-testid={testId} className={`w-28 px-3 py-2 border rounded-lg font-mono text-sm ${HEX.test(value) ? 'border-gray-300' : 'border-red-400'}`} />
    </div>
  </div>
);

const ImageField = ({ label, hint, value, onChange, folder, disabled, shape = 'square', testId }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return toast.error('Please choose a PNG, JPG or WebP image.');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5 MB.');
    setBusy(true);
    try {
      const res = await uploadVendorImage(file, folder);
      const url = res?.data?.url;
      if (!url) throw new Error('no url');
      onChange(url);
    } catch {
      toast.error('Could not upload the image. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      <div className="flex items-center gap-3">
        <div className={`bg-gray-100 border border-dashed border-gray-300 overflow-hidden flex items-center justify-center ${shape === 'wide' ? 'w-48 h-20 rounded-lg' : 'w-20 h-20 rounded-full'}`}>
          {value ? <img src={value} alt={label} className="w-full h-full object-cover" /> : <FiImage className="text-2xl text-gray-400" />}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} data-testid={`${testId}-input`} />
          <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50" data-testid={`${testId}-choose`}>
            <FiUpload /> {busy ? 'Uploading…' : value ? 'Change' : 'Upload'}
          </button>
          {value && (
            <button type="button" disabled={disabled || busy} onClick={() => onChange('')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50" data-testid={`${testId}-remove`}>
              <FiTrash2 /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Vendor Panel > Store Settings > Storefront: what customers see on the seller page. */
const StoreAppearance = ({ isManaged = false }) => {
  const [loaded, setLoaded] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const hydrate = (data) => {
    setLoaded(data);
    setForm({
      storeLogo: data.storeLogo || '',
      bannerUrl: data.public?.bannerUrl || '',
      tagline: data.public?.tagline || '',
      about: data.public?.about || '',
      businessHours: data.public?.businessHours || '',
      primaryColor: data.public?.theme?.primaryColor || DEFAULT_THEME.primaryColor,
      accentColor: data.public?.theme?.accentColor || DEFAULT_THEME.accentColor,
    });
  };

  useEffect(() => {
    if (isManaged) return undefined;
    let alive = true;
    api.get('/vendor/store-profile').then((res) => { if (alive) hydrate(res?.data ?? res); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [isManaged]);

  if (isManaged) {
    return <p className="p-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">Your storefront is set up by the Shop Administrator.</p>;
  }
  if (error) return <p className="p-4 text-sm text-red-600">Could not load your storefront settings.</p>;
  if (!form) return <p className="p-4 text-sm text-gray-500">Loading storefront settings…</p>;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const colorsOk = HEX.test(form.primaryColor) && HEX.test(form.accentColor);
  const dirty = JSON.stringify(form) !== JSON.stringify({
    storeLogo: loaded.storeLogo || '', bannerUrl: loaded.public?.bannerUrl || '', tagline: loaded.public?.tagline || '', about: loaded.public?.about || '',
    businessHours: loaded.public?.businessHours || '', primaryColor: loaded.public?.theme?.primaryColor, accentColor: loaded.public?.theme?.accentColor,
  });

  const save = async (e) => {
    e.preventDefault();
    if (!colorsOk) return toast.error('Colours must look like #7B0A0A.');
    setSaving(true);
    try {
      const res = await api.put('/vendor/store-profile', {
        storeLogo: form.storeLogo, bannerUrl: form.bannerUrl, tagline: form.tagline, about: form.about, businessHours: form.businessHours,
        theme: { primaryColor: form.primaryColor, accentColor: form.accentColor },
      });
      hydrate(res?.data ?? res);
      toast.success('Storefront saved. Customers see it now.');
    } catch {
      // api.js already shows the server's message (e.g. contact details not allowed)
    } finally {
      setSaving(false);
    }
  };

  const business = loaded.public?.business || {};
  const preview = {
    storeName: loaded.storeName, storeLogo: form.storeLogo,
    storeProfile: {
      theme: { primaryColor: HEX.test(form.primaryColor) ? form.primaryColor : DEFAULT_THEME.primaryColor, accentColor: HEX.test(form.accentColor) ? form.accentColor : DEFAULT_THEME.accentColor },
      bannerUrl: form.bannerUrl, tagline: form.tagline, about: form.about, businessHours: form.businessHours, business,
    },
  };

  return (
    <form onSubmit={save} className="p-3 sm:p-4 md:p-6 grid grid-cols-1 xl:grid-cols-2 gap-8" data-testid="store-appearance">
      <div className="space-y-6">
        <ImageField label="Store logo" hint="Square image, shown on the Best Sellers list and your page." value={form.storeLogo} onChange={set('storeLogo')} folder="vendors/store" testId="logo" />
        <ImageField label="Store banner" hint="Wide image at the top of your page (about 1200 × 400)." value={form.bannerUrl} onChange={set('bannerUrl')} folder="vendors/store" shape="wide" testId="banner" />
        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Theme colour" value={form.primaryColor} onChange={set('primaryColor')} testId="primary-color" />
          <ColorField label="Accent colour" value={form.accentColor} onChange={set('accentColor')} testId="accent-color" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tagline <span className="text-gray-400 font-normal">({form.tagline.length}/100)</span></label>
          <input type="text" value={form.tagline} maxLength={100} onChange={(e) => set('tagline')(e.target.value)} data-testid="tagline" className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Genuine electronics since 2010" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">About your business <span className="text-gray-400 font-normal">({form.about.length}/1500)</span></label>
          <textarea value={form.about} maxLength={1500} rows={4} onChange={(e) => set('about')(e.target.value)} data-testid="about" className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="What you sell, warranty, delivery promise…" />
          <p className="text-xs text-gray-500 mt-1">Phone numbers, emails and links are not allowed here. Customers reach you through chat.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Business hours</label>
          <input type="text" value={form.businessHours} maxLength={100} onChange={(e) => set('businessHours')(e.target.value)} data-testid="hours" className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Mon-Sat 10AM-7PM" />
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm space-y-1.5" data-testid="business-details">
          <p className="font-semibold text-gray-800">Business details shown to customers</p>
          <p className="text-gray-600"><span className="text-gray-500">Name:</span> {business.businessName || business.ownerName || '—'}</p>
          <p className="text-gray-600 flex items-center gap-1.5"><span className="text-gray-500">GST:</span> {business.gstNumber || '—'} {business.gstVerified && <FiCheckCircle className="text-green-600" title="Verified by PLE" />}</p>
          <p className="text-gray-600 flex items-start gap-1.5"><FiMapPin className="mt-0.5 shrink-0 text-gray-400" /> {business.address?.text || 'No address yet'}</p>
          <p className="text-xs text-gray-500 pt-1">These come from your verified business profile. To change them, update your <Link to="/vendor/settings/business" className="text-purple-600 underline">Business Profile</Link>.</p>
        </div>

        <button type="submit" disabled={saving || !dirty || !colorsOk} data-testid="save-storefront" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-white font-semibold disabled:opacity-50">
          <FiSave /> {saving ? 'Saving…' : 'Save storefront'}
        </button>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Preview (what customers see)</p>
        <StorefrontPreview vendor={preview} />
      </div>
    </form>
  );
};

export default StoreAppearance;
