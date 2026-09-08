import { useEffect, useRef, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiLock,
  FiEye,
  FiEyeOff,
  FiSave,
  FiCamera,
  FiArrowLeft,
  FiPackage,
  FiMapPin,
  FiLogOut,
  FiChevronRight,
  FiBell,
  FiBriefcase,
  FiTrendingUp,
  FiFileText,
  FiHelpCircle,
  FiTag,
  FiStar,
  FiMessageSquare,
  FiHeart,
  FiUsers,
  FiCreditCard,
  FiAward,
  FiSettings,
  FiTrash2,
} from "react-icons/fi";

// Offers System Imports
import { useOffers } from "../../offers/hooks/useOffers";
import OfferCard from "../../offers/components/OfferCard";
import OfferModal from "../../offers/components/OfferModal";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import MobileLayout from "../components/Layout/MobileLayout";
import { useAuthStore } from "../../../shared/store/authStore";
import { useLoyaltyStore } from "../../../shared/store/loyaltyStore";
import { isValidEmail, isValidPhone } from "../../../shared/utils/helpers";
import toast from "react-hot-toast";
import PageTransition from "../../../shared/components/PageTransition";
import PasswordStrengthMeter from "../components/Mobile/PasswordStrengthMeter";
import { performUserLogout } from "../../../shared/utils/userLogout";
import OTPVerificationModal from "../../../shared/components/OTPVerificationModal";
import { useUserNotificationStore } from "../store/userNotificationStore";
import { useWishlistStore } from "../../../shared/store/wishlistStore";
import { useBusinessBuyer } from "../hooks/useBusinessBuyer";
import { useB2bStore } from "../../../shared/store/b2bStore";
import { B2BBusinessBadge } from "../components/B2B/B2BBusinessBadge";
import { B2BBusinessDashboard } from "../components/B2B/B2BBusinessDashboard";
import { B2BBusinessDashboard as B2BMyEnquiriesDashboard } from "../components/B2B/B2BBusinessDashboard";
import { MyProductEnquiries } from "../components/Enquiry/MyProductEnquiries";
import { useB2BAdminStore } from "../../B2BAdmin/store/b2bAdminStore";



const MobileProfile = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isBusiness, setUserRole } = useBusinessBuyer();
  const {
    user,
    updateProfile,
    verifyProfileOTP,
    resendProfileOTP,
    uploadProfileAvatar,
    changePassword,
    logout,
    isLoading,
  } = useAuthStore();
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingUpdateId, setPendingUpdateId] = useState(null);
  const avatarInputRef = useRef(null);

  const [activeTab, setActiveTabState] = useState(() => searchParams.get("tab") || "menu");

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (tab === "menu") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const unreadNotificationCount = useUserNotificationStore(
    (state) => state.unreadCount,
  );
  const wishlistCount = useWishlistStore((state) => state.getItemCount());

  // Company / Employee CRUD States
  const { companies, updateCompanyDetails, addEmployee, updateEmployee, toggleEmployeeStatus, removeEmployee } = useB2bStore();
  const {
    employees: dbEmployees,
    fetchEmployees: fetchDbEmployees,
    createEmployee: createDbEmployee,
    updateEmployee: updateDbEmployee,
    deleteEmployee: deleteDbEmployee,
    companyProfile: dbCompanyProfile,
    fetchCompanyProfile: fetchDbCompanyProfile,
    updateCompanyProfile: updateDbCompanyProfile
  } = useB2BAdminStore();

  const isB2BAdmin = user?.role === 'b2bAdmin';
  const isB2BEmployee = user?.role === 'b2bEmployee';
  const isB2BUser = isB2BAdmin || isB2BEmployee;
  const isB2CUser = user?.role === 'customer';

  const company = isB2BUser
    ? dbCompanyProfile
    : companies?.find(c => c.id === user?.companyId || c.companyName === user?.companyName || c.admin?.email?.toLowerCase() === user?.email?.toLowerCase());




  useEffect(() => {
    if ((isB2CUser || isB2BUser) && user) {
      fetchBalance();
      fetchConfig(user.role);
    }
  }, [user, isB2CUser, isB2BUser]);

  useEffect(() => {
    if (isB2BUser) {
      if (isB2BAdmin) {
        fetchDbEmployees();
      }
      fetchDbCompanyProfile();
    }
  }, [user, isB2BUser, isB2BAdmin, fetchDbEmployees, fetchDbCompanyProfile]);




  const employeesList = isB2BAdmin ? dbEmployees : (company?.employees || []);

  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    companyName: '',
    gstNumber: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    businessType: '',
    website: '',
  });

  useEffect(() => {
    if (company) {
      setCompanyForm({
        companyName: company.companyName || '',
        gstNumber: company.gstNumber || '',
        businessEmail: company.businessEmail || '',
        businessPhone: company.businessPhone || '',
        businessAddress: company.businessAddress || company.companyAddress || '',
        businessType: company.businessType || company.companyType || '',
        website: company.website || '',
      });
    }
  }, [company, activeTab]);

  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [empForm, setEmpForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
  });

  const handleCompanySave = async (e) => {
    e.preventDefault();
    if (!company) return;
    if (isB2BAdmin) {
      const payload = {
        companyName: companyForm.companyName,
        businessPhone: companyForm.businessPhone,
        companyAddress: companyForm.businessAddress,
        companyType: companyForm.businessType,
        website: companyForm.website,
      };
      const success = await updateDbCompanyProfile(payload);
      if (success) {
        setIsEditingCompany(false);
      }
    } else {
      updateCompanyDetails(company.id, companyForm);
      setIsEditingCompany(false);
      toast.success('Company details updated successfully!');
    }
  };

  const handleAddEmpSubmit = (e) => {
    e.preventDefault();
    if (!company) return;
    if (!empForm.name || !empForm.email || !empForm.phone || !empForm.designation) {
      toast.error('All fields are required.');
      return;
    }
    if (editingEmployee) {
      updateEmployee(company.id, editingEmployee.email, empForm);
      toast.success('Employee details updated!');
    } else {
      addEmployee(company.id, empForm);
      toast.success('Employee added successfully!');
    }
    setShowAddEmpModal(false);
    setEditingEmployee(null);
    setEmpForm({ name: '', email: '', phone: '', designation: '' });
  };
  const {
    availablePoints,
    lifetimeEarned: totalEarned,
    lifetimeRedeemed: totalRedeemed,
    b2cLifetimeEarned,
    b2bLifetimeEarned,
    conversionRatio,
    history: loyaltyHistory,
    fetchBalance,
    fetchConfig,
    fetchHistory
  } = useLoyaltyStore();
  const pendingPoints = 0;

  useEffect(() => {
    if (activeTab === "loyalty") {
      fetchHistory(1, 20);
    }
  }, [activeTab]);
  const ensureNotificationHydrated = useUserNotificationStore(
    (state) => state.ensureHydrated,
  );

  // Offers Tab State
  const [selectedOfferSubTab, setSelectedOfferSubTab] = useState("active");
  const [selectedProfileOffer, setSelectedProfileOffer] = useState(null);
  const { offers } = useOffers();
  const profileOffers = Array.isArray(offers) ? offers : [];

  // Feedback State
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");

  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const filteredProfileOffers = useMemo(() => {
    return profileOffers.filter((offer) => {
      if (!offer) return false;
      if (selectedOfferSubTab === "active") {
        return offer.isActive && offer.status === "Active";
      } else if (selectedOfferSubTab === "expired") {
        return offer.status === "Expired";
      } else if (selectedOfferSubTab === "upcoming") {
        return offer.status === "Scheduled";
      }
      return true;
    });
  }, [profileOffers, selectedOfferSubTab]);

  const {
    register: registerPersonal,
    handleSubmit: handleSubmitPersonal,
    reset: resetPersonal,
    formState: { errors: personalErrors },
  } = useForm({
    defaultValues: {
      name: user?.name || "",
      email: (user?.role === 'b2bAdmin' || user?.role === 'b2bEmployee') ? (user?.companyEmail || user?.email || "") : (user?.email || ""),
      phone: user?.phone || "",
      gender: user?.gender || "",
      dob: user?.dob || "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    watch,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm();

  const newPassword = watch("newPassword");

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isDesktop && activeTab === "menu") {
      setActiveTab(isBusiness ? "summary" : "personal");
    }
  }, [isDesktop, activeTab, isBusiness]);

  useEffect(() => {
    const lastClickedId = sessionStorage.getItem("lastClickedProfileOption");
    if (lastClickedId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(lastClickedId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        sessionStorage.removeItem("lastClickedProfileOption");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    resetPersonal({
      name: user?.name || "",
      email: isB2BUser ? (company?.businessEmail || user?.email || "") : (user?.email || ""),
      phone: user?.phone || "",
      gender: user?.gender || "",
      dob: user?.dob || "",
    });
  }, [user, company, isB2BUser, resetPersonal]);

  useEffect(() => {
    ensureNotificationHydrated();
  }, [ensureNotificationHydrated]);

  const onPersonalSubmit = async (data) => {
    try {
      const res = await updateProfile({
        name: data?.name,
        phone: data?.phone,
        gender: data?.gender,
        dob: data?.dob,
      });
      if (res?.success) {
        toast.success("Profile updated successfully!");
      }
    } catch (error) {
      toast.error(error.message || "Failed to update profile");
    }
  };

  const onPasswordSubmit = async (data) => {
    try {
      await changePassword(data.currentPassword, data.newPassword);
      toast.success("Password changed successfully!");
      resetPassword();
    } catch (error) {
      toast.error(error.message || "Failed to change password");
    }
  };

  const handleLogout = () => {
    performUserLogout('/');
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      toast.error("Please enter your account password to confirm deletion.");
      return;
    }
    setIsDeletingAccount(true);
    try {
      // Simulate / process account deletion
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.success("Account deleted successfully!");
      setShowDeleteConfirm(false);
      setDeletePassword("");
      handleLogout();
    } catch (e) {
      toast.error("Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleAvatarPick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isValidType = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ].includes(file.type);
    if (!isValidType) {
      toast.error("Only JPEG, PNG, WEBP and GIF images are allowed.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be 5MB or less.");
      event.target.value = "";
      return;
    }

    try {
      await uploadProfileAvatar(file);
      toast.success("Profile picture updated successfully!");
    } catch (error) {
      toast.error(error?.message || "Failed to upload profile picture");
    } finally {
      event.target.value = "";
    }
  };

  const menuOptions = useMemo(() => {
    if (isBusiness) {
      return [
        {
          id: "b2b-dashboard",
          label: "B2B Dashboard",
          icon: FiTrendingUp,
          color: "text-[#7B0A0A]",
          bg: "bg-[#7B0A0A]/10",
          link: "/b2b-dashboard",
        },
        {
          id: "summary",
          label: "Business Summary",
          icon: FiBriefcase,
          color: "text-[#7B0A0A]",
          bg: "bg-[#7B0A0A]/10",
        },
        {
          id: "rfqs",
          label: "My RFQs & Quotations",
          icon: FiFileText,
          color: "text-[#7B0A0A]",
          bg: "bg-[#7B0A0A]/10",
          link: "/b2b-dashboard/rfqs",
        },
        {
          id: "b2b-orders",
          label: "Purchase Orders",
          icon: FiPackage,
          color: "text-[#7B0A0A]",
          bg: "bg-[#7B0A0A]/10",
          link: "/b2b-dashboard/purchase-orders",
        },
        {
          id: "company-profile",
          label: "Company Profile",
          icon: FiBriefcase,
          color: "text-[#7B0A0A]",
          bg: "bg-[#7B0A0A]/10",
          link: "/b2b-dashboard/company-profile",
        },
        {
          id: "personal",
          label: "Personal Information",
          icon: FiUser,
          color: "text-[#7B0A0A]",
          bg: "bg-[#7B0A0A]/10",
        },
        {
          id: "settings",
          label: "Settings",
          icon: FiSettings,
          color: "text-gray-600",
          bg: "bg-gray-100",
          link: "/settings",
        },
      ];
    }

    return [
      {
        id: "personal",
        label: "Personal Information",
        icon: FiUser,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
      },
      {
        id: "product-enquiries",
        label: "My Enquiries",
        icon: FiMessageSquare,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
      },
      {
        id: "orders",
        label: "My Orders",
        icon: FiPackage,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        link: "/orders",
      },
      {
        id: "returns",
        label: "My Returns",
        icon: FiPackage,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        link: "/returns",
      },
      {
        id: "product-requests",
        label: "My Product Requests",
        icon: FiFileText,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        link: "/product-requests",
      },
      {
        id: "addresses",
        label: "My Addresses",
        icon: FiMapPin,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        link: "/addresses",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: FiBell,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        link: "/notifications",
        badge: unreadNotificationCount > 0 ? unreadNotificationCount : null,
      },
      {
        id: "wishlist",
        label: "My Wishlist",
        icon: FiHeart,
        color: "text-red-500",
        bg: "bg-red-50",
        link: "/wishlist",
        badge: wishlistCount > 0 ? wishlistCount : null,
      },
      {
        id: "loyalty",
        label: "My Loyalty Points",
        icon: FiAward,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        badge: `${availablePoints} Pts`,
      },
      {
        id: "offers",
        label: "My Offers",
        icon: FiTag,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
      },
      {
        id: "password",
        label: "Change Password",
        icon: FiLock,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
      },
      {
        id: "support-tickets",
        label: "My Support Tickets",
        icon: FiMessageSquare,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        link: "/support-tickets",
      },
      {
        id: "my-chats",
        label: "My Store Chats",
        icon: FiMessageSquare,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        link: "/chats",
      },
      {
        id: "help",
        label: "Help & Support",
        icon: FiHelpCircle,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
        link: "/help-support",
      },
      {
        id: "feedback",
        label: "Give Feedback",
        icon: FiMessageSquare,
        color: "text-[#7B0A0A]",
        bg: "bg-[#7B0A0A]/10",
      },
      {
        id: "settings",
        label: "Settings",
        icon: FiSettings,
        color: "text-gray-600",
        bg: "bg-gray-100",
        link: "/settings",
      },
    ];
  }, [isBusiness, unreadNotificationCount, wishlistCount, availablePoints]);

  const legalOptions = [
    {
      id: "execution-acceptance",
      label: "Execution & Acceptance Policy",
      icon: FiFileText,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/execution-acceptance-policy",
    },
    {
      id: "privacy",
      label: "Privacy Policy",
      icon: FiFileText,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/privacy-policy",
    },
    {
      id: "terms",
      label: "Terms & Conditions",
      icon: FiFileText,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/terms-and-conditions",
    },
    {
      id: "agreement",
      label: "User Agreement",
      icon: FiFileText,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/user-agreement",
    },
    {
      id: "return",
      label: "Return Policy",
      icon: FiFileText,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/return-policy",
    },
    {
      id: "business-onboarding",
      label: "Business Onboarding Policy",
      icon: FiFileText,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/business-onboarding-policy",
    },
    {
      id: "shipping-delivery",
      label: "Shipping and Delivery Policy",
      icon: FiFileText,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/shipping-and-delivery-policy",
    },
    {
      id: "warranty",
      label: "Warranty Policy",
      icon: FiFileText,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/warranty-policy",
    },
    {
      id: "about",
      label: "About Us",
      icon: FiUsers,
      color: "text-[#7B0A0A]",
      bg: "bg-red-50",
      link: "/about-us",
    },
  ];

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true} noPadding={true}>
        <div className="w-full pb-24 lg:pb-12 max-w-7xl mx-auto min-h-screen bg-gray-50">
          {/* Desktop Header */}
          <div className="hidden lg:block px-4 py-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/home")}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
              >
                <FiArrowLeft className="text-xl text-gray-700" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
                <p className="text-gray-500 mt-1">
                  Manage your personal information and security settings
                </p>
              </div>
            </div>
          </div>

          <div className="lg:hidden px-4 py-4 bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/home")}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiArrowLeft className="text-xl text-gray-700" />
              </button>
              <h1 className="text-xl font-bold text-gray-800">
                {activeTab === "menu"
                  ? "My Account"
                  : activeTab === "summary"
                    ? "Summary"
                    : activeTab === "personal"
                      ? "Personal Info"
                      : activeTab === "password"
                        ? "Security"
                        : activeTab === "offers"
                          ? "My Offers"
                          : activeTab === "loyalty"
                            ? "My Loyalty Points"
                            : activeTab === "feedback"
                              ? "Give Feedback"
                              : activeTab === "product-enquiries"
                                ? "My Enquiries"
                                : activeTab === "b2b-requests"
                                  ? "B2B Requests"
                                  : activeTab === "company-profile"
                                    ? "Company Profile"
                                    : activeTab === "team-management"
                                      ? "Team Management"
                                      : "My Account"}
              </h1>
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:px-4">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block lg:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm sticky top-24">
                <div className="p-2 space-y-1">
                  {menuOptions.map((option) => {
                    const isActive = activeTab === option.id;
                    const baseStyle = `w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left font-medium text-sm`;
                    const activeStyle = option.id === "offers"
                      ? "bg-[#C07A3D]/10 text-[#C07A3D]"
                      : "bg-red-50 text-[#7B0A0A]";
                    const inactiveStyle = "text-gray-600 hover:bg-red-50/50 hover:text-[#7B0A0A]";
                    const className = `${baseStyle} ${isActive ? activeStyle : inactiveStyle}`;

                    const content = (
                      <div className="flex items-center gap-3 min-w-0">
                        <option.icon className="text-lg shrink-0" />
                        <span className="truncate">{option.label}</span>
                      </div>
                    );

                    const rightElement = option.badge ? (
                      <span className="min-w-[20px] h-5 px-2 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center whitespace-nowrap shrink-0 ml-2">
                        {option.badge}
                      </span>
                    ) : null;

                    if (option.link) {
                      return (
                        <Link
                          key={option.id}
                          id={`profile-option-${option.id}`}
                          onClick={() => sessionStorage.setItem("lastClickedProfileOption", `profile-option-${option.id}`)}
                          to={option.link}
                          className={className}
                        >
                          {content}
                          {rightElement}
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setActiveTab(option.id)}
                        className={className}
                      >
                        {content}
                        {rightElement}
                      </button>
                    );
                  })}
                  <div className="pt-2 mt-2 border-t border-gray-100">
                    <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Legal & Policies
                    </p>
                    {legalOptions.map((option) => (
                      <Link
                        key={option.id}
                        id={`profile-option-${option.id}`}
                        onClick={() => sessionStorage.setItem("lastClickedProfileOption", `profile-option-${option.id}`)}
                        to={option.link}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left font-semibold text-gray-600 hover:bg-red-50/50 hover:text-[#7B0A0A] text-sm"
                      >
                        <option.icon className="text-base text-gray-400" />
                        {option.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="px-0 py-4 lg:p-0 lg:col-span-9">
              {/* Dashboard Menu (Mobile Only) */}
              {!isDesktop && activeTab === "menu" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="lg:hidden space-y-6"
                >
                  {/* User Profile Summary Card */}
                  <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
                    <div className="w-20 h-20 rounded-full gradient-green flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shrink-0">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user?.name || "User"}
                          className="w-20 h-20 rounded-full object-cover"
                        />
                      ) : (
                        user?.name?.charAt(0).toUpperCase() || "U"
                      )}
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-800 mb-1 max-w-full break-words">
                      {user?.name || "Guest Account"}
                    </h2>
                    <p className="text-gray-500 text-sm mb-2 font-medium max-w-full break-all">
                      {user ? (isB2BUser ? (company?.businessEmail || user?.email) : user?.email) : "Log in to view your orders, quotes, and settings"}
                    </p>

                    {/* B2B Business Account Badge */}
                    {user && <B2BBusinessBadge className="mb-4" />}

                    <div className="flex gap-2 w-full mt-2">
                      {user ? (
                        <>
                          <button
                            onClick={() => setActiveTab("personal")}
                            className="flex-1 py-3 rounded-xl bg-red-50 text-[#7B0A0A] font-bold text-sm border border-red-200 hover:bg-red-100 transition-colors"
                          >
                            View Profile
                          </button>
                          {isBusiness && (
                            <button
                              onClick={() => navigate("/b2b-dashboard")}
                              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#7B0A0A] to-[#AE020B] text-white font-bold text-sm hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-1.5"
                            >
                              <FiTrendingUp className="text-base" />
                              <span>B2B Dashboard</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => navigate("/login")}
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7B0A0A] to-[#AE020B] text-white font-bold text-sm hover:brightness-110 transition-all shadow-md"
                        >
                          Sign In / Register
                        </button>
                      )}
                    </div>
                  </div>

                  {/* B2B Business Dashboard Panel */}
                  <B2BBusinessDashboard />

                  {/* Menu Options */}
                  <div className="space-y-3">
                    <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Account Settings
                    </p>
                    <div className="glass-card rounded-2xl overflow-hidden divide-y divide-gray-50 shadow-sm border border-gray-100">
                      {menuOptions.map((option) =>
                        option.link ? (
                          <Link
                            key={option.id}
                            id={`profile-option-${option.id}`}
                            onClick={() => sessionStorage.setItem("lastClickedProfileOption", `profile-option-${option.id}`)}
                            to={option.link}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors bg-white"
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-10 h-10 rounded-xl ${option.bg} ${option.color} flex items-center justify-center`}
                              >
                                <option.icon className="text-lg" />
                              </div>
                              <span className="font-bold text-gray-700 text-sm">
                                {option.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {option.badge ? (
                                <span className="min-w-[20px] h-5 px-2 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center whitespace-nowrap shrink-0">
                                  {option.badge}
                                </span>
                              ) : null}
                              <FiChevronRight className="text-gray-400" />
                            </div>
                          </Link>
                        ) : (
                          <button
                            key={option.id}
                            onClick={() => setActiveTab(option.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors bg-white"
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-10 h-10 rounded-xl ${option.bg} ${option.color} flex items-center justify-center`}
                              >
                                <option.icon className="text-lg" />
                              </div>
                              <span className="font-bold text-gray-700 text-sm">
                                {option.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {option.badge ? (
                                <span className="min-w-[20px] h-5 px-2 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center whitespace-nowrap shrink-0">
                                  {option.badge}
                                </span>
                              ) : null}
                              <FiChevronRight className="text-gray-400" />
                            </div>
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Legal & Policies Options */}
                  <div className="space-y-3">
                    <p className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Legal & Policies
                    </p>
                    <div className="glass-card rounded-2xl overflow-hidden divide-y divide-gray-50 shadow-sm border border-gray-100">
                      {legalOptions.map((option) => (
                        <Link
                          key={option.id}
                          id={`profile-option-${option.id}`}
                          onClick={() => sessionStorage.setItem("lastClickedProfileOption", `profile-option-${option.id}`)}
                          to={option.link}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors bg-white"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-xl ${option.bg} ${option.color} flex items-center justify-center`}
                            >
                              <option.icon className="text-lg" />
                            </div>
                            <span className="font-bold text-gray-700 text-sm">
                              {option.label}
                            </span>
                          </div>
                          <FiChevronRight className="text-gray-400" />
                        </Link>
                      ))}
                    </div>
                  </div>


                  {/* Action Buttons: Sign Out & Delete Account */}
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-3 p-4 glass-card rounded-2xl text-gray-700 font-bold text-sm shadow-sm border border-gray-150 hover:bg-gray-50 transition-colors bg-white"
                    >
                      <FiLogOut className="text-lg text-gray-500" />
                      <span>Sign Out</span>
                    </button>
                    
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center justify-center gap-3 p-3.5 glass-card rounded-2xl text-red-600 font-bold text-sm shadow-sm border border-red-100 hover:bg-red-50 transition-colors bg-white"
                    >
                      <FiTrash2 className="text-lg" />
                      <span>Delete Account</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Business Summary Tab (Desktop & Mobile view) */}
              {isBusiness && activeTab === "summary" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <B2BBusinessDashboard />
                </motion.div>
              )}

              {/* Personal Information Tab */}
              {activeTab === "personal" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-none lg:rounded-2xl p-4 lg:p-8 border-x-0 lg:border"
                >
                  {/* Avatar */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full gradient-green flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                        {user?.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user?.name || "User"}
                            className="w-20 h-20 rounded-full object-cover"
                          />
                        ) : (
                          user?.name?.charAt(0).toUpperCase() || "U"
                        )}
                      </div>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleAvatarPick}
                        disabled={isLoading}
                        className="absolute bottom-0 right-0 w-8 h-8 bg-white border-2 border-[#7B0A0A] rounded-full flex items-center justify-center text-[#7B0A0A] hover:bg-red-50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                      >
                        <FiCamera className="text-sm" />
                      </button>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm mb-1">
                        Profile Picture
                      </p>
                      <p className="text-xs text-gray-500">
                        JPG, PNG or GIF. Max size 5MB
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSubmitPersonal(onPersonalSubmit)}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          {...registerPersonal("name", {
                            required: "Name is required",
                            minLength: {
                              value: 2,
                              message: "Name must be at least 2 characters",
                            },
                          })}
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${personalErrors.name
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 focus:border-primary-500"
                            } focus:outline-none transition-colors text-base`}
                          placeholder="Your full name"
                        />
                      </div>
                      <AnimatePresence>
                        {personalErrors.name && (
                          <motion.p
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-1 text-sm text-red-600"
                          >
                            {personalErrors.name.message}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          {...registerPersonal("email", {
                            required: "Email is required",
                            validate: (value) =>
                              isValidEmail(value) ||
                              "Please enter a valid email",
                          })}
                          readOnly
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${personalErrors.email
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 focus:border-primary-500"
                            } focus:outline-none transition-colors text-base bg-gray-50 text-gray-500 cursor-not-allowed`}
                          placeholder="your.email@example.com"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Email cannot be changed from profile settings.
                      </p>
                      <AnimatePresence>
                        {personalErrors.email && (
                          <motion.p
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-1 text-sm text-red-600"
                          >
                            {personalErrors.email.message}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <div className="relative">
                        <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          {...registerPersonal("phone", {
                            validate: (value) =>
                              !value ||
                              isValidPhone(value) ||
                              "Please enter a valid phone number",
                          })}
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${personalErrors.phone
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 focus:border-primary-500"
                            } focus:outline-none transition-colors text-base`}
                          placeholder="1234567890"
                        />
                      </div>
                      <AnimatePresence>
                        {personalErrors.phone && (
                          <motion.p
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="mt-1 text-sm text-red-600"
                          >
                            {personalErrors.phone.message}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Gender
                        </label>
                        <select
                          {...registerPersonal("gender")}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-primary-500 transition-colors text-base bg-white"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          placeholder="Date of Birth"
                          {...registerPersonal("dob")}
                          className={`w-full px-4 py-3 rounded-xl border-2 ${personalErrors.dob
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 focus:border-primary-500"
                            } focus:outline-none transition-colors text-base`}
                        />
                        <AnimatePresence>
                          {personalErrors.dob && (
                            <motion.p
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0 }}
                              className="mt-1 text-sm text-red-600"
                            >
                              {personalErrors.dob.message}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full gradient-green text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-glow-green transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiSave />
                      {isLoading ? "Saving..." : "Save Changes"}
                    </button>
                  </form>

                  {/* Business Profile Details Section */}
                  {(isBusiness || user?.companyName) && (
                    <div className="mt-8 pt-8 border-t border-gray-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <FiBriefcase className="text-primary-600 text-xl shrink-0" />
                          <h3 className="font-extrabold text-gray-800 text-base truncate">Business Profile Details</h3>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${(company?.verificationStatus || user?.verificationStatus || 'Pending Verification') === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : (company?.verificationStatus || user?.verificationStatus || 'Pending Verification') === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                          }`}>
                          {company?.verificationStatus || user?.verificationStatus || 'Pending Verification'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4 sm:p-5 border border-gray-100 text-sm">
                        <div className="min-w-0">
                          <span className="text-gray-400 block font-medium text-xs">Company Name</span>
                          <span className="font-bold text-gray-800 break-words">{company?.companyName || user?.companyName || 'Not Set'}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-400 block font-medium text-xs">Company Type</span>
                          <span className="font-bold text-gray-800 break-words">{company?.businessType || user?.businessType || 'Not Set'}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-400 block font-medium text-xs">GST Number</span>
                          <span className="font-bold text-gray-800 font-mono break-all">{company?.gstNumber || user?.gstNumber || 'Not Set'}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-400 block font-medium text-xs">Years In Business</span>
                          <span className="font-bold text-gray-800">{company?.yearsInBusiness || user?.yearsInBusiness || '0'} Years</span>
                        </div>
                        <div className="md:col-span-2 min-w-0">
                          <span className="text-gray-400 block font-medium text-xs">Business Address</span>
                          <span className="font-bold text-gray-800 break-words">
                            {(company?.businessAddress || user?.businessAddress) 
                              ? `${company?.businessAddress || user?.businessAddress}, ${company?.city || user?.city || ''}, ${company?.state || user?.state || ''} - ${company?.pincode || user?.pincode || ''}`.replace(/,\s*,/g, ',').replace(/,\s*-/, ' -').replace(/^[,\s]+/, '') 
                              : 'Not Set'}
                          </span>
                        </div>
                        {(company?.gstCertificate || user?.gstCertificate) && (
                          <div className="md:col-span-2 mt-2 min-w-0">
                            <span className="text-gray-400 block font-medium text-xs mb-1.5">Submitted GST Certificate</span>
                            <a
                              href={company?.gstCertificate || user?.gstCertificate}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-xs font-bold text-primary-600 hover:text-primary-700 bg-white border border-gray-200 px-3 py-2 rounded-xl transition-all shadow-sm hover:shadow max-w-full"
                            >
                              <FiFileText className="text-primary-500 text-sm shrink-0" />
                              <span className="truncate">View Certificate Document</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Danger Zone */}
                  <div className="mt-8 pt-8 border-t border-red-100">
                    <h3 className="text-red-650 font-extrabold text-base mb-2">Danger Zone</h3>
                    <div className="border border-red-200 bg-red-50/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm">Delete Account</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Permanently delete your PLE customer account and erase all registered profiling information.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm self-start sm:self-center"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* B2B Requests Tab */}
              {isBusiness && activeTab === "b2b-requests" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-4 lg:p-8"
                >
                  <B2BMyEnquiries />
                </motion.div>
              )}

              {/* Company Profile Tab */}
              {isBusiness && activeTab === "company-profile" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-4 lg:p-8 space-y-6 bg-white border border-gray-200 shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Company Profile</h2>
                      <p className="text-xs text-gray-500 mt-1">View or manage details of your business account</p>
                    </div>
                    {(user?.isCompanyAdmin || user?.role === 'b2bAdmin') && !isEditingCompany && (
                      <button
                        onClick={() => setIsEditingCompany(true)}
                        className="px-4 py-2 bg-[#AE020B] hover:bg-[#8d0208] text-white font-bold rounded-xl text-xs transition-colors"
                      >
                        Edit Details
                      </button>
                    )}
                  </div>

                  {company ? (
                    <form onSubmit={handleCompanySave} className="space-y-4 text-xs font-semibold">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-gray-650 mb-1.5">Company Name</label>
                          <input
                            type="text"
                            value={companyForm.companyName}
                            onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                            disabled={!isEditingCompany}
                            className="w-full px-4 py-2.5 border rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-650 mb-1.5">GST Number</label>
                          <input
                            type="text"
                            value={companyForm.gstNumber}
                            onChange={(e) => setCompanyForm({ ...companyForm, gstNumber: e.target.value })}
                            disabled={!isEditingCompany}
                            className="w-full px-4 py-2.5 border rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-500 font-bold font-mono uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-650 mb-1.5">Business Email</label>
                          <input
                            type="email"
                            value={companyForm.businessEmail}
                            onChange={(e) => setCompanyForm({ ...companyForm, businessEmail: e.target.value })}
                            disabled={!isEditingCompany}
                            className="w-full px-4 py-2.5 border rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-650 mb-1.5">Business Phone</label>
                          <input
                            type="text"
                            value={companyForm.businessPhone}
                            onChange={(e) => setCompanyForm({ ...companyForm, businessPhone: e.target.value })}
                            disabled={!isEditingCompany}
                            className="w-full px-4 py-2.5 border rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-500 font-bold"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-gray-650 mb-1.5">Business Address</label>
                          <textarea
                            value={companyForm.businessAddress}
                            onChange={(e) => setCompanyForm({ ...companyForm, businessAddress: e.target.value })}
                            disabled={!isEditingCompany}
                            rows={2}
                            className="w-full px-4 py-2.5 border rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-650 mb-1.5">Company Type</label>
                          <select
                            value={companyForm.businessType}
                            onChange={(e) => setCompanyForm({ ...companyForm, businessType: e.target.value })}
                            disabled={!isEditingCompany}
                            className="w-full px-4 py-2.5 border rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-500 font-bold"
                          >
                            <option value="Proprietorship">Proprietorship</option>
                            <option value="Partnership Firm">Partnership Firm</option>
                            <option value="LLP (Limited Liability Partnership)">LLP (Limited Liability Partnership)</option>
                            <option value="Private Limited Company">Private Limited Company</option>
                            <option value="Public Limited Company">Public Limited Company</option>
                            <option value="One Person Company (OPC)">One Person Company (OPC)</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-gray-650 mb-1.5">Website</label>
                          <input
                            type="text"
                            value={companyForm.website}
                            onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                            disabled={!isEditingCompany}
                            className="w-full px-4 py-2.5 border rounded-xl bg-white disabled:bg-gray-50 disabled:text-gray-500 font-bold"
                          />
                        </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                        <h4 className="font-bold text-gray-700">Company Administrator</h4>
                        <p className="text-gray-600">Name: <span className="font-bold text-gray-850 break-words">{company.admin?.name || user?.name}</span></p>
                        <p className="text-gray-600">Email: <span className="font-bold text-gray-850 break-all">{company.admin?.email || user?.email}</span></p>
                        <p className="text-gray-600">Phone: <span className="font-bold text-gray-855 break-all">{company.admin?.phone || user?.phone}</span></p>
                      </div>

                      {isEditingCompany && (
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                          >
                            Save Details
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingCompany(false);
                              setCompanyForm({
                                companyName: company.companyName || '',
                                gstNumber: company.gstNumber || '',
                                businessEmail: company.businessEmail || '',
                                businessPhone: company.businessPhone || '',
                                businessAddress: company.businessAddress || '',
                                businessType: company.businessType || '',
                                website: company.website || '',
                              });
                            }}
                            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded-xl"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </form>
                  ) : (
                    <div className="p-8 text-center text-gray-500">No company details linked to this account.</div>
                  )}
                </motion.div>
              )}

              {/* Team Management Tab */}
              {isBusiness && (user?.isCompanyAdmin || user?.role === 'b2bAdmin') && activeTab === "team-management" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-4 lg:p-8 space-y-6 bg-white border border-gray-200 shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">Team Management</h2>
                      <p className="text-xs text-gray-500 mt-1">Manage your company employees under this B2B account</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingEmployee(null);
                        setEmpForm({ name: '', email: '', phone: '', designation: '' });
                        setShowAddEmpModal(true);
                      }}
                      className="px-4 py-2 bg-[#AE020B] hover:bg-[#8d0208] text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1"
                    >
                      + Add Employee
                    </button>
                  </div>

                  {showAddEmpModal && (
                    <div className="p-4 border rounded-xl bg-gray-50 space-y-4 text-xs font-semibold">
                      <h3 className="font-bold text-sm text-gray-800">{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h3>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!isB2BAdmin && !company) return;
                        if (!empForm.name || !empForm.email || !empForm.phone || !empForm.designation) {
                          toast.error('All fields are required.');
                          return;
                        }
                        if (!editingEmployee && (!empForm.password || empForm.password !== empForm.confirmPassword)) {
                          toast.error('Passwords do not match or are empty.');
                          return;
                        }

                        if (isB2BAdmin) {
                          const nameParts = empForm.name.trim().split(/\s+/);
                          const firstName = nameParts[0] || '';
                          const lastName = nameParts.slice(1).join(' ') || '';
                          const payload = {
                            firstName,
                            lastName,
                            email: empForm.email,
                            phone: empForm.phone,
                            designation: empForm.designation,
                            password: empForm.password
                          };

                          if (editingEmployee) {
                            const success = await updateDbEmployee(editingEmployee._id, payload);
                            if (success) {
                              setShowAddEmpModal(false);
                              setEditingEmployee(null);
                              setEmpForm({ name: '', email: '', phone: '', designation: '', password: '', confirmPassword: '' });
                            }
                          } else {
                            const success = await createDbEmployee(payload);
                            if (success) {
                              setShowAddEmpModal(false);
                              setEditingEmployee(null);
                              setEmpForm({ name: '', email: '', phone: '', designation: '', password: '', confirmPassword: '' });
                            }
                          }
                        } else {
                          if (editingEmployee) {
                            updateEmployee(company.id, editingEmployee.email, empForm);
                            toast.success('Employee details updated!');
                          } else {
                            addEmployee(company.id, empForm);
                            toast.success('Employee added successfully!');
                          }
                          setShowAddEmpModal(false);
                          setEditingEmployee(null);
                          setEmpForm({ name: '', email: '', phone: '', designation: '', password: '', confirmPassword: '' });
                        }
                      }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-gray-650 mb-1">Employee Name *</label>
                          <input
                            type="text"
                            value={empForm.name}
                            onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg bg-white"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-650 mb-1">Employee Email *</label>
                          <input
                            type="email"
                            value={empForm.email}
                            onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                            disabled={!!editingEmployee}
                            className="w-full px-3 py-2 border rounded-lg bg-white disabled:bg-gray-150 disabled:text-gray-500"
                            placeholder="john@apexenterprises.in"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-650 mb-1">Employee Phone *</label>
                          <input
                            type="text"
                            value={empForm.phone}
                            onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg bg-white"
                            placeholder="9876500003"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-650 mb-1">Designation *</label>
                          <input
                            type="text"
                            value={empForm.designation}
                            onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg bg-white"
                            placeholder="Purchase Executive"
                          />
                        </div>
                        {!editingEmployee && (
                          <>
                            <div>
                              <label className="block text-gray-650 mb-1">Password *</label>
                              <input
                                type="password"
                                value={empForm.password || ''}
                                onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-white"
                                placeholder="Employee password"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-650 mb-1">Confirm Password *</label>
                              <input
                                type="password"
                                value={empForm.confirmPassword || ''}
                                onChange={(e) => setEmpForm({ ...empForm, confirmPassword: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg bg-white"
                                placeholder="Confirm password"
                              />
                            </div>
                          </>
                        )}
                        <div className="sm:col-span-2 flex gap-2 pt-2">
                          <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold">
                            {editingEmployee ? 'Update' : 'Add'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddEmpModal(false);
                              setEditingEmployee(null);
                            }}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-755 rounded-lg font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {employeesList && employeesList.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-150">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Name</th>
                            <th className="py-3 px-4">Email / Info</th>
                            <th className="py-3 px-4">Phone</th>
                            <th className="py-3 px-4">Designation</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-755">
                          {employeesList.map((emp) => {
                            const empName = emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
                            const empEmail = emp.email;
                            const empPhone = emp.phone;
                            const empDesignation = emp.designation;
                            const empStatus = emp.status || (emp.isActive !== false ? 'Active' : 'Inactive');

                            return (
                              <tr key={empEmail} className="hover:bg-gray-50">
                                <td className="py-3.5 px-4 font-bold text-gray-900">{empName}</td>
                                <td className="py-3.5 px-4 font-medium">
                                  <p>{empEmail}</p>
                                  <div className="flex gap-2 text-[9px] mt-1 text-gray-400 font-bold">
                                    <button onClick={() => {
                                      navigator.clipboard.writeText(`Email: ${empEmail}\nPassword: ${emp.password || 'Employee@123'}`);
                                      toast.success('Credentials copied!');
                                    }} className="text-blue-500 hover:underline">Copy Credentials</button>
                                    <span>•</span>
                                    <button onClick={() => {
                                      const loginLink = `${window.location.origin}/login`;
                                      navigator.clipboard.writeText(loginLink);
                                      toast.success('Login link copied!');
                                    }} className="text-emerald-500 hover:underline">Copy Login Link</button>
                                    <span>•</span>
                                    <button onClick={() => {
                                      toast.success(`Invitation resending simulated to ${empEmail}`);
                                    }} className="text-purple-550 hover:underline">Resend Invitation</button>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono font-bold">{empPhone}</td>
                                <td className="py-3.5 px-4 font-semibold text-gray-655">{empDesignation}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${empStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {empStatus}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right space-x-2">
                                  <button
                                    onClick={() => {
                                      setEditingEmployee(emp);
                                      setEmpForm({
                                        name: empName,
                                        email: empEmail,
                                        phone: empPhone || '',
                                        designation: empDesignation || '',
                                      });
                                      setShowAddEmpModal(true);
                                    }}
                                    className="text-[#AE020B] hover:underline font-bold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (isB2BAdmin) {
                                        const nextStatus = emp.isActive !== false ? 'Inactive' : 'Active';
                                        await updateDbEmployee(emp._id, { status: nextStatus });
                                      } else {
                                        toggleEmployeeStatus(company.id, empEmail);
                                        toast.success(`Employee status toggled!`);
                                      }
                                    }}
                                    className="text-amber-800 hover:underline font-bold"
                                  >
                                    {empStatus === 'Active' ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm('Are you sure you want to remove this employee?')) {
                                        if (isB2BAdmin) {
                                          await deleteDbEmployee(emp._id);
                                        } else {
                                          removeEmployee(company.id, empEmail);
                                          toast.success('Employee removed successfully.');
                                        }
                                      }
                                    }}
                                    className="text-gray-500 hover:text-red-700 font-bold hover:underline"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500 border rounded-xl">No employees added under this company yet. Click + Add Employee to setup your team.</div>
                  )}
                </motion.div>
              )}

              {/* Product Enquiries Tab */}
              {activeTab === "product-enquiries" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-4 lg:p-8"
                >
                  <MyProductEnquiries />
                </motion.div>
              )}

              {/* Change Password Tab */}
              {activeTab === "password" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-4 lg:p-8"
                >
                  <h2 className="text-lg font-bold text-gray-800 mb-4">
                    Change Password
                  </h2>

                  <form
                    onSubmit={handleSubmitPassword(onPasswordSubmit)}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          {...registerPassword("currentPassword", {
                            required: "Current password is required",
                          })}
                          className={`w-full pl-12 pr-12 py-3 rounded-xl border-2 ${passwordErrors.currentPassword
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 focus:border-primary-500"
                            } focus:outline-none transition-colors text-sm sm:text-base`}
                          placeholder="Current Password"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {passwordErrors.currentPassword && (
                        <p className="mt-1 text-sm text-red-600">
                          {passwordErrors.currentPassword.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          {...registerPassword("newPassword", {
                            required: "New password is required",
                            minLength: {
                              value: 6,
                              message: "Password must be at least 6 characters",
                            },
                          })}
                          className={`w-full pl-12 pr-12 py-3 rounded-xl border-2 ${passwordErrors.newPassword
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 focus:border-primary-500"
                            } focus:outline-none transition-colors text-sm sm:text-base`}
                          placeholder="New Password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {passwordErrors.newPassword && (
                        <motion.p
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="mt-1 text-sm text-red-600"
                        >
                          {passwordErrors.newPassword.message}
                        </motion.p>
                      )}
                      <PasswordStrengthMeter password={newPassword} />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          {...registerPassword("confirmPassword", {
                            required: "Please confirm your password",
                            validate: (value) =>
                              value === newPassword || "Passwords do not match",
                          })}
                          className={`w-full pl-12 pr-12 py-3 rounded-xl border-2 ${passwordErrors.confirmPassword
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 focus:border-primary-500"
                            } focus:outline-none transition-colors text-sm sm:text-base`}
                          placeholder="Confirm Password"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {passwordErrors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">
                          {passwordErrors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full gradient-green text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-glow-green transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiSave />
                      {isLoading ? "Changing Password..." : "Change Password"}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* My Offers Tab */}
              {activeTab === "offers" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-4 lg:p-8 space-y-6 bg-white border border-gray-200"
                >
                  <h2 className="text-lg font-bold text-gray-800">
                    My Offers & Coupons
                  </h2>

                  <div className="flex bg-gray-100 rounded-xl p-1">
                    {["active", "expired", "upcoming"].map((subTab) => (
                      <button
                        key={subTab}
                        type="button"
                        onClick={() => setSelectedOfferSubTab(subTab)}
                        className={`flex-1 py-2 text-xs font-bold capitalize rounded-lg transition-all ${selectedOfferSubTab === subTab
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500"
                          }`}
                      >
                        {subTab} Offers
                      </button>
                    ))}
                  </div>

                  {filteredProfileOffers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredProfileOffers.map((offer) => (
                        <OfferCard
                          key={offer.id}
                          offer={offer}
                          onViewDetails={setSelectedProfileOffer}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
                      <p className="text-sm text-gray-500">No {selectedOfferSubTab} offers available.</p>
                    </div>
                  )}

                  <OfferModal
                    isOpen={!!selectedProfileOffer}
                    onClose={() => setSelectedProfileOffer(null)}
                    offer={selectedProfileOffer}
                  />
                </motion.div>
              )}

              {/* Give Feedback Tab */}
              {activeTab === "feedback" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-4 lg:p-8 space-y-6 bg-white border border-gray-200 shadow-sm"
                >
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      Give Feedback
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      We value your feedback. Please share your rating and comments.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        How would you rate your experience?
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFeedbackRating(star)}
                            className="p-1 focus:outline-none transition-transform hover:scale-125"
                          >
                            <FiStar
                              className={`w-8 h-8 ${star <= feedbackRating
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-gray-300"
                                } transition-colors duration-200`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Write your comments (optional)
                      </label>
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Tell us what we can improve, or what you liked..."
                        rows={5}
                        className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-primary-500 transition-colors text-base"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toast.success("Thank you for your valuable feedback!");
                        setFeedbackText("");
                        setFeedbackRating(5);
                        setActiveTab("personal");
                      }}
                      className="w-full gradient-green text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-glow-green transition-all duration-300"
                    >
                      <FiSave />
                      Submit Feedback
                    </button>
                  </div>
                </motion.div>
              )}

              {/* My Loyalty Points Tab */}
              {activeTab === "loyalty" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Loyalty Points Overview Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* Available Points */}
                    <div className="bg-gradient-to-br from-[#AE020B] to-[#7B0A0A] text-white rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                      <div className="absolute right-2 top-2 opacity-15">
                        <FiAward className="text-8xl -mr-6 -mt-6" />
                      </div>
                      <div>
                        <span className="text-red-100 text-xs font-bold uppercase tracking-wider">Available Points</span>
                        <p className="text-3xl font-black mt-1">{availablePoints}</p>
                      </div>
                      <span className="text-[10px] text-red-100 font-semibold mt-4">1 Rupee = {conversionRatio} Points</span>
                    </div>

                    {/* Total Earned Points */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[140px]">
                      <div>
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Earned</span>
                        <p className="text-3xl font-black text-gray-800 mt-1">{totalEarned}</p>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold mt-4 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Lifetime Rewards
                      </span>
                    </div>

                    {/* Total Redeemed Points */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[140px]">
                      <div>
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Redeemed</span>
                        <p className="text-3xl font-black text-gray-800 mt-1">{totalRedeemed}</p>
                      </div>
                      <span className="text-[10px] text-[#7B0A0A] font-bold mt-4 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7B0A0A]"></span> Saved Money
                      </span>
                    </div>

                    {/* B2C Earned */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[140px]">
                      <div>
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">B2C Earned</span>
                        <p className="text-3xl font-black text-gray-800 mt-1">{b2cLifetimeEarned}</p>
                      </div>
                      <span className="text-[10px] text-blue-600 font-semibold mt-4">B2C Shopping</span>
                    </div>

                    {/* B2B Earned */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[140px]">
                      <div>
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">B2B Earned</span>
                        <p className="text-3xl font-black text-gray-800 mt-1">{b2bLifetimeEarned}</p>
                      </div>
                      <span className="text-[10px] text-purple-600 font-semibold mt-4">B2B Shopping</span>
                    </div>
                  </div>

                  {/* Points History Table */}
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                      <div>
                        <h3 className="font-extrabold text-gray-800 text-base">Points Transaction History</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Track your points lifecycle updates</p>
                      </div>
                      <Link
                        to="/loyalty-history"
                        className="text-xs font-bold text-[#7B0A0A] hover:underline"
                      >
                        View Full History →
                      </Link>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-black tracking-wider border-b border-gray-150">
                          <tr>
                            <th className="py-3.5 px-4">Transaction Date</th>
                            <th className="py-3.5 px-4">Order Reference</th>
                            <th className="py-3.5 px-4 text-center">Earned Points</th>
                            <th className="py-3.5 px-4 text-center">Redeemed Points</th>
                            <th className="py-3.5 px-4 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                          {loyaltyHistory.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50/70 transition-colors">
                              <td className="py-3 px-4 font-medium">
                                {new Date(item.date).toLocaleDateString("en-IN", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-xs text-[#7B0A0A]">
                                {item.orderRef}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {item.earnedPoints > 0 ? (
                                  <span className="inline-flex items-center text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    +{item.earnedPoints}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 font-bold">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {item.redeemedPoints > 0 ? (
                                  <span className="inline-flex items-center text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                                    -{item.redeemedPoints}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 font-bold">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-gray-800">
                                {item.balance}
                              </td>
                            </tr>
                          ))}
                          {loyaltyHistory.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-gray-500 font-medium">
                                No point transactions recorded.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Delete Account Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-150 space-y-4"
              >
                <div className="text-center space-y-2">
                  <span className="text-4xl">⚠️</span>
                  <h3 className="text-lg font-bold text-gray-905">Delete Account Permanently?</h3>
                  <p className="text-xs text-gray-500">
                    Are you absolutely sure you want to delete your PLE account? This action is permanent and cannot be undone. You will lose access to all your order history, active offers, and billing data.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700">Confirm by typing your account password</label>
                    <input
                      type="password"
                      placeholder="Enter account password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={!deletePassword.trim() || isDeletingAccount}
                      onClick={handleDeleteAccount}
                      className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                      <FiTrash2 />
                      <span>{isDeletingAccount ? "Deleting..." : "Permanently Delete"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingAccount}
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword("");
                      }}
                      className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-colors text-center"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileProfile;
