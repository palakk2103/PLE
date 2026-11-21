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
  FiCreditCard,
  FiRefreshCw,
  FiShield,
  FiCheckCircle,
} from "react-icons/fi";
import { useNavigate, Link } from "react-router-dom";
import MobileLayout from "../components/Layout/MobileLayout";
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

const FAQ_ITEMS = [
  {
    q: "How can I track my order status?",
    a: "You can track your order at any time by navigating to 'My Orders' in your account profile, or by using the 'Track Order' option with your order ID.",
  },
  {
    q: "What is the return and replacement policy?",
    a: "Products eligible for return or replacement can be requested within 7 days of delivery through the 'My Returns' section in your account. Items must be in original condition with intact packaging.",
  },
  {
    q: "How do I place a bulk B2B procurement order?",
    a: "Businesses can register as a B2B buyer on our platform to get GST invoices, bulk volume discounts, and custom Request for Quotations (RFQ).",
  },
  {
    q: "What payment methods are supported?",
    a: "We support all major payment methods including UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, and Business Wallet balances.",
  },
  {
    q: "How do I claim warranty for electronic products?",
    a: "All items sold on PLE come with standard manufacturer warranty or PLE certified warranty. You can initiate a warranty claim from your order detail page or contact our support team.",
  },
];

const QUICK_TOPICS = [
  {
    icon: FiPackage,
    title: "Orders & Shipping",
    desc: "Tracking, delays, delivery updates",
  },
  {
    icon: FiRefreshCw,
    title: "Returns & Refunds",
    desc: "Return requests, replacement status",
  },
  {
    icon: FiCreditCard,
    title: "Payments & Invoices",
    desc: "GST invoices, payment issues, wallet",
  },
  {
    icon: FiShield,
    title: "Warranty & Repairs",
    desc: "Brand warranty, repairs, service centers",
  },
];

const UserSupport = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
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
      // Creates a real support ticket (works signed-in or as a visitor)
      await api.post("/support/contact", formData);
      setSubmitted(true);
      toast.success("Your message has been received. Our support team will contact you shortly!");
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Could not send your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24 min-h-screen">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate("/home");
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
            >
              <FiArrowLeft className="text-xl text-gray-700" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                <FiHelpCircle className="text-[#7B0A0A]" /> Help & Support
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                We're here to help you with any questions or issues
              </p>
            </div>
          </div>

          {/* Contact Representative Spotlight Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#7B0A0A] via-[#910C0C] to-[#550505] text-white rounded-3xl p-6 md:p-8 shadow-xl mb-8 relative overflow-hidden"
          >
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-6">
              <div>
                <span className="inline-block px-3 py-1 bg-white/15 text-white rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm mb-3">
                  Direct Support Representative
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
                  <FiUser className="text-white/80" /> {CONTACT_INFO.name}
                </h2>
                <p className="text-sm text-red-100 mt-1">
                  Customer & Grievance Support Head • Peoples League Of Electronics
                </p>
              </div>

              {/* Direct Reach Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <a
                  href={`tel:${CONTACT_INFO.phone}`}
                  className="flex items-center justify-center gap-2.5 px-4 py-3 bg-white text-[#7B0A0A] font-bold rounded-2xl text-sm shadow-md hover:bg-red-50 hover:scale-[1.02] transition-all"
                >
                  <FiPhone className="text-base" />
                  <span>Call: {CONTACT_INFO.phone}</span>
                </a>

                <a
                  href={`mailto:${CONTACT_INFO.email}`}
                  className="flex items-center justify-center gap-2.5 px-4 py-3 bg-white/15 hover:bg-white/25 text-white font-bold rounded-2xl text-sm border border-white/20 backdrop-blur-sm hover:scale-[1.02] transition-all truncate"
                >
                  <FiMail className="text-base shrink-0" />
                  <span className="truncate">Email Us</span>
                </a>

                <a
                  href={`https://wa.me/91${CONTACT_INFO.phone}?text=Hello%20PLE%20Support,%20I%20need%20help%20with%20`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm shadow-md hover:scale-[1.02] transition-all"
                >
                  <FiMessageCircle className="text-base" />
                  <span>WhatsApp Chat</span>
                </a>
              </div>

              {/* Info Details Footer */}
              <div className="border-t border-white/15 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-red-100">
                <div className="flex items-center gap-2">
                  <FiMail className="text-sm text-white/70 shrink-0" />
                  <span className="truncate">{CONTACT_INFO.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiClock className="text-sm text-white/70 shrink-0" />
                  <span>{CONTACT_INFO.hours}</span>
                </div>
                <div className="flex items-start gap-2 sm:col-span-2">
                  <FiMapPin className="text-sm text-white/70 shrink-0 mt-0.5" />
                  <span>{CONTACT_INFO.address}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Help Topics */}
          <div className="mb-8">
            <h3 className="text-base font-bold text-gray-800 mb-3 px-1">Quick Help Topics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {QUICK_TOPICS.map((topic, i) => {
                const Icon = topic.icon;
                return (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col justify-between"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-[#7B0A0A] flex items-center justify-center mb-3">
                      <Icon className="text-lg" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{topic.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{topic.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Form & FAQs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-1">Send Us a Message</h3>
              <p className="text-xs text-gray-500 mb-5">
                Have a specific question or complaint? Fill out the form below and we will respond via email or phone.
              </p>

              {submitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                  <FiCheckCircle className="text-3xl text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900 text-base">Message Sent Successfully!</h4>
                  <p className="text-xs text-emerald-700">
                    Thank you for reaching out. A representative from our team will review your query and contact you within 24 hours.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="you@example.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number (Optional)</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="10-digit number"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Subject / Order ID</label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="e.g. Order #12345 inquiry"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Your Message / Query *</label>
                    <textarea
                      name="message"
                      rows={4}
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      placeholder="Describe your issue or question in detail..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50/50 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-[#7B0A0A] hover:bg-[#910C0C] text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FiSend className="text-base" />
                    <span>{isSubmitting ? "Sending..." : "Submit Inquiry"}</span>
                  </button>
                </form>
              )}
            </div>

            {/* FAQs */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Frequently Asked Questions</h3>
                <p className="text-xs text-gray-500 mb-4">Quick answers to common queries</p>

                <div className="space-y-2">
                  {FAQ_ITEMS.map((item, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <div key={index} className="border border-gray-150 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenFaq(isOpen ? null : index)}
                          className="w-full px-4 py-3 text-left font-bold text-xs text-gray-800 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors"
                        >
                          <span>{item.q}</span>
                          <FiChevronDown
                            className={`text-gray-400 shrink-0 transition-transform duration-200 ${
                              isOpen ? "rotate-180 text-[#7B0A0A]" : ""
                            }`}
                          />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-4 pb-3 pt-1 text-xs text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/40"
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

              {/* Policy Links Card */}
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5 text-xs text-gray-600 space-y-2">
                <h4 className="font-bold text-[#7B0A0A] text-sm">Helpful Legal Links</h4>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    to="/privacy-policy"
                    className="px-2.5 py-1 bg-white border border-red-200 rounded-lg text-[#7B0A0A] hover:bg-red-50 font-semibold"
                  >
                    Privacy Policy
                  </Link>
                  <Link
                    to="/terms-and-conditions"
                    className="px-2.5 py-1 bg-white border border-red-200 rounded-lg text-[#7B0A0A] hover:bg-red-50 font-semibold"
                  >
                    Terms & Conditions
                  </Link>
                  <Link
                    to="/return-policy"
                    className="px-2.5 py-1 bg-white border border-red-200 rounded-lg text-[#7B0A0A] hover:bg-red-50 font-semibold"
                  >
                    Return Policy
                  </Link>
                  <Link
                    to="/warranty-policy"
                    className="px-2.5 py-1 bg-white border border-red-200 rounded-lg text-[#7B0A0A] hover:bg-red-50 font-semibold"
                  >
                    Warranty Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default UserSupport;
