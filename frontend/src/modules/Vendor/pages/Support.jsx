import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHelpCircle,
  FiPhone,
  FiMail,
  FiUser,
  FiMessageCircle,
  FiArrowLeft,
  FiClock,
  FiMapPin,
  FiChevronDown,
  FiSend,
  FiPackage,
  FiDollarSign,
  FiLayers,
  FiShield,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import { useNavigate, Link } from "react-router-dom";
import PageTransition from "../../../shared/components/PageTransition";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";

const CONTACT_INFO = {
  name: "Mohmmad Jain kankudti",
  email: "peoplesleagueofelectronics@gmail.com",
  phone: "9513164326",
  address: "SHOP NO 25, R.S NO. 1045/3, Ujwal Nagar Main Road, 2nd Cross Left Side, Belagavi, Karnataka - 590010",
  hours: "Monday – Saturday: 9:00 AM – 7:00 PM IST",
};

const SELLER_FAQS = [
  {
    q: "How do I start selling on PLE as a new vendor?",
    a: "You can click on 'Register as Vendor', provide your business details, GSTIN, Bank details, and store name. Once our onboarding team reviews your documents, your account will be activated within 24–48 hours.",
  },
  {
    q: "When and how are vendor payouts and settlements processed?",
    a: "Payout settlements are automatically calculated following order delivery confirmation and return-window clearance. Payouts are transferred directly into your registered bank account via NEFT/RTGS.",
  },
  {
    q: "How do I upload and manage bulk product listings?",
    a: "Log in to your Vendor Dashboard, navigate to 'Products' > 'Bulk Upload' to download our Excel/CSV template, enter your SKU details and prices, and upload them for instant catalog processing.",
  },
  {
    q: "How do I respond to customer return requests?",
    a: "Return requests are visible in the 'Return Requests' tab in your vendor dashboard. You can inspect customer reasons, verify images, and approve replacement or refund processing.",
  },
  {
    q: "How do B2B Direct RFQs and Quotations work for sellers?",
    a: "Verified sellers receive custom B2B buyer inquiries in their 'B2B Enquiries' and 'Direct RFQs' panel, where you can prepare tailored bulk quotations with tiered volume discounts.",
  },
];

const SELLER_HELP_CHANNELS = [
  {
    icon: FiDollarSign,
    title: "Payouts & Settlements",
    desc: "Bank account updates, payout cycle, commission inquiries",
  },
  {
    icon: FiLayers,
    title: "Catalog & Product Listings",
    desc: "Bulk uploads, category approval, image guidelines",
  },
  {
    icon: FiPackage,
    title: "Orders & Warehouse Pickup",
    desc: "Courier dispatch, airway bills (AWB), pickup delays",
  },
  {
    icon: FiShield,
    title: "GST, Tax & Compliance",
    desc: "TDS/TCS certificates, GST invoice corrections",
  },
];

const VendorSupport = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    storeName: "",
    email: "",
    phone: "",
    category: "Payouts & Settlements",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Creates a real support ticket linked to your seller account
      await api.post("/support/contact", { ...formData, subject: formData.category });
      setSubmitted(true);
      toast.success("Support ticket created. Our seller desk will reach out promptly!");
      setFormData({ name: "", storeName: "", email: "", phone: "", category: "Payouts & Settlements", message: "" });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Could not send your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate("/vendor/login");
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600 border border-gray-200"
              >
                <FiArrowLeft className="text-lg" />
              </button>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                  Seller Hub
                </span>
                <h1 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-1.5 mt-0.5">
                  <FiHelpCircle className="text-purple-600" /> Vendor Support & Helpdesk
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/vendor/privacy-policy"
                className="hidden sm:inline-block text-xs font-bold text-gray-600 hover:text-purple-700 px-3 py-2"
              >
                Vendor Privacy
              </Link>
              <Link
                to="/vendor/login"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                Vendor Login
              </Link>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="max-w-5xl mx-auto px-4 py-8 pb-24">
          {/* Spotlight Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden"
          >
            <div className="relative z-10 space-y-6">
              <div>
                <span className="inline-block px-3 py-1 bg-white/10 text-purple-200 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
                  Dedicated Vendor Relationship Manager
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
                  <FiUser className="text-purple-300" /> {CONTACT_INFO.name}
                </h2>
                <p className="text-sm text-purple-100 mt-1 max-w-xl">
                  Head of Seller Support & Operations • Peoples League Of Electronics
                </p>
              </div>

              {/* Direct Quick Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <a
                  href={`tel:${CONTACT_INFO.phone}`}
                  className="flex items-center justify-center gap-2.5 px-4 py-3 bg-white text-purple-900 font-bold rounded-2xl text-sm shadow-md hover:bg-purple-50 hover:scale-[1.02] transition-all"
                >
                  <FiPhone className="text-base text-purple-700" />
                  <span>Call: {CONTACT_INFO.phone}</span>
                </a>

                <a
                  href={`mailto:${CONTACT_INFO.email}`}
                  className="flex items-center justify-center gap-2.5 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-sm border border-white/20 backdrop-blur-sm hover:scale-[1.02] transition-all truncate"
                >
                  <FiMail className="text-base shrink-0" />
                  <span className="truncate">Email Seller Desk</span>
                </a>

                <a
                  href={`https://wa.me/91${CONTACT_INFO.phone}?text=Hello%20PLE%20Vendor%20Support,%20I%20need%20help%20with%20my%20seller%20account`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm shadow-md hover:scale-[1.02] transition-all"
                >
                  <FiMessageCircle className="text-base" />
                  <span>WhatsApp Support</span>
                </a>
              </div>

              {/* Meta information */}
              <div className="border-t border-white/10 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-purple-200">
                <div className="flex items-center gap-2">
                  <FiMail className="text-sm text-purple-300 shrink-0" />
                  <span className="truncate">{CONTACT_INFO.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiClock className="text-sm text-purple-300 shrink-0" />
                  <span>{CONTACT_INFO.hours}</span>
                </div>
                <div className="flex items-start gap-2 sm:col-span-2">
                  <FiMapPin className="text-sm text-purple-300 shrink-0 mt-0.5" />
                  <span>{CONTACT_INFO.address}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Channels */}
          <div className="mb-8">
            <h3 className="text-base font-bold text-gray-900 mb-3">Seller Assistance Channels</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SELLER_HELP_CHANNELS.map((ch, i) => {
                const Icon = ch.icon;
                return (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex flex-col justify-between"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
                      <Icon className="text-lg" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{ch.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{ch.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Inquiry & FAQs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Submit Seller Inquiry</h3>
              <p className="text-xs text-gray-500 mb-5">
                Need help with store onboarding, catalogue approval, or payout verification? Send our operations team a direct message.
              </p>

              {submitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                  <FiCheckCircle className="text-3xl text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900 text-base">Inquiry Submitted!</h4>
                  <p className="text-xs text-emerald-700">
                    Our vendor relations team has received your ticket and will follow up via email or phone.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Contact Person Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        placeholder="Your full name"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Store / Business Name</label>
                      <input
                        type="text"
                        name="storeName"
                        value={formData.storeName}
                        onChange={handleInputChange}
                        placeholder="e.g. Acme Electronics"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Registered Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="vendor@company.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="10-digit number"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Category of Inquiry *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="Payouts & Settlements">Payouts & Settlements</option>
                      <option value="Catalog & Product Approvals">Catalog & Product Approvals</option>
                      <option value="Onboarding & Document Verification">Onboarding & Document Verification</option>
                      <option value="Order Dispatch & Pickup Issues">Order Dispatch & Pickup Issues</option>
                      <option value="B2B Quotes & Sourcing">B2B Quotes & Sourcing</option>
                      <option value="General Support">General Support</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Details & Message *</label>
                    <textarea
                      name="message"
                      rows={4}
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      placeholder="Please provide full details (Order IDs, Product IDs, settlement references)..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50/50 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FiSend className="text-base" />
                    <span>{isSubmitting ? "Sending..." : "Submit to Seller Support"}</span>
                  </button>
                </form>
              )}
            </div>

            {/* FAQs */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Seller FAQs</h3>
                <p className="text-xs text-gray-500 mb-4">Answers for marketplace sellers</p>

                <div className="space-y-2">
                  {SELLER_FAQS.map((item, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <div key={index} className="border border-gray-200 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenFaq(isOpen ? null : index)}
                          className="w-full px-4 py-3 text-left font-bold text-xs text-gray-900 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors"
                        >
                          <span>{item.q}</span>
                          <FiChevronDown
                            className={`text-gray-400 shrink-0 transition-transform duration-200 ${
                              isOpen ? "rotate-180 text-purple-700" : ""
                            }`}
                          />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-4 pb-3 pt-1 text-xs text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/50"
                            >
                              {item.a}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Portal Links */}
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-xs text-gray-700 space-y-3">
                <div className="flex items-center gap-2 text-purple-900 font-bold">
                  <FiAlertCircle className="text-purple-700 text-base" />
                  <span>Important Seller Resources</span>
                </div>
                <p className="text-xs text-purple-900/80">
                  Access legal terms and guidelines governing the PLE marketplace:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    to="/vendor/privacy-policy"
                    className="px-3 py-1.5 bg-white border border-purple-200 text-purple-800 rounded-lg font-bold hover:bg-purple-100 transition-colors"
                  >
                    Vendor Privacy Policy
                  </Link>
                  <Link
                    to="/vendor/register"
                    className="px-3 py-1.5 bg-white border border-purple-200 text-purple-800 rounded-lg font-bold hover:bg-purple-100 transition-colors"
                  >
                    Apply as Vendor
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
};

export default VendorSupport;
