import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiUpload, FiInfo, FiLock } from "react-icons/fi";
import { motion } from "framer-motion";
import { useVendorAuthStore } from "../../store/vendorAuthStore";
import { useVendorProductStore } from "../../store/vendorProductStore";
import { useCategoryStore } from "../../../../shared/store/categoryStore";
import { useBrandStore } from "../../../../shared/store/brandStore";
import { uploadVendorImage, uploadVendorImages } from "../../services/vendorService";
import CategorySelector from "../../../Admin/components/CategorySelector";
import AnimatedSelect from "../../../Admin/components/AnimatedSelect";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";
import {
  parseVariantAxis,
  buildVariantCombinations,
  syncVariantPricesWithAxes,
  buildVariantPayload,
  normalizeVariantStateForForm,
} from "../../utils/variantHelpers";
import RefurbishedFieldsSection from "../../components/Refurbished/RefurbishedFieldsSection";
import { DEFAULT_REFURBISHED_STATE } from "../../components/Refurbished/refurbishedConstants";

const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { vendor, refreshProfile } = useVendorAuthStore();
  const isManagedVendor = vendor?.role === "managed_vendor";
  const isB2BApproved = isManagedVendor || vendor?.b2bSellingStatus?.toLowerCase() === 'approved';
  const { fetchProductById, editProduct, addProduct, getById, isSaving } =
    useVendorProductStore();
  const isEdit = id && id !== "new";

  const vendorId = vendor?.id || vendor?._id;

  const { categories, initialize: initCategories } = useCategoryStore();
  const { brands, initialize: initBrands } = useBrandStore();

  const [b2bSettings, setB2bSettings] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    unit: "",
    price: "",
    originalPrice: "",
    image: "",
    images: [],
    categoryId: null,
    subcategoryId: null,
    brandId: null,
    isCustomBrand: false,
    customBrandName: "",
    stock: "in_stock",
    stockQuantity: "",
    totalAllowedQuantity: "",
    minimumOrderQuantity: "",
    warrantyPeriod: "",
    guaranteePeriod: "",
    hsnCode: "",
    flashSale: false,
    isNewArrival: false,
    isFeatured: false,
    isVisible: true,
    codAllowed: true,
    returnable: true,
    cancelable: true,
    taxIncluded: false,
    gstMode: "category",
    gstRate: 18,
    description: "",
    tags: [],
    variants: {
      sizes: [],
      colors: [],
      materials: [],
      attributes: [],
      prices: {},
      stockMap: {},
      imageMap: {},
      defaultVariant: {},
      defaultSelection: {},
    },
    seoTitle: "",
    seoDescription: "",
    relatedProducts: [],
    faqs: [],
    b2bEnabled: false,
    salesChannel: "B2C",
    b2bWholesalePrice: "",
    b2bMinOrderQty: "",
    b2bUnitsPerCarton: "",
    b2bGstRate: "18",
    b2bBulkPricingSlabs: [],
    b2bGstInvoice: true,
    b2bPackagingType: "standard",
    b2bLeadTimeDays: "",
    b2bCreditTerms: "prepaid",
    ...DEFAULT_REFURBISHED_STATE,
  });
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [variantAxisInput, setVariantAxisInput] = useState({
    sizes: "",
    colors: "",
  });
  const variantCombinations = useMemo(
    () =>
      buildVariantCombinations(
        formData.variants?.sizes || [],
        formData.variants?.colors || [],
        formData.variants?.attributes || []
      ),
    [formData.variants?.sizes, formData.variants?.colors, formData.variants?.attributes]
  );

  const normalizeId = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value._id ?? value.id ?? null;
    return value;
  };

  useEffect(() => {
    initCategories();
    initBrands();
    if (refreshProfile) {
      refreshProfile();
    }
    api.get('/settings/b2b').then(res => {
      const s = res?.data?.data || res?.data || res;
      if (s) {
        setB2bSettings(s);
      }
    }).catch(err => console.error('Failed to load b2b settings', err));
  }, [initCategories, initBrands]);

  useEffect(() => {
    if (!vendorId) {
      toast.error("Please log in to edit products");
      navigate("/vendor/login");
      return;
    }

    if (isEdit) {
      // First try local cache, then fetch from API by id
      const cached = getById(id);
      if (cached) {
        populateForm(cached, categories);
      } else {
        fetchProductById(id).then((product) => {
          if (!product) {
            toast.error("Product not found");
            navigate("/vendor/products/manage-products");
            return;
          }
          populateForm(product, categories);
        });
      }
    }
  }, [isEdit, id, vendorId, navigate, categories, getById, fetchProductById]);

  const populateForm = (product, cats) => {
    const normalizedCategoryId = normalizeId(product.categoryId);
    const normalizedBrandId = normalizeId(product.brandId);
    const normalizedSubcategoryId = normalizeId(product.subcategoryId);
    const category = cats.find(
      (cat) => String(cat._id ?? cat.id) === String(normalizedCategoryId)
    );
    const normalizedParentCategoryId = normalizeId(category?.parentId);
    const isSubcategory = Boolean(normalizedParentCategoryId);

    const normalizedVariants = normalizeVariantStateForForm(
      product.variants || {},
      product.price
    );

    const isBrandPending = product.brandApprovalStatus === 'pending' || Boolean(product.customBrandName) || (typeof product.brandId === 'object' && product.brandId?.status === 'pending');
    const resolvedCustomBrandName = product.customBrandName || (typeof product.brandId === 'object' ? product.brandId?.name : '');

    setFormData({
      name: product.name || "",
      unit: product.unit || "",
      price: product.price || "",
      originalPrice: product.originalPrice || product.price || "",
      image: product.image || "",
      images: product.images || [],
      categoryId: isSubcategory
        ? normalizedParentCategoryId
        : normalizedCategoryId || null,
      subcategoryId: isSubcategory
        ? normalizedCategoryId
        : normalizedSubcategoryId || null,
      brandId: isBrandPending ? "__custom__" : (normalizedBrandId || null),
      isCustomBrand: isBrandPending,
      customBrandName: resolvedCustomBrandName || "",
      stock: product.stock || "in_stock",
      stockQuantity: product.stockQuantity || "",
      totalAllowedQuantity: product.totalAllowedQuantity || "",
      minimumOrderQuantity: product.minimumOrderQuantity || "",
      warrantyPeriod: product.warrantyPeriod || "",
      guaranteePeriod: product.guaranteePeriod || "",
      hsnCode: product.hsnCode || "",
      flashSale: product.flashSale || false,
      isNewArrival: product.isNewArrival || false,
      isFeatured: product.isFeatured || false,
      isVisible: product.isVisible !== undefined ? product.isVisible : true,
      codAllowed: product.codAllowed !== undefined ? product.codAllowed : true,
      returnable: product.returnable !== undefined ? product.returnable : true,
      cancelable: product.cancelable !== undefined ? product.cancelable : true,
      taxIncluded: product.taxIncluded || false,
      gstMode: product.gstMode || "category",
      gstRate: product.gstRate !== undefined ? Number(product.gstRate) : (product.taxRate ? Number(product.taxRate) : 18),
      description: product.description || "",
      tags: product.tags || [],
      variants: normalizedVariants,
      seoTitle: product.seoTitle || "",
      seoDescription: product.seoDescription || "",
      relatedProducts: product.relatedProducts || [],
      faqs: Array.isArray(product.faqs) ? product.faqs : [],
      b2bEnabled: product.b2bEnabled || false,
      salesChannel: product.salesChannel || (product.b2bEnabled ? "BOTH" : "B2C"),
      b2bWholesalePrice: product.b2bWholesalePrice || "",
      b2bMinOrderQty: product.b2bMinOrderQty || "",
      b2bUnitsPerCarton: product.b2bUnitsPerCarton || "",
      b2bGstRate: product.b2bGstRate || "18",
      b2bBulkPricingSlabs: Array.isArray(product.b2bBulkPricingSlabs) ? product.b2bBulkPricingSlabs : [],
      b2bGstInvoice: product.b2bGstInvoice !== undefined ? product.b2bGstInvoice : true,
      b2bPackagingType: product.b2bPackagingType || "standard",
      b2bLeadTimeDays: product.b2bLeadTimeDays || "",
      b2bCreditTerms: product.b2bCreditTerms || "prepaid",
      
      // Refurbished settings
      condition: product.condition || 'brand_new',
      refurbishedGrade: product.refurbishedGrade || '',
      refurbishedWarrantyDuration: product.refurbishedWarrantyDuration || 'none',
      deviceHealthBattery: product.deviceHealthBattery !== undefined ? product.deviceHealthBattery : 100,
      deviceHealthCosmetic: product.deviceHealthCosmetic || 'excellent',
      deviceHealthFunctional: product.deviceHealthFunctional || 'fully_working',
      isTested: product.isTested || false,
      isFullyFunctional: product.isFullyFunctional || false,
      isCertified: product.isCertified || false,
      refurbishedOriginalMrp: product.refurbishedOriginalMrp || '',
      refurbishedSellingPrice: product.refurbishedSellingPrice || '',
      accessoryCharger: product.accessoryCharger || false,
      accessoryBox: product.accessoryBox || false,
      accessoryOthers: product.accessoryOthers || false,
      cosmeticDamageNotes: product.cosmeticDamageNotes || '',
      productAgeMonths: product.productAgeMonths || '',
      purchaseYear: product.purchaseYear || '',
      repairHistory: product.repairHistory || '',
      refurbishedApprovalStatus: product.refurbishedApprovalStatus || 'approved'
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "brandId") {
      const isCustom = value === "__custom__";
      setFormData((prev) => ({
        ...prev,
        brandId: value,
        isCustomBrand: isCustom,
        customBrandName: isCustom ? prev.customBrandName : "",
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }

      setIsUploadingMedia(true);
      try {
        const res = await uploadVendorImage(file, "vendors/products");
        const uploaded = res?.data ?? res;
        setFormData((prev) => ({
          ...prev,
          image: uploaded?.url || "",
        }));
        toast.success("Main image uploaded");
      } catch {
        // errors handled by api.js
      } finally {
        setIsUploadingMedia(false);
      }
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} size should be less than 5MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploadingMedia(true);
    try {
      const res = await uploadVendorImages(validFiles, "vendors/products");
      const uploaded = res?.data ?? res;
      const uploadedUrls = Array.isArray(uploaded)
        ? uploaded.map((u) => u?.url).filter(Boolean)
        : [];

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls],
      }));
      toast.success(`${uploadedUrls.length} image(s) added to gallery`);
    } catch {
      // errors handled by api.js
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const removeGalleryImage = (index) => {
    setFormData({
      ...formData,
      images: formData.images.filter((_, i) => i !== index),
    });
  };

  const handleFaqChange = (index, field, value) => {
    setFormData((prev) => {
      const nextFaqs = [...(prev.faqs || [])];
      nextFaqs[index] = {
        ...(nextFaqs[index] || { question: "", answer: "" }),
        [field]: value,
      };
      return { ...prev, faqs: nextFaqs };
    });
  };

  const addFaq = () => {
    setFormData((prev) => ({
      ...prev,
      faqs: [...(prev.faqs || []), { question: "", answer: "" }],
    }));
  };

  const removeFaq = (index) => {
    setFormData((prev) => ({
      ...prev,
      faqs: (prev.faqs || []).filter((_, i) => i !== index),
    }));
  };

  const handleB2bBulkPricingSlabChange = (index, field, value) => {
    setFormData((prev) => {
      const nextSlabs = [...(prev.b2bBulkPricingSlabs || [])];
      nextSlabs[index] = {
        ...(nextSlabs[index] || { minQty: "", maxQty: "", pricePerUnit: "" }),
        [field]: value,
      };
      return { ...prev, b2bBulkPricingSlabs: nextSlabs };
    });
  };

  const addB2bBulkPricingSlab = () => {
    setFormData((prev) => ({
      ...prev,
      b2bBulkPricingSlabs: [...(prev.b2bBulkPricingSlabs || []), { minQty: "", maxQty: "", pricePerUnit: "" }],
    }));
  };

  const removeB2bBulkPricingSlab = (index) => {
    setFormData((prev) => ({
      ...prev,
      b2bBulkPricingSlabs: (prev.b2bBulkPricingSlabs || []).filter((_, i) => i !== index),
    }));
  };

  const updateVariantAxes = (axis, rawText) => {
    const parsed = parseVariantAxis(rawText);
    const nextSizes = axis === "sizes" ? parsed : (formData.variants?.sizes || []);
    const nextColors = axis === "colors" ? parsed : (formData.variants?.colors || []);
    const synced = syncVariantPricesWithAxes(
      formData.variants?.prices || {},
      formData.variants?.stockMap || {},
      formData.variants?.imageMap || {},
      nextSizes,
      nextColors,
      formData.variants?.attributes || [],
      formData.price
    );

    setFormData((prev) => ({
      ...prev,
      variants: {
        ...prev.variants,
        sizes: nextSizes,
        colors: nextColors,
        prices: synced.prices,
        stockMap: synced.stockMap,
        imageMap: synced.imageMap,
        defaultVariant: {
          size: String(prev.variants?.defaultVariant?.size || ""),
          color: String(prev.variants?.defaultVariant?.color || ""),
        },
      },
    }));
  };

  const updateVariantAttributes = (nextAttributes) => {
    const synced = syncVariantPricesWithAxes(
      formData.variants?.prices || {},
      formData.variants?.stockMap || {},
      formData.variants?.imageMap || {},
      formData.variants?.sizes || [],
      formData.variants?.colors || [],
      nextAttributes,
      formData.price
    );

    setFormData((prev) => ({
      ...prev,
      variants: {
        ...prev.variants,
        attributes: nextAttributes,
        prices: synced.prices,
        stockMap: synced.stockMap,
        imageMap: synced.imageMap,
      },
    }));
  };

  const addAttributeRow = () => {
    const current = Array.isArray(formData.variants?.attributes) ? formData.variants.attributes : [];
    updateVariantAttributes([...current, { name: "", values: [] }]);
  };

  const removeAttributeRow = (index) => {
    const current = Array.isArray(formData.variants?.attributes) ? formData.variants.attributes : [];
    updateVariantAttributes(current.filter((_, i) => i !== index));
  };

  const updateAttributeName = (index, name) => {
    const current = Array.isArray(formData.variants?.attributes) ? formData.variants.attributes : [];
    const next = [...current];
    next[index] = { ...(next[index] || {}), name: String(name || "") };
    updateVariantAttributes(next);
  };

  const updateAttributeValues = (index, rawValues) => {
    const current = Array.isArray(formData.variants?.attributes) ? formData.variants.attributes : [];
    const next = [...current];
    const values = parseVariantAxis(rawValues);
    next[index] = { ...(next[index] || {}), values };
    updateVariantAttributes(next);
  };

  const addVariantAxisValues = (axis, rawInput) => {
    const parsed = parseVariantAxis(rawInput);
    if (!parsed.length) return;
    const current = Array.isArray(formData?.variants?.[axis]) ? formData.variants[axis] : [];
    const merged = parseVariantAxis([...current, ...parsed].join(", "));
    updateVariantAxes(axis, merged.join(", "));
    setVariantAxisInput((prev) => ({ ...prev, [axis]: "" }));
  };

  const removeVariantAxisValue = (axis, valueToRemove) => {
    const current = Array.isArray(formData?.variants?.[axis]) ? formData.variants[axis] : [];
    const next = current.filter((value) => String(value) !== String(valueToRemove));
    updateVariantAxes(axis, next.join(", "));
  };

  const handleVariantAxisInputKeyDown = (axis, e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addVariantAxisValues(axis, variantAxisInput[axis]);
    }
  };

  const handleVariantImageUpload = async (variantKey, file) => {
    if (!file || !variantKey) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setIsUploadingMedia(true);
    try {
      const res = await uploadVendorImage(file, "vendors/products/variants");
      const uploaded = res?.data ?? res;
      const imageUrl = uploaded?.url || "";
      if (!imageUrl) return;
      setFormData((prev) => ({
        ...prev,
        variants: {
          ...prev.variants,
          imageMap: {
            ...(prev.variants?.imageMap || {}),
            [variantKey]: imageUrl,
          },
        },
      }));
      toast.success("Variant image uploaded");
    } catch {
      // api interceptor handles error toast
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!vendorId) {
      toast.error("Please log in to save products");
      return;
    }

    // Validate required fields based on channel
    const isB2c = isManagedVendor ? true : (formData.salesChannel === 'B2C' || formData.salesChannel === 'BOTH');
    const isB2b = isManagedVendor ? false : (formData.salesChannel === 'B2B' || formData.salesChannel === 'BOTH');

    if (!formData.name || !formData.stockQuantity || !formData.categoryId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (isB2c && !formData.price) {
      toast.error("Please enter retail price");
      return;
    }

    const finalCategoryId = formData.subcategoryId ?? formData.categoryId ?? null;

    // Default price to B2B price for pure B2B products to satisfy DB non-negative constraint
    const rawPrice = isB2c ? formData.price : (formData.b2bWholesalePrice || 0);
    const parsedPrice = parseFloat(rawPrice);
    const parsedOriginalPrice = formData.originalPrice
      ? parseFloat(formData.originalPrice)
      : null;
    const parsedStockQuantity = parseInt(formData.stockQuantity, 10);
    const parsedTotalAllowedQuantity = formData.totalAllowedQuantity
      ? parseInt(formData.totalAllowedQuantity, 10)
      : null;
    const parsedMinimumOrderQuantity = formData.minimumOrderQuantity
      ? parseInt(formData.minimumOrderQuantity, 10)
      : null;

    if (!Number.isFinite(parsedPrice) || !Number.isFinite(parsedStockQuantity)) {
      toast.error("Please enter valid numeric values");
      return;
    }

    const hasInvalidFaq = (formData.faqs || []).some((faq) => {
      const question = String(faq?.question || "").trim();
      const answer = String(faq?.answer || "").trim();
      return (question && !answer) || (!question && answer);
    });
    if (hasInvalidFaq) {
      toast.error("Each FAQ must have both question and answer");
      return;
    }

    const parsedB2bWholesalePrice = formData.b2bWholesalePrice
      ? parseFloat(formData.b2bWholesalePrice)
      : null;
    const parsedB2bMinOrderQty = formData.b2bMinOrderQty
      ? parseInt(formData.b2bMinOrderQty, 10)
      : null;

    if (isB2b) {
      if (
        formData.b2bWholesalePrice === "" ||
        formData.b2bMinOrderQty === ""
      ) {
        toast.error("Please fill in all required B2B wholesale fields");
        return;
      }
      if (
        isNaN(parsedB2bWholesalePrice) ||
        isNaN(parsedB2bMinOrderQty)
      ) {
        toast.error("Please enter valid numeric values for B2B fields");
        return;
      }
      
      if (isB2c && b2bSettings?.minWholesaleDiscount) {
        const requiredDiscount = b2bSettings.minWholesaleDiscount;
        const discountPercentage = ((parsedPrice - parsedB2bWholesalePrice) / parsedPrice) * 100;
        if (discountPercentage < requiredDiscount) {
          toast.error(`B2B Wholesale Price must be at least ${requiredDiscount}% lower than retail price.`);
          return;
        }
      }
    }

    const isCustomBrandActive = formData.isCustomBrand || formData.brandId === "__custom__";
    if (isCustomBrandActive && !formData.customBrandName?.trim()) {
      toast.error("Please enter a custom brand name");
      return;
    }

    const payload = {
      ...formData,
      price: parsedPrice,
      originalPrice: parsedOriginalPrice,
      stockQuantity: parsedStockQuantity,
      totalAllowedQuantity: parsedTotalAllowedQuantity,
      minimumOrderQuantity: parsedMinimumOrderQuantity,
      categoryId: finalCategoryId,
      subcategoryId: formData.subcategoryId ? formData.subcategoryId : null,
      brandId: isCustomBrandActive ? null : (formData.brandId || null),
      isCustomBrand: isCustomBrandActive,
      customBrandName: isCustomBrandActive ? formData.customBrandName.trim() : null,
      faqs: (formData.faqs || [])
        .map((faq) => ({
          question: String(faq?.question || "").trim(),
          answer: String(faq?.answer || "").trim(),
        }))
        .filter((faq) => faq.question && faq.answer),
      variants: buildVariantPayload(formData.variants || {}),
      b2bEnabled: isB2b,
      salesChannel: isManagedVendor ? 'B2C' : formData.salesChannel,
      b2bWholesalePrice: isManagedVendor ? null : parsedB2bWholesalePrice,
      b2bMinOrderQty: isManagedVendor ? 1 : parsedB2bMinOrderQty,
      b2bUnitsPerCarton: formData.b2bUnitsPerCarton ? parseInt(formData.b2bUnitsPerCarton, 10) : 1,
      b2bGstRate: formData.b2bGstRate || "18",
      b2bBulkPricingSlabs: isManagedVendor ? [] : (formData.b2bBulkPricingSlabs || []),
      b2bGstInvoice: formData.b2bGstInvoice !== undefined ? formData.b2bGstInvoice : true,
      b2bPackagingType: formData.b2bPackagingType || "standard",
      b2bLeadTimeDays: formData.b2bLeadTimeDays ? parseInt(formData.b2bLeadTimeDays, 10) : 1,
      b2bCreditTerms: formData.b2bCreditTerms || "prepaid",
    };

    let result;
    if (isEdit) {
      result = await editProduct(id, payload);
    } else {
      result = await addProduct(payload);
    }

    if (result) {
      navigate("/vendor/products/manage-products");
    }
  };

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to manage products</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-200 space-y-4">
        
        {/* Sales Channel Selector */}
        {isManagedVendor ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <FiInfo className="text-amber-600 text-lg mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Admin-Moderated Listing & Channel Placement
              </h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                As a managed vendor, you only need to enter the standard product information and pricing. The admin will review your listing and assign where it should be published (B2C Marketplace, B2B Wholesale, or Both).
              </p>
            </div>
          </div>
        ) : (
          <div className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-gray-800">
                Sales Channel
              </label>
              {!isB2BApproved && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <FiLock className="text-xs" /> B2B Locked (GST Approval Required)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {['B2C', 'B2B', 'BOTH'].map((channel) => {
                const isChannelLocked = channel !== 'B2C' && !isB2BApproved;
                return (
                  <button
                    key={channel}
                    type="button"
                    disabled={isChannelLocked}
                    onClick={() => {
                      if (isChannelLocked) {
                        toast.error('B2B selling requires GST verification and Admin approval.');
                        return;
                      }
                      setFormData(prev => ({ ...prev, salesChannel: channel }));
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border flex items-center gap-1.5 transition-all ${
                      isChannelLocked
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-75'
                        : formData.salesChannel === channel
                          ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {isChannelLocked && <FiLock className="text-xs" />}
                    {channel}
                  </button>
                );
              })}
            </div>
            {!isB2BApproved && (
              <div className="mt-3 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <FiInfo className="text-primary-600 text-lg shrink-0" />
                  <span className="font-medium">
                    Wholesale B2B selling is locked. Submit your GST certificate to unlock B2B sales.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/vendor/b2b-application')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md hover:shadow-lg transition-all shrink-0 active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  <span>Apply for B2B Selling</span>
                  <span className="text-sm font-black">&rarr;</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Basic Information */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-2">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Enter product name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Unit
              </label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                placeholder="e.g., Piece, Kilogram, Gram, Pair"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <CategorySelector
                value={formData.categoryId}
                subcategoryId={formData.subcategoryId}
                onChange={handleChange}
                isRefurbished={formData.condition && formData.condition !== 'brand_new'}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Brand
                </label>
                {formData.brandId !== "__custom__" && (
                  <button
                    type="button"
                    onClick={() =>
                      handleChange({ target: { name: "brandId", value: "__custom__" } })
                    }
                    className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 underline"
                  >
                    + Brand not listed?
                  </button>
                )}
              </div>
              <AnimatedSelect
                name="brandId"
                value={formData.brandId || ""}
                onChange={handleChange}
                placeholder="Select Brand"
                options={[
                  { value: "", label: "Select Brand" },
                  { value: "__custom__", label: "✨ + Add Custom Brand (Not Listed)" },
                  ...brands
                    .filter((brand) => brand.isActive !== false && brand.status !== 'rejected')
                    .map((brand) => ({ value: String(brand.id), label: brand.name })),
                ]}
              />

              {(formData.isCustomBrand || formData.brandId === "__custom__") && (
                <div className="mt-2.5 p-3 bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span>Custom Brand Name</span>
                      <span className="text-red-500">*</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-200/70 text-amber-900 rounded-md">
                        Requires Admin Approval
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        handleChange({ target: { name: "brandId", value: "" } })
                      }
                      className="text-[11px] text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    name="customBrandName"
                    value={formData.customBrandName}
                    onChange={handleChange}
                    placeholder="e.g. Apex Electronics, Organic Glow"
                    required
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium text-gray-900 placeholder:text-gray-400 shadow-sm"
                  />
                  <p className="text-[11px] text-amber-800 mt-1.5 flex items-start gap-1.5">
                    <FiInfo className="w-3.5 h-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
                    <span>This brand and product will be reviewed by the admin. Once approved, the product goes live and the brand will be saved in your dropdown permanently!</span>
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Enter product description..."
              />
            </div>
          </div>
        </div>

        {/* Pricing (Retail) - Visible for B2C and BOTH */}
        {(formData.salesChannel === 'B2C' || formData.salesChannel === 'BOTH') && (
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-2">Pricing</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Original Price (for discount)
                </label>
                <input
                  type="number"
                  name="originalPrice"
                  value={formData.originalPrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}

        {/* GST Configuration (Seller Controlled GST System) */}
        <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                GST Configuration
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Set GST rate manually according to your billing setup or use category default.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Seller Controlled GST
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                GST Source / Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    formData.gstMode === "category"
                      ? "border-primary-500 bg-primary-50/30 text-primary-900"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="gstMode"
                    value="category"
                    checked={formData.gstMode === "category"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gstMode: e.target.value }))}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-bold block">Use Category GST</span>
                    <span className="text-xs text-gray-500 block">
                      Inherits default GST rate configured for the selected product category.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    formData.gstMode === "custom"
                      ? "border-primary-500 bg-primary-50/30 text-primary-900"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="gstMode"
                    value="custom"
                    checked={formData.gstMode === "custom"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gstMode: e.target.value }))}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-bold block">Custom GST</span>
                    <span className="text-xs text-gray-500 block">
                      Specify custom GST rate according to seller's invoice/billing setup.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {formData.gstMode === "category" ? (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-600">Active Effective GST:</span>
                <span className="text-sm font-bold text-primary-700">
                  Using Category GST: {categories.find((c) => String(c.id || c._id) === String(formData.categoryId))?.gstRate ?? 18}%
                </span>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Custom GST Rate (%) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2 mb-2">
                  {[0, 5, 12, 18, 28].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, gstRate: rate, taxRate: rate }))}
                      className={`px-3 py-1 text-xs rounded-lg font-semibold border transition-colors ${
                        Number(formData.gstRate) === rate
                          ? "bg-primary-600 text-white border-primary-600"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  name="gstRate"
                  value={formData.gstRate}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setFormData((prev) => ({ ...prev, gstRate: val, taxRate: val }));
                  }}
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="e.g. 18"
                />
              </div>
            )}
          </div>
        </div>

        {/* Product Condition & Refurbished Settings */}
        <RefurbishedFieldsSection
          formData={formData}
          onChange={handleChange}
        />

        {/* B2B / Wholesale Settings - Visible for B2B and BOTH for non-managed vendors */}
        {!isManagedVendor && (formData.salesChannel === 'B2B' || formData.salesChannel === 'BOTH') && (
          <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                B2B / Wholesale Settings
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure wholesale pricing, bulk packaging, and volume discount tiers for business buyers.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Wholesale Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="b2bWholesalePrice"
                    value={formData.b2bWholesalePrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleChange(e);
                      // Auto-populate retail price for pure B2B channel
                      if (formData.salesChannel === 'B2B') {
                        setFormData(prev => ({ ...prev, price: val }));
                      }
                    }}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Minimum Order Quantity (MOQ) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="b2bMinOrderQty"
                    value={formData.b2bMinOrderQty}
                    onChange={handleChange}
                    required
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="e.g., 50"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Product Media */}
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-3 sm:p-4 border-2 border-primary-200 shadow-lg">
          <h2 className="text-base font-bold text-primary-800 mb-3 flex items-center gap-2">
            <FiUpload className="text-lg" />
            Product Media
          </h2>

          <div className="space-y-3">
            {/* Main Image */}
            <div className="bg-white rounded-lg p-3 border border-primary-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Main Image
              </h3>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Upload Main Image
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="main-image-upload"
                  />
                  <label
                    htmlFor="main-image-upload"
                    className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-primary-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors bg-white">
                    <FiUpload className="text-base text-primary-600" />
                    <span className="text-xs font-medium text-gray-700">
                      {formData.image
                        ? "Change Main Image"
                        : "Choose Main Image"}
                    </span>
                  </label>
                </div>
                {formData.image && (
                  <div className="mt-2 flex items-start gap-3">
                    <img
                      src={formData.image}
                      alt="Main Preview"
                      className="w-24 h-24 object-cover rounded-lg border-2 border-primary-300 shadow-md"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: "" })}
                      className="mt-1 px-3 py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors font-medium">
                      Remove Image
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Product Gallery */}
            <div className="bg-white rounded-lg p-3 border border-primary-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Product Gallery
              </h3>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Upload Gallery Images (Multiple)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryUpload}
                    className="hidden"
                    id="gallery-upload"
                  />
                  <label
                    htmlFor="gallery-upload"
                    className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-primary-300 rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors bg-white">
                    <FiUpload className="text-base text-primary-600" />
                    <span className="text-xs font-medium text-gray-700">
                      Choose Gallery Images
                    </span>
                  </label>
                </div>
                {formData.images && formData.images.length > 0 && (
                  <div className="mt-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {formData.images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={img}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border-2 border-primary-300 shadow-md"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(index)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title="Remove image">
                            <FiX className="text-xs" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.images.length} image(s) in gallery
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-2">Inventory</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Stock Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="stockQuantity"
                value={formData.stockQuantity}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Stock Status
              </label>
              <AnimatedSelect
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                options={[
                  { value: 'in_stock', label: 'In Stock' },
                  { value: 'low_stock', label: 'Low Stock' },
                  { value: 'out_of_stock', label: 'Out of Stock' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Product Variants */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-2">
            Product Variants
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Sizes
              </label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {(formData.variants?.sizes || []).map((size) => (
                    <span
                      key={size}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border border-blue-200"
                    >
                      {size}
                      <button
                        type="button"
                        onClick={() => removeVariantAxisValue("sizes", size)}
                        className="text-blue-700 hover:text-blue-900"
                      >
                        <FiX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={variantAxisInput.sizes}
                    onChange={(e) =>
                      setVariantAxisInput((prev) => ({ ...prev, sizes: e.target.value }))
                    }
                    onKeyDown={(e) => handleVariantAxisInputKeyDown("sizes", e)}
                    onBlur={() => addVariantAxisValues("sizes", variantAxisInput.sizes)}
                    placeholder="Type size and press Enter (e.g. S, M, L)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addVariantAxisValues("sizes", variantAxisInput.sizes)}
                    className="px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Colors
              </label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {(formData.variants?.colors || []).map((color) => (
                    <span
                      key={color}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs border border-emerald-200"
                    >
                      {color}
                      <button
                        type="button"
                        onClick={() => removeVariantAxisValue("colors", color)}
                        className="text-emerald-700 hover:text-emerald-900"
                      >
                        <FiX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={variantAxisInput.colors}
                    onChange={(e) =>
                      setVariantAxisInput((prev) => ({ ...prev, colors: e.target.value }))
                    }
                    onKeyDown={(e) => handleVariantAxisInputKeyDown("colors", e)}
                    onBlur={() => addVariantAxisValues("colors", variantAxisInput.colors)}
                    placeholder="Type color and press Enter (e.g. Red, Blue)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => addVariantAxisValues("colors", variantAxisInput.colors)}
                    className="px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Dynamic Attributes (optional)
                </label>
                <button
                  type="button"
                  onClick={addAttributeRow}
                  className="px-2 py-1 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Add Attribute
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mb-2">
                Example: RAM {"->"} 8GB, 16GB | Storage {"->"} 128GB, 256GB
              </p>
              <div className="space-y-2">
                {(formData.variants?.attributes || []).map((attribute, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={attribute?.name || ""}
                      onChange={(e) => updateAttributeName(index, e.target.value)}
                      placeholder="Attribute name"
                      className="md:col-span-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <input
                      type="text"
                      value={(attribute?.values || []).join(", ")}
                      onChange={(e) => updateAttributeValues(index, e.target.value)}
                      placeholder="Values (comma separated)"
                      className="md:col-span-8 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttributeRow(index)}
                      className="md:col-span-1 px-2 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                      aria-label="Remove attribute"
                    >
                      <FiX className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {variantCombinations.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Variant Prices
                </p>
                <div className="space-y-2">
                  {variantCombinations.map((combo) => (
                    <div key={combo.key} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <p className="text-xs text-gray-700 md:col-span-1">
                        {combo.label || ((combo.size || "Any Size") + " / " + (combo.color || "Any Color"))}
                      </p>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.variants?.prices?.[combo.key] ?? ""}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            variants: {
                              ...prev.variants,
                              prices: {
                                ...(prev.variants?.prices || {}),
                                [combo.key]: nextValue === "" ? "" : Number(nextValue),
                              },
                            },
                          }));
                        }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                        placeholder="Use base price"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.variants?.stockMap?.[combo.key] ?? ""}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            variants: {
                              ...prev.variants,
                              stockMap: {
                                ...(prev.variants?.stockMap || {}),
                                [combo.key]: nextValue === "" ? "" : Number(nextValue),
                              },
                            },
                          }));
                        }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                        placeholder="Variant stock"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          id={`variant-image-${combo.key}`}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVariantImageUpload(combo.key, file);
                            e.target.value = "";
                          }}
                        />
                        <label
                          htmlFor={`variant-image-${combo.key}`}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs cursor-pointer hover:bg-gray-100"
                        >
                          Upload
                        </label>
                        {formData.variants?.imageMap?.[combo.key] && (
                          <img
                            src={formData.variants.imageMap[combo.key]}
                            alt="Variant"
                            className="w-8 h-8 rounded object-cover border border-gray-300"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <select
                    value={formData.variants?.defaultVariant?.size || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        variants: {
                          ...prev.variants,
                          defaultVariant: {
                            ...(prev.variants?.defaultVariant || {}),
                            size: e.target.value,
                          },
                        },
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                  >
                    <option value="">Default size (optional)</option>
                    {(formData.variants?.sizes || []).map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <select
                    value={formData.variants?.defaultVariant?.color || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        variants: {
                          ...prev.variants,
                          defaultVariant: {
                            ...(prev.variants?.defaultVariant || {}),
                            color: e.target.value,
                          },
                        },
                      }))
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                  >
                    <option value="">Default color (optional)</option>
                    {(formData.variants?.colors || []).map((color) => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-2">Tags</h2>
          <div>
            <input
              type="text"
              value={(formData.tags || []).join(", ")}
              onChange={(e) => {
                const tags = e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter((t) => t);
                setFormData({ ...formData, tags });
              }}
              placeholder="tag1, tag2, tag3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Separate tags with commas
            </p>
          </div>
        </div>

        {/* Options */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-2">
            Product Options
          </h2>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="flashSale"
                checked={formData.flashSale}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-xs font-semibold text-gray-700">
                Flash Sale
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isNewArrival"
                checked={formData.isNewArrival}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-xs font-semibold text-gray-700">
                New Arrival
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isFeatured"
                checked={formData.isFeatured}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-xs font-semibold text-gray-700">
                Featured Product
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isVisible"
                checked={formData.isVisible}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-xs font-semibold text-gray-700">
                Visible to Customers
              </span>
            </label>
          </div>
        </div>

        {/* Product FAQs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-gray-800">Product FAQs</h2>
            <button
              type="button"
              onClick={addFaq}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              + Add FAQ
            </button>
          </div>
          <div className="space-y-3">
            {(formData.faqs || []).map((faq, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">FAQ #{index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={faq.question || ""}
                  onChange={(e) => handleFaqChange(index, "question", e.target.value)}
                  placeholder="Question"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                />
                <textarea
                  value={faq.answer || ""}
                  onChange={(e) => handleFaqChange(index, "answer", e.target.value)}
                  rows={2}
                  placeholder="Answer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                />
              </div>
            ))}
            {(formData.faqs || []).length === 0 && (
              <p className="text-xs text-gray-500">No FAQs added yet.</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate("/vendor/products/manage-products")}
            className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || isUploadingMedia}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 gradient-green text-white rounded-xl hover:shadow-glow-green transition-all font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed">
            <FiSave />
            {isUploadingMedia ? "Uploading Media..." : isSaving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default ProductForm;

