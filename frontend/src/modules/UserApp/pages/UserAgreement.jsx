import { FiUsers, FiArrowLeft, FiDownload } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import { useAuthStore } from "../../../shared/store/authStore";
import { useB2bStore } from "../../../shared/store/b2bStore";
import { useBusinessBuyer } from "../hooks/useBusinessBuyer";
import toast from "react-hot-toast";

const UserAgreement = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const b2bUserRole = useB2bStore((state) => state.userRole);
  const { isBusiness } = useBusinessBuyer();
  
  const isB2BUser = isBusiness || user?.role === 'b2bAdmin' || user?.role === 'b2bEmployee' || user?.isEmployee || b2bUserRole === 'business_buyer';

  const b2bSections = [
    {
      title: "1. Scope of Agreement",
      content:
        "This User Agreement forms a legally binding contract between you and our platform, defining user privileges, permissions, and operational constraints inside the digital storefront and customer services.",
    },
    {
      title: "2. Eligibility & Representation",
      content:
        "By participating in activities, making purchases, or providing testimonials, you affirm you are legally capable of executing contracts and represent your personal interests or have proper corporate authorizations.",
    },
    {
      title: "3. User Reviews & Community Code",
      content:
        "We allow public product reviews and customer suggestions. You agree that any feedback, comments, or multimedia uploads are respectful, free of spam or slander, and accurately represent honest consumer reviews.",
    },
    {
      title: "4. Account Disabling & Restricting",
      content:
        "We retain absolute rights to limit profile activity, suspend delivery benefits, or terminate access privileges permanently if any violations of the community code, scam actions, or suspicious transactions are observed.",
    },
    {
      title: "5. Disclaimers & Liabilities",
      content:
        "Our platform is provided 'as is' without warranty. While we maintain reliable delivery timelines and product catalog precision, we cannot guarantee zero minor system lag or short-term vendor inventory issues.",
    },
  ];

  const activeSections = b2bSections;

  const handleDownload = () => {
    const header = "USER AGREEMENT - Peoples League Of Electronics Private Limited\nLast updated: June 2026\n\n";
    const body = activeSections.map((s) => `${s.title}\n${s.content}`).join("\n\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "User_Agreement.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="max-w-3xl mx-auto px-4 py-6 pb-24 min-h-screen">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate("/profile");
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
            >
              <FiArrowLeft className="text-xl text-gray-700" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                <FiUsers className="text-[#7B0A0A]" /> User Agreement
              </h1>
              <p className="text-xs text-gray-500 font-medium">Last updated: June 2026</p>
            </div>
            {isB2BUser && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-primary-700 transition-colors"
              >
                <FiDownload className="text-sm" />
                <span>Download</span>
              </button>
            )}
          </div>

          {/* Content Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 shadow-sm space-y-6"
          >
            <p className="text-sm text-gray-600 leading-relaxed">
              This Agreement details the rights, guidelines, and obligations for using our B2C customer portal, apps, and services.
            </p>

            <div className="border-t border-gray-100 pt-6 space-y-6">
              {activeSections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="text-base font-bold text-gray-800">{section.title}</h3>
                  <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{section.content}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-6 text-center">
              <p className="text-xs text-gray-500">
                {isB2BUser
                  ? "If you have questions about this Business User Agreement, please contact our B2B legal desk at b2blegal@peoplesleagueofelectronics.com."
                  : "If you have questions about this Agreement, please contact our support desk at support@ple.com."}
              </p>
            </div>
          </motion.div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default UserAgreement;
