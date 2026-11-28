import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiArrowLeft, 
  FiFileText, 
  FiInbox, 
  FiLayers, 
  FiAlertCircle, 
  FiUploadCloud, 
  FiCheck, 
  FiTrash 
} from 'react-icons/fi';
import api from '../../../shared/utils/api';
import toast from 'react-hot-toast';
import { useB2BAdminStore } from '../store/b2bAdminStore';

const CreateRFQ = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { adminProfile, fetchAdminProfile } = useB2BAdminStore();
  const isEmployee = adminProfile?.isEmployee || adminProfile?.role === 'b2bEmployee';
  const isEditing = !!id || searchParams.get('edit') === 'true';

  const [categories, setCategories] = useState([]);
  const [platformProducts, setPlatformProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isCustomProduct, setIsCustomProduct] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [rfqNumber, setRfqNumber] = useState('RFQ-AUTO-GEN');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Medium');
  
  const [productId, setProductId] = useState('');
  const [customProductName, setCustomProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [targetRate, setTargetRate] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  
  const [specifications, setSpecifications] = useState('');
  const [qualityStandards, setQualityStandards] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [attachment, setAttachment] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!adminProfile) {
      fetchAdminProfile();
    }
  }, [adminProfile, fetchAdminProfile]);

  useEffect(() => {
    // Fetch categories and platform products
    const loadFormData = async () => {
      try {
        const [catRes, prodRes, vendorRes] = await Promise.all([
          api.get('/categories/all'),
          api.get('/products'),
          api.get('/b2b-user/admin/vendors').catch(() => ({ data: [] })) // Fallback if API doesn't exist
        ]);
        if (catRes && catRes.data) setCategories(catRes.data);
        if (prodRes && prodRes.data) setPlatformProducts(prodRes.data.products || prodRes.data || []);
        if (vendorRes && vendorRes.data) setVendors(vendorRes.data.vendors || vendorRes.data || []);
      } catch (error) {
        console.error('Failed to load initial form data', error);
      }
    };
    loadFormData();

    // If editing, load RFQ detail
    if (id) {
      const loadRfqDetail = async () => {
        try {
          const res = await api.get(`/b2b-user/admin/rfq/${id}`);
          if (res && res.data) {
            const data = res.data;
            setTitle(data.title || '');
            setRfqNumber(data.rfqId);
            setCategory(data.category || '');
            setPriority(data.priority || 'Medium');
            if (data.productId) {
              setProductId(data.productId._id || data.productId);
              setIsCustomProduct(false);
            } else {
              setCustomProductName(data.customProductName || '');
              setIsCustomProduct(true);
            }
            setQuantity(data.quantity || '');
            setTargetRate(data.targetPrice || '');
            setUnit(data.unit || 'pcs');
            if (data.expectedDeliveryDate) {
              setExpectedDeliveryDate(data.expectedDeliveryDate.slice(0, 10));
            }
            setSpecifications(data.requirementDetails || '');
            setQualityStandards(data.qualityStandards || '');
            setTermsConditions(data.termsConditions || '');
            setAttachment(data.attachment || '');
          }
        } catch (error) {
          toast.error('Failed to load RFQ details for editing');
        }
      };
      loadRfqDetail();
    }
  }, [id]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await api.post('/b2b-user/admin/rfq/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res && res.data && res.data.url) {
        setAttachment(res.data.url);
        toast.success('File uploaded successfully!');
      } else {
        // Never save a made-up link: the vendor and admin would get a broken attachment.
        toast.error('The file could not be uploaded. Please try again.');
      }
    } catch (err) {
      console.error(err);
      // The API client already shows the server's reason (e.g. file type or size).
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (status) => {
    if (isCustomProduct && !customProductName.trim()) {
      toast.error('Please specify a product name.');
      return;
    }
    if (!isCustomProduct && !productId) {
      toast.error('Please select a platform product.');
      return;
    }
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }
    if (!targetRate || Number(targetRate) <= 0) {
      toast.error('Please enter a valid target rate per unit.');
      return;
    }
    const targetPrice = Number(targetRate);
    
    const payload = {
      title: title || customProductName || 'Procurement Request',
      category: category || 'General',
      priority,
      productId: isCustomProduct ? undefined : productId,
      customProductName: isCustomProduct ? customProductName : undefined,
      quantity: Number(quantity),
      targetPrice,
      requirementDetails: specifications,
      qualityStandards,
      termsConditions,
      expectedDeliveryDate,
      attachment,
      status, // 'Draft' or 'Submitted'
      vendorId: (isEmployee && selectedVendorId) ? selectedVendorId : undefined
    };

    try {
      setSubmitting(true);
      let res;
      if (id) {
        res = await api.put(`/b2b-user/admin/rfq/${id}`, payload);
      } else if (isEmployee && selectedVendorId) {
        // Direct RFQ creation
        res = await api.post('/b2b-user/employee/direct-rfq', payload);
      } else {
        res = await api.post('/b2b-user/admin/rfq', payload);
      }

      if (res.success || res.data) {
        toast.success(status === 'Submitted' ? ((isEmployee && selectedVendorId) ? 'Direct RFQ Sent to Vendor!' : 'RFQ Submitted to Super Admin!') : 'RFQ Draft Saved!');
        navigate('/b2b-dashboard/rfqs');
      }
    } catch (error) {
      // API error toast is already handled by axios interceptor in api.js
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[900px] mx-auto pb-16"
    >
      {/* Navigation & Title */}
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={() => navigate('/b2b-dashboard/rfqs')}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <FiArrowLeft strokeWidth={2.5} /> Back to Sourcing Center
        </button>
        <span className="text-xs font-mono font-bold text-gray-400">
          Ref ID: {rfqNumber}
        </span>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            {isEditing ? 'Modify Request for Quotation' : 'Create New Request for Quotation'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Fill in detailed specifications, delivery dates, and terms for bidding.
          </p>
        </div>

        {/* Section 1: General Info */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <FiLayers className="text-[#D71920]" /> General Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-gray-700">RFQ Title / Requirement Name *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sourcing Bulk Cotton Uniforms for Logistics Team"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-semibold text-gray-700"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
              </select>
            </div>

            <div className={isEmployee ? "space-y-1.5" : "md:col-span-2 space-y-1.5"}>
              <label className="text-xs font-bold text-gray-700">Category Selection *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-semibold text-gray-700"
              >
                <option value="">Choose a Category</option>
                {categories.length > 0 ? (
                  categories.map((c) => (
                    <option key={c._id} value={c.name}>{c.name}</option>
                  ))
                ) : (
                  <>
                    <option value="Electronics">Electronics</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Industrial Hardware">Industrial Hardware</option>
                    <option value="Apparel & Clothing">Apparel & Clothing</option>
                    <option value="Logistics Services">Logistics Services</option>
                  </>
                )}
              </select>
            </div>

            {isEmployee && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Target Vendor (Optional Direct RFQ)</label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-semibold text-gray-700"
                >
                  <option value="">Open to all vendors (Standard RFQ)</option>
                  {vendors.map((v) => (
                    <option key={v._id || v.id} value={v._id || v.id}>
                      {v.storeName || v.name} ({v.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Section 2: Product Sourcing Specs */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <FiInbox className="text-[#D71920]" /> Product / Sourcing Specifications
          </h3>
          <div className="flex gap-4 p-1 bg-gray-150/60 rounded-xl w-fit mb-4">
            <button
              type="button"
              onClick={() => setIsCustomProduct(true)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                isCustomProduct ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Custom Sourcing Request
            </button>
            <button
              type="button"
              onClick={() => setIsCustomProduct(false)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                !isCustomProduct ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Source Existing Platform Product
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isCustomProduct ? (
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Custom Product Name *</label>
                <input
                  type="text"
                  required
                  value={customProductName}
                  onChange={(e) => setCustomProductName(e.target.value)}
                  placeholder="e.g. High Density EPS Packing Boxes"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-medium"
                />
              </div>
            ) : (
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Select Platform Product *</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-semibold text-gray-700"
                >
                  <option value="">Search/Choose Platform Catalog</option>
                  {platformProducts.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} (Price: Rs. {p.price})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Required Quantity *</label>
              <div className="flex gap-2">
                <div className="flex flex-1 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#D71920]">
                  <input
                    type="number"
                    required
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="100"
                    className="w-full bg-transparent p-3 text-xs focus:outline-none font-medium"
                  />
                  <select
                    value={['pcs', 'kg', 'liters', 'meters', 'dozens', 'boxes', 'crates', 'packs', 'sets', 'tons'].includes(unit) ? unit : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'custom') {
                        setUnit(val);
                      } else {
                        setUnit('');
                      }
                    }}
                    className="w-24 bg-gray-100 text-center text-xs font-bold border-l border-gray-200 focus:outline-none text-gray-700 cursor-pointer"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="liters">liters</option>
                    <option value="meters">meters</option>
                    <option value="dozens">dozens</option>
                    <option value="boxes">boxes</option>
                    <option value="crates">crates</option>
                    <option value="packs">packs</option>
                    <option value="sets">sets</option>
                    <option value="tons">tons</option>
                    <option value="custom">Custom...</option>
                  </select>
                </div>
                {(!['pcs', 'kg', 'liters', 'meters', 'dozens', 'boxes', 'crates', 'packs', 'sets', 'tons'].includes(unit) || unit === '') && (
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Specify Unit"
                    className="w-28 bg-white border border-gray-250 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-bold text-center text-gray-800"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Target Rate (per unit) ₹ *</label>
              <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#D71920]">
                <span className="flex items-center px-3 text-gray-400 text-xs font-bold border-r border-gray-200 bg-gray-100 select-none">₹</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={targetRate}
                  onChange={(e) => setTargetRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent p-3 text-xs focus:outline-none font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Expected Delivery Timeline</label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-medium text-gray-700"
              />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Section 3: Sourcing Requirements */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <FiFileText className="text-[#D71920]" /> Procurement Requirements
          </h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Technical Specifications & Details</label>
              <textarea
                rows={4}
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                placeholder="List size constraints, core material grade specifications, color hex codes, packaging requirements..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Quality Standards & Certificates</label>
                <input
                  type="text"
                  value={qualityStandards}
                  onChange={(e) => setQualityStandards(e.target.value)}
                  placeholder="e.g. ISO 9001 certified, RoHS Compliant, OEKO-TEX standard"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Terms & Conditions</label>
                <input
                  type="text"
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  placeholder="e.g. NET 30 Days payment timeline, inspection on arrival"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Section 4: Attachments */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <FiUploadCloud className="text-[#D71920]" /> Document Attachments
          </h3>
          <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
            <FiUploadCloud className="w-8 h-8 mx-auto text-[#D71920] mb-2" />
            <span className="text-xs font-bold text-gray-800 block">Upload Technical Blueprints or CAD files</span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Formats supported: PDF, DOCX, ZIP, PNG, JPG (Max 5MB)</span>
            
            <div className="mt-3 flex justify-center">
              <label className="cursor-pointer bg-[#D71920] hover:bg-[#B51218] text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm">
                {uploading ? 'Uploading...' : 'Choose File'}
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            {attachment && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl p-2.5 max-w-[320px] mx-auto">
                <FiCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="truncate flex-1 font-semibold text-[10px] text-left">{attachment}</span>
                <button
                  type="button"
                  onClick={() => setAttachment('')}
                  className="p-1 hover:bg-emerald-100 rounded text-red-600"
                >
                  <FiTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form Submission Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate('/b2b-dashboard/rfqs')}
            className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-600 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={() => handleSubmit('Draft')}
            disabled={submitting}
            className="px-4 py-2.5 border border-gray-250 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-650 transition-all flex items-center"
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => handleSubmit('Submitted')}
            disabled={submitting}
            className="px-5 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-xs font-bold transition-all flex items-center shadow-sm"
          >
            {submitting && <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-2"></span>}
            Submit RFQ
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CreateRFQ;
