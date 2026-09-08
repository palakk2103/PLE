import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import {
  FiMapPin,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiCheck,
  FiX,
  FiArrowLeft,
  FiChevronRight,
  FiLogIn,
  FiNavigation,
  FiLoader,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAddressStore } from "../../../../shared/store/addressStore";
import { useAuthStore } from "../../../../shared/store/authStore";
import { useLocationStore } from "../../../../shared/store/locationStore";

const AddressBottomSheet = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const {
    addresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    fetchAddresses,
    isLoading,
  } = useAddressStore();

  const {
    currentLocation,
    isDetecting,
    detectCurrentLocation,
  } = useLocationStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    if (isOpen) {
      fetchAddresses().catch(() => null);
    }
  }, [isOpen, fetchAddresses]);

  // Handle Detect Current Location Click (Listing view)
  const handleUseCurrentLocation = async () => {
    try {
      const loc = await detectCurrentLocation({ enableHighAccuracy: true });
      const display = [loc.area, loc.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      toast.success(`Location detected: ${display || 'Current Location'}`);
      onClose();
    } catch (error) {
      toast.error(error?.message || "Could not fetch current location.");
    }
  };

  // Handle Auto-fill in Form view
  const handleAutofillCurrentLocation = async () => {
    try {
      const loc = await detectCurrentLocation({ enableHighAccuracy: true });
      if (loc.address) setValue("address", loc.address, { shouldValidate: true });
      if (loc.city) setValue("city", loc.city, { shouldValidate: true });
      if (loc.state) setValue("state", loc.state, { shouldValidate: true });
      if (loc.zipCode) setValue("zipCode", loc.zipCode, { shouldValidate: true });
      if (loc.country) setValue("country", loc.country, { shouldValidate: true });
      if (!editingAddress) {
        setValue("name", loc.area || "Home", { shouldValidate: true });
      }
      toast.success("Exact address auto-filled from GPS!");
    } catch (error) {
      toast.error(error?.message || "Failed to fetch GPS coordinates.");
    }
  };

  // Handle Form Submit
  const onSubmit = async (data) => {
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id || editingAddress._id, data);
        toast.success("Address updated successfully!");
      } else {
        await addAddress(data);
        toast.success("Address added successfully!");
      }
      resetForm();
    } catch (error) {
      toast.error(error?.message || "Failed to save address");
    }
  };

  const handleEdit = (e, address) => {
    e.stopPropagation();
    setEditingAddress(address);
    reset(address);
    setIsFormOpen(true);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this address?")) {
      try {
        await deleteAddress(id);
        toast.success("Address deleted successfully!");
      } catch (error) {
        toast.error(error?.message || "Failed to delete address");
      }
    }
  };

  const resetForm = () => {
    reset({
      name: "",
      fullName: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
    });
    setIsFormOpen(false);
    setEditingAddress(null);
  };

  const selectAddress = async (addressId) => {
    try {
      await setDefaultAddress(addressId);
      toast.success("Address updated successfully!");
      onClose();
    } catch (error) {
      toast.error(error?.message || "Failed to update location");
    }
  };

  return typeof document !== "undefined"
    ? createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black z-[10008]"
              />

              {/* Bottom Sheet Container */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 250 }}
                className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#121212] rounded-t-[2.5rem] z-[10009] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden md:max-w-md md:mx-auto md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-full"
              >
                {/* Grab Handle */}
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-neutral-800 rounded-full mx-auto my-3 shrink-0" />

                {/* Content area */}
                <div className="flex-1 overflow-y-auto px-6 pb-8">
                  {isFormOpen ? (
                    /* Inline Add/Edit Address Form */
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
                        >
                          <FiArrowLeft className="text-xl" />
                        </button>
                        <h3 className="text-lg font-extrabold text-gray-800 dark:text-gray-100">
                          {editingAddress ? "Edit Address" : "Add Address"}
                        </h3>
                      </div>

                      {/* GPS Autofill Button */}
                      <button
                        type="button"
                        onClick={handleAutofillCurrentLocation}
                        disabled={isDetecting}
                        className="w-full mb-4 py-2.5 px-4 bg-rose-50 dark:bg-rose-950/40 border border-dashed border-[#AE020B]/40 hover:border-[#AE020B] rounded-xl flex items-center justify-center gap-2 text-[#AE020B] font-bold text-xs transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
                      >
                        {isDetecting ? (
                          <>
                            <FiLoader className="animate-spin text-base" />
                            <span>Detecting exact GPS address...</span>
                          </>
                        ) : (
                          <>
                            <FiNavigation className="text-base text-[#AE020B]" />
                            <span>Use Current Location (Auto-fill fields)</span>
                          </>
                        )}
                      </button>

                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            Address Label (e.g. Home, Work)
                          </label>
                          <input
                            type="text"
                            placeholder="Home"
                            {...register("name", { required: "Label is required" })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {errors.name && (
                            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            placeholder="Your full name"
                            {...register("fullName", { required: "Full name is required" })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {errors.fullName && (
                            <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            placeholder="10-digit number"
                            {...register("phone", {
                              required: "Phone number is required",
                              pattern: {
                                value: /^[6-9]\d{9}$/,
                                message: "Enter a valid 10-digit phone number",
                              },
                            })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {errors.phone && (
                            <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            Street Address
                          </label>
                          <input
                            type="text"
                            placeholder="Flat, House no., Area, Street"
                            {...register("address", { required: "Address is required" })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          {errors.address && (
                            <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              placeholder="City"
                              {...register("city", { required: "City is required" })}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            {errors.city && (
                              <p className="mt-1 text-xs text-red-500">{errors.city.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                              State
                            </label>
                            <input
                              type="text"
                              placeholder="State"
                              {...register("state", { required: "State is required" })}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            {errors.state && (
                              <p className="mt-1 text-xs text-red-500">{errors.state.message}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                              Zip Code
                            </label>
                            <input
                              type="text"
                              placeholder="Zip code"
                              {...register("zipCode", { required: "Zip code is required" })}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            {errors.zipCode && (
                              <p className="mt-1 text-xs text-red-500">{errors.zipCode.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                              Country
                            </label>
                            <input
                              type="text"
                              placeholder="Country"
                              defaultValue="India"
                              {...register("country", { required: "Country is required" })}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            {errors.country && (
                              <p className="mt-1 text-xs text-red-500">{errors.country.message}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 py-3.5 bg-gradient-to-r from-[#AE020B] to-[#7B0A0A] text-white font-extrabold rounded-xl shadow-md transition-all disabled:opacity-50"
                          >
                            {isLoading ? "Saving..." : editingAddress ? "Update" : "Save Address"}
                          </button>
                          <button
                            type="button"
                            onClick={resetForm}
                            className="px-6 py-3.5 bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    /* Address Listing View */
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                          <FiMapPin className="text-[#AE020B]" />
                          <span>Select Delivery Location</span>
                        </h3>
                        <button
                          onClick={() => setIsFormOpen(true)}
                          className="flex items-center gap-1 text-[#AE020B] font-extrabold text-sm hover:underline"
                        >
                          <FiPlus />
                          <span>Add New</span>
                        </button>
                      </div>

                      {/* Prominent Use Current Location Card */}
                      <div
                        onClick={handleUseCurrentLocation}
                        className="mb-4 p-3.5 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:bg-rose-500/15 transition-all group active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#AE020B] text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                            {isDetecting ? (
                              <FiLoader className="animate-spin text-lg" />
                            ) : (
                              <FiNavigation className="text-lg" />
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-gray-900 dark:text-gray-100 leading-none">
                                {isDetecting ? "Detecting GPS Location..." : "Use Current Location"}
                              </span>
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                              {currentLocation?.fullAddress || currentLocation?.formattedAddress || "Enable GPS for accurate delivery detection"}
                            </p>
                          </div>
                        </div>
                        <FiChevronRight className="text-gray-400 group-hover:text-[#AE020B] transition-colors shrink-0" />
                      </div>

                      <div className="relative flex py-1 items-center mb-3">
                        <div className="flex-grow border-t border-gray-200 dark:border-neutral-800"></div>
                        <span className="flex-shrink mx-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Or Saved Addresses
                        </span>
                        <div className="flex-grow border-t border-gray-200 dark:border-neutral-800"></div>
                      </div>

                      {isLoading && addresses.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">Loading addresses...</div>
                      ) : addresses.length === 0 ? (
                        <div className="py-8 text-center flex flex-col items-center">
                          <FiMapPin className="text-5xl text-gray-300 dark:text-neutral-700 mb-2" />
                          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4">
                            No addresses saved yet.
                          </p>
                          <button
                            onClick={() => setIsFormOpen(true)}
                            className="px-6 py-2.5 bg-[#AE020B] text-white text-xs font-bold rounded-xl shadow-sm"
                          >
                            Add Your First Address
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 mt-4">
                          {addresses.map((address, idx) => (
                            <div
                              key={address.id || address._id || idx}
                              onClick={() => selectAddress(address.id || address._id)}
                              className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                address.isDefault
                                  ? "bg-rose-50/50 dark:bg-rose-950/10 border-[#AE020B]/30"
                                  : "bg-gray-50 dark:bg-neutral-900 border-gray-100 dark:border-neutral-800 hover:bg-gray-100/50 dark:hover:bg-neutral-800/50"
                              }`}
                            >
                              <div className="mt-1 flex-shrink-0">
                                {address.isDefault ? (
                                  <div className="w-5 h-5 rounded-full bg-[#AE020B] flex items-center justify-center text-white">
                                    <FiCheck className="text-xs" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-neutral-700" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-extrabold text-sm text-gray-800 dark:text-gray-200 capitalize">
                                    {address.name}
                                  </h4>
                                  {address.isDefault && (
                                    <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/50 text-[#AE020B] rounded text-[10px] font-extrabold uppercase tracking-wider">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate">
                                  {address.fullName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                  {address.address}, {address.city}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1 font-mono">
                                  {address.phone}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
                                <button
                                  onClick={(e) => handleEdit(e, address)}
                                  className="p-2 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg text-gray-600 dark:text-gray-400 transition-colors"
                                  title="Edit"
                                >
                                  <FiEdit className="text-xs" />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(e, address.id || address._id)}
                                  className="p-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"
                                  title="Delete"
                                >
                                  <FiTrash2 className="text-xs" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;
};

export default AddressBottomSheet;
