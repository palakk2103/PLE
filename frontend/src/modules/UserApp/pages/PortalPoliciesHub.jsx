import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft,
  FiFileText,
  FiShield,
  FiUsers,
  FiAward,
  FiBriefcase,
  FiTruck,
  FiRefreshCw,
  FiCheckCircle,
  FiSearch,
  FiSun,
  FiMoon,
  FiExternalLink,
  FiInfo,
  FiCheckSquare
} from 'react-icons/fi';
import { useThemeStore } from '../../../shared/store/themeStore';
import { legalContent } from '../data/legalContent';
import PageTransition from '../../../shared/components/PageTransition';

// Extra sections for policies not solely in legalContent.js
const extraPolicyContents = {
  'execution-acceptance': {
    title: 'Execution & Acceptance Policy',
    category: 'Legal Governance',
    lastUpdated: 'June 2026',
    intro: 'This Execution & Acceptance Policy governs the electronic execution, legal bindingness, and mutual acceptance of transactions and agreements between Peoples League Of Electronics Private Limited ("Company", "PLE") and its users or commercial partners.',
    sections: [
      {
        heading: '1. Effective Date & Scope',
        clauses: [
          'This Execution & Acceptance Agreement becomes effective on the date the User or Business User first registers an account, accesses or uses the Platform, submits a Purchase Order or Request for Quotation (RFQ), electronically accepts this Agreement, executes a commercial agreement, or otherwise transacts with PLE.',
          'It applies to all digital interactions, electronic records, agreements, terms, and purchase commitments entered into through the Platform.'
        ]
      },
      {
        heading: '2. Electronic Signatures & Acceptance',
        clauses: [
          'The Parties acknowledge and agree that acceptance through electronic means—including click-through acceptance checkboxes, digital OTP verification, biometric confirmation, electronic signatures, or authenticated digital consent—shall constitute valid, binding, and enforceable acceptance under the Information Technology Act, 2000 and applicable contract laws.',
          'Electronic records maintained by the Company shall constitute prima facie evidence of the user\'s acceptance and transactions.'
        ]
      },
      {
        heading: '3. Legal Authority & Capacity',
        clauses: [
          'The individual executing or accepting this Agreement represents and warrants that they possess the requisite legal capacity, authority, and power to bind themselves or their respective organization to all stipulations contained herein.',
          'In the case of Enterprise/B2B users, the authorized representative warrants that corporate approvals, board resolutions (where applicable), and GST authority have been duly secured.'
        ]
      },
      {
        heading: '4. Corporate & Company Legal Identification',
        clauses: [
          'Entity Name: Peoples League Of Electronics Private Limited',
          'Corporate Identification Number (CIN): U26209KA2025PTC212469',
          'GSTIN: 29AAQCP4616C1Z9',
          'Registered Office: SHOP NO 25, R.S NO. 1045/3, Ujwal Nagar Main Road, 2nd Cross, Left Side, Belagavi, Karnataka - 590010',
          'Official Legal Email: Legal@plebusiness.com',
          'Official Domain: peoplesleagueofelectronics.com / plebusiness.com'
        ]
      }
    ],
    footer: 'For any verification of corporate execution records, contact Legal@plebusiness.com.'
  },
  'business-onboarding': {
    title: 'Business Onboarding Policy',
    category: 'Enterprise Compliance',
    lastUpdated: 'June 2026',
    intro: 'These Business Onboarding Terms & Conditions establish the mandatory legal framework governing the verification, documentation, approval, and commercial activation of Business Users seeking access to the PLE B2B Enterprise Platform.',
    sections: [
      {
        heading: '1. Purpose & Eligibility Standards',
        clauses: [
          'To establish standardized onboarding rules, verify business bona fides, prevent financial crimes, and comply with Goods and Services Tax (GST) regulations.',
          'Eligible entities include Private & Public Limited Companies, LLPs, Registered Partnerships, Sole Proprietorships with valid GST, PSUs, Government Bodies, and Authorized Institutional Buyers.'
        ]
      },
      {
        heading: '2. Mandatory KYC & Verification Requirements',
        clauses: [
          'Valid GSTIN registration certificate with active filing status on the GST portal.',
          'Company PAN Card and Certificate of Incorporation (or Partnership Deed / Registration Certificate).',
          'Identity and address verification of authorized directors, partners, or sole proprietors.',
          'Active business bank account verification with canceled cheque or bank statement.'
        ]
      },
      {
        heading: '3. Verification & Approval Lifecycle',
        clauses: [
          'Submissions undergo automated GST validation followed by manual compliance review by the PLE Risk Management Team.',
          'PLE reserves the right to request additional documentation, reject applications with unverified information, or suspend accounts exhibiting fraudulent or irregular procurement patterns.'
        ]
      }
    ],
    footer: 'Corporate inquiries regarding onboarding: Enterprise@plebusiness.com.'
  },
  'return-policy': {
    title: 'Return, Refund & Cancellation Policy',
    category: 'Post-Purchase Support',
    lastUpdated: 'June 2026',
    intro: 'This Return, Refund & Cancellation Policy details the eligibility windows, inspection standards, and compensation timelines for product returns, replacements, and order cancellations across retail and commercial purchases.',
    sections: [
      {
        heading: '1. General Return Window & Conditions',
        clauses: [
          'Customers may initiate a return request within the designated return window (typically 7 days from delivery for eligible electronics) if the product is defective, damaged in transit, missing accessories, or materially different from the catalog description.',
          'Products must be returned in their original packaging, with all manufacturer accessories, user manuals, warranty cards, serial numbers, and IMEI numbers intact and unaltered.'
        ]
      },
      {
        heading: '2. Return Merchandise Authorization (RMA) Process',
        clauses: [
          'All returns must be initiated through the PLE Portal or Customer Support to receive a valid Return Merchandise Authorization (RMA) number.',
          'Our verified logistics partners will schedule reverse pickup from the original delivery address. Doorstep inspection may be conducted by the logistics executive.'
        ]
      },
      {
        heading: '3. Refund & Replacement Timelines',
        clauses: [
          'Upon receipt of the returned product at our fulfillment center and successful quality inspection, eligible refunds are initiated within 3-5 business days.',
          'Refunds are credited to the original payment source (UPI, Card, Net Banking) or Corporate/Customer Wallet based on user preference.'
        ]
      }
    ],
    footer: 'For return disputes or escalation, contact support@peoplesleagueofelectronics.com.'
  },
  'shipping-policy': {
    title: 'Shipping & Delivery Policy',
    category: 'Logistics & Fulfillment',
    lastUpdated: 'June 2026',
    intro: 'This Shipping and Delivery Policy sets out the fulfillment processes, dispatch timeframes, transit insurance safeguards, and delivery standards for electronics ordered on the PLE Platform.',
    sections: [
      {
        heading: '1. Serviceable Areas & Transit Schedules',
        clauses: [
          'PLE services thousands of PIN codes across India via Tier-1 national courier and enterprise freight logistics partners.',
          'Standard orders are dispatched within 24-48 business hours. Estimated delivery schedules range from 2 to 7 business days depending on delivery destination and shipment category.'
        ]
      },
      {
        heading: '2. Transit Insurance & High-Value Safety',
        clauses: [
          'All electronics shipments are fully insured during transit against accidental damage, loss, or theft until verified delivery confirmation.',
          'High-value electronics require OTP verification at the time of doorstep handover to ensure delivery to the authorized recipient.'
        ]
      },
      {
        heading: '3. Tracking & Delivery Attempts',
        clauses: [
          'Live tracking coordinates and dispatch milestones are shared via SMS, WhatsApp, and in-app notifications upon courier pickup.',
          'Our logistics partners attempt delivery up to three (3) consecutive business days before returning an undelivered parcel to our fulfillment hub.'
        ]
      }
    ],
    footer: 'For delivery assistance or tracking updates, email delivery@peoplesleagueofelectronics.com.'
  },
  'warranty-policy': {
    title: 'Warranty & Protection Policy',
    category: 'Product Coverage',
    lastUpdated: 'June 2026',
    intro: 'This Warranty Policy governs manufacturer warranty passthrough, authorized service center networks, and extended protection plans applicable to genuine electronics purchased through PLE.',
    sections: [
      {
        heading: '1. 100% Genuine Manufacturer Warranty',
        clauses: [
          'All brand-new consumer electronics, components, and appliances sold on PLE carry genuine brand warranty honored directly by authorized manufacturer service centers across India.',
          'Your tax invoice generated upon order completion serves as proof of purchase for manufacturer warranty registration.'
        ]
      },
      {
        heading: '2. Dead on Arrival (DOA) Protection',
        clauses: [
          'Products found functionally non-operational upon unboxing (DOA) within 48 hours of delivery are eligible for immediate prioritized replacement upon technical verification.',
          'Customers are encouraged to capture an unboxing video for high-value tech purchases.'
        ]
      },
      {
        heading: '3. Exclusions from Warranty Coverage',
        clauses: [
          'Physical damage, liquid spillage, unauthorized repair attempts, electrical surge damage, and cosmetic wear-and-tear are excluded from standard warranty coverage in accordance with manufacturer guidelines.'
        ]
      }
    ],
    footer: 'For warranty claims guidance, contact warranty@peoplesleagueofelectronics.com.'
  },
  'about-us': {
    title: 'About Peoples League Of Electronics',
    category: 'Corporate Overview',
    lastUpdated: 'June 2026',
    intro: 'Peoples League Of Electronics Private Limited (PLE) is a technology commerce platform empowering retail consumers and commercial enterprises with authentic electronics, seamless procurement, and transparent logistics.',
    sections: [
      {
        heading: '1. Our Mission',
        clauses: [
          'To democratize access to genuine high-performance consumer and enterprise electronics with guaranteed warranty, fair pricing, and rapid delivery across India.',
          'To bridge retail consumers and business procurement through specialized, dedicated digital portals tailored for their distinct operational needs.'
        ]
      },
      {
        heading: '2. Corporate Governance & Ethics',
        clauses: [
          'Incorporated under the Companies Act, 2013, PLE adheres to stringent compliance, data privacy, and electronic commerce standards.',
          'We partner exclusively with verified brand manufacturers, authorized distributors, and vetted logistics providers.'
        ]
      }
    ],
    footer: 'Visit plebusiness.com or peoplesleagueofelectronics.com for more corporate updates.'
  }
};

const B2C_POLICIES = [
  {
    id: 'terms',
    title: 'Terms & Conditions',
    badge: 'Core Retail Agreement',
    icon: FiFileText,
    summary: 'Rules and conditions governing shopping, orders, accounts, and payments on the B2C retail store.'
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    badge: 'Data Protection',
    icon: FiShield,
    summary: 'Comprehensive disclosures on data collection, privacy safeguards, security protocols, and user rights.'
  },
  {
    id: 'user-agreement',
    title: 'User Agreement',
    badge: 'Account Standards',
    icon: FiUsers,
    summary: 'Customer code of conduct, account usage policies, and acceptable platform practices.'
  },
  {
    id: 'return-policy',
    title: 'Return & Refund Policy',
    badge: 'Consumer Rights',
    icon: FiRefreshCw,
    summary: 'Eligibility windows, replacement rules, RMA guidelines, and refund schedules.'
  },
  {
    id: 'shipping-policy',
    title: 'Shipping & Delivery Policy',
    badge: 'Fulfillment & Logistics',
    icon: FiTruck,
    summary: 'Delivery timelines, transit insurance, free shipping criteria, and tracking procedures.'
  },
  {
    id: 'warranty-policy',
    title: 'Warranty Policy',
    badge: 'Product Coverage',
    icon: FiAward,
    summary: 'Manufacturer warranty passthrough, DOA coverage, and service center procedures.'
  },
  {
    id: 'execution-acceptance',
    title: 'Execution & Acceptance Policy',
    badge: 'Legal Consent',
    icon: FiCheckSquare,
    summary: 'Statutory electronic consent, validity of digital acceptance, and corporate details.'
  },
  {
    id: 'trademark',
    title: 'Trademark & IP Policy',
    badge: 'Brand Protection',
    icon: FiAward,
    summary: 'Intellectual property rights, brand asset protection, and anti-counterfeiting terms.'
  },
  {
    id: 'about-us',
    title: 'About PLE',
    badge: 'Corporate Profile',
    icon: FiInfo,
    summary: 'Corporate background, vision, registration credentials, and operational presence.'
  }
];

const B2B_POLICIES = [
  {
    id: 'business-terms',
    title: 'Business Terms & Conditions',
    badge: 'Enterprise Procurement',
    icon: FiBriefcase,
    summary: 'Commercial purchasing, RFQ contracts, bulk payment terms, and B2B ordering stipulations.'
  },
  {
    id: 'business-onboarding',
    title: 'Business Onboarding Policy',
    badge: 'GST & Compliance',
    icon: FiCheckCircle,
    summary: 'Mandatory documentation, KYC verification standards, GST validation, and enterprise approval stages.'
  },
  {
    id: 'execution-acceptance',
    title: 'Execution & Acceptance Policy',
    badge: 'Commercial Acceptance',
    icon: FiCheckSquare,
    summary: 'Legal authority, electronic contract bindingness, corporate details, and attestation standards.'
  },
  {
    id: 'user-agreement',
    title: 'Business User Agreement',
    badge: 'Platform Operations',
    icon: FiUsers,
    summary: 'Enterprise user rights, employee wallet governance, purchase order authorizations, and security.'
  },
  {
    id: 'privacy',
    title: 'Enterprise Privacy Policy',
    badge: 'Data Governance',
    icon: FiShield,
    summary: 'Corporate data handling, commercial confidentiality, encryption, and statutory data protections.'
  },
  {
    id: 'shipping-policy',
    title: 'B2B Logistics & Freight Policy',
    badge: 'Enterprise Dispatch',
    icon: FiTruck,
    summary: 'Bulk shipping, pallet freight, warehousing handovers, demurrage terms, and transit insurance.'
  },
  {
    id: 'warranty-policy',
    title: 'B2B Commercial Warranty Policy',
    badge: 'Commercial Warranties',
    icon: FiAward,
    summary: 'OEM warranty terms, enterprise RMA turnaround times, on-site service protocols, and exclusions.'
  },
  {
    id: 'return-policy',
    title: 'Commercial Cancellation & Claims',
    badge: 'Dispute Resolution',
    icon: FiRefreshCw,
    summary: 'B2B cancellation restrictions, consignment inspection windows, and credit note issuance.'
  },
  {
    id: 'trademark',
    title: 'Trademark & Proprietary Rights',
    badge: 'Intellectual Property',
    icon: FiAward,
    summary: 'Enterprise trademark usage, software licenses, catalog IP, and confidentiality clauses.'
  }
];

const PortalPoliciesHub = () => {
  const navigate = useNavigate();
  const { portalType } = useParams(); // 'b2c' or 'b2b'
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, setTheme } = useThemeStore();
  const isDarkMode = theme === 'dark';

  // Determine active portal: b2c or b2b
  const currentPortal = (portalType || '').toLowerCase() === 'b2b' ? 'b2b' : 'b2c';
  const policiesList = currentPortal === 'b2b' ? B2B_POLICIES : B2C_POLICIES;

  // Active policy selection
  const queryPolicy = searchParams.get('policy');
  const defaultPolicyId = policiesList[0].id;
  const [selectedPolicyId, setSelectedPolicyId] = useState(queryPolicy || defaultPolicyId);
  const [searchFilter, setSearchFilter] = useState('');

  // Keep selectedPolicyId in sync when query param or portal changes
  useEffect(() => {
    if (queryPolicy && policiesList.some((p) => p.id === queryPolicy)) {
      setSelectedPolicyId(queryPolicy);
    } else {
      setSelectedPolicyId(policiesList[0].id);
    }
  }, [currentPortal, queryPolicy]);

  const handleSelectPolicy = (policyId) => {
    setSelectedPolicyId(policyId);
    setSearchParams({ policy: policyId }, { replace: true });
    // Scroll to top of content view on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter policies based on search query
  const filteredPolicies = useMemo(() => {
    if (!searchFilter.trim()) return policiesList;
    const q = searchFilter.toLowerCase();
    return policiesList.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.badge.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q)
    );
  }, [policiesList, searchFilter]);

  // Retrieve policy content from legalContent or extraPolicyContents
  const selectedPolicyData = useMemo(() => {
    return (
      legalContent[selectedPolicyId] ||
      extraPolicyContents[selectedPolicyId] || {
        title: 'Policy Document',
        category: 'Legal',
        lastUpdated: 'June 2026',
        intro: 'Please refer to the official documentation on the PLE platform.',
        sections: []
      }
    );
  }, [selectedPolicyId]);

  const activePolicyMeta = policiesList.find((p) => p.id === selectedPolicyId) || policiesList[0];
  const IconComponent = activePolicyMeta.icon || FiFileText;

  return (
    <PageTransition>
      <div className={`min-h-screen ${isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-gray-50 text-gray-900'} transition-colors duration-200`}>
        {/* Sticky Top Header Bar */}
        <header className={`sticky top-0 z-30 border-b backdrop-blur-md transition-colors ${
          isDarkMode ? 'bg-zinc-950/85 border-zinc-800' : 'bg-white/90 border-gray-200'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            {/* Left: Back button & Portal Info */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/')}
                className={`p-2 rounded-xl border transition-all duration-150 flex items-center gap-1.5 text-xs sm:text-sm font-semibold cursor-pointer ${
                  isDarkMode
                    ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                    : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-700 shadow-xs'
                }`}
                title="Back to Selection Portal"
              >
                <FiArrowLeft size={16} />
                <span className="hidden sm:inline">Back to Portal</span>
              </button>

              <div className="h-5 w-px bg-gray-200 dark:bg-zinc-800 hidden sm:block" />

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black truncate tracking-tight">
                    PLE <span className="text-[#AE020B]">Policies Hub</span>
                  </h1>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border hidden md:inline-flex ${
                    currentPortal === 'b2b'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  }`}>
                    {currentPortal === 'b2b' ? 'Enterprise B2B' : 'Retail Store B2C'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Theme Toggle */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle Button */}
              <button
                onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isDarkMode
                    ? 'bg-zinc-900 border-zinc-800 text-yellow-400 hover:bg-zinc-800'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 shadow-xs'
                }`}
                aria-label="Toggle Theme"
              >
                {isDarkMode ? <FiSun size={16} /> : <FiMoon size={16} />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Horizontal Pill Scrollable Tabs */}
        <div className={`lg:hidden border-b overflow-x-auto scrollbar-none px-4 py-2.5 flex items-center gap-2 sticky top-16 z-20 backdrop-blur-md ${
          isDarkMode ? 'bg-zinc-950/90 border-zinc-800' : 'bg-white/95 border-gray-200 shadow-xs'
        }`}>
          {policiesList.map((policy) => {
            const isSelected = policy.id === selectedPolicyId;
            const Icon = policy.icon || FiFileText;
            return (
              <button
                key={policy.id}
                onClick={() => handleSelectPolicy(policy.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#AE020B] text-white shadow-xs'
                    : isDarkMode
                      ? 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <Icon size={12} />
                <span>{policy.title}</span>
              </button>
            );
          })}
        </div>

        {/* Main Two-Column Hub Layout */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Sidebar (Desktop): Policy Navigator */}
            <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
              <div className={`rounded-2xl border p-4 shadow-xs ${
                isDarkMode ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-gray-200'
              }`}>
                {/* Search in policies */}
                <div className="relative mb-3">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search policies..."
                    className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-semibold border outline-none transition-all ${
                      isDarkMode
                        ? 'bg-zinc-800/80 border-zinc-700 text-white placeholder-zinc-500 focus:border-[#AE020B]'
                        : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-[#AE020B] focus:bg-white'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                    {currentPortal === 'b2b' ? 'Enterprise Documents' : 'Consumer Policies'} ({filteredPolicies.length})
                  </span>
                  <span className="text-[10px] font-bold text-[#AE020B]">
                    Active: {activePolicyMeta.title}
                  </span>
                </div>

                {/* Policies List */}
                <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin">
                  {filteredPolicies.map((policy) => {
                    const isSelected = policy.id === selectedPolicyId;
                    const Icon = policy.icon || FiFileText;

                    return (
                      <button
                        key={policy.id}
                        onClick={() => handleSelectPolicy(policy.id)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-[#AE020B] text-white shadow-sm'
                            : isDarkMode
                              ? 'hover:bg-zinc-800/60 text-zinc-300'
                              : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : isDarkMode
                              ? 'bg-zinc-800 text-red-400'
                              : 'bg-red-50 text-[#AE020B]'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="font-bold text-xs truncate">
                              {policy.title}
                            </h4>
                            {isSelected && (
                              <FiCheckCircle size={13} className="shrink-0 text-white" />
                            )}
                          </div>
                          <p className={`text-[10px] mt-0.5 line-clamp-1 ${
                            isSelected ? 'text-white/80' : 'text-gray-400 dark:text-zinc-500'
                          }`}>
                            {policy.summary}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Return to Portal Selection */}
              <div className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
                isDarkMode ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'
              }`}>
                <div>
                  <h5 className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                    Ready to proceed?
                  </h5>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                    Return to the portal selection screen.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="px-3 py-1.5 bg-[#AE020B] hover:bg-[#8e0208] text-white text-xs font-bold rounded-lg transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  Go to Portal
                </button>
              </div>
            </aside>

            {/* Right Column: Active Policy Reader Document */}
            <main className="lg:col-span-8 min-w-0">
              <motion.article
                key={selectedPolicyId}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`rounded-3xl border shadow-sm p-6 sm:p-8 md:p-10 space-y-6 ${
                  isDarkMode ? 'bg-zinc-900/70 border-zinc-800' : 'bg-white border-gray-200'
                }`}
              >
                {/* Policy Header Banner */}
                <div className="border-b pb-6 border-gray-150 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#AE020B]/10 text-[#AE020B] flex items-center justify-center shrink-0">
                      <IconComponent size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          currentPortal === 'b2b'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}>
                          {activePolicyMeta.badge || 'Official Policy'}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500">
                          Last Updated: {selectedPolicyData.lastUpdated || 'June 2026'}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 dark:text-zinc-50 tracking-tight">
                        {selectedPolicyData.title || activePolicyMeta.title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => window.print()}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isDarkMode
                          ? 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 shadow-xs'
                      }`}
                    >
                      Print Policy
                    </button>
                  </div>
                </div>

                {/* Introduction Paragraph */}
                {selectedPolicyData.intro && (
                  <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed font-medium border ${
                    isDarkMode
                      ? 'bg-zinc-800/40 border-zinc-800 text-zinc-300'
                      : 'bg-gray-50/70 border-gray-100 text-gray-700'
                  }`}>
                    {selectedPolicyData.intro}
                  </div>
                )}

                {/* Policy Clauses & Sections */}
                <div className="space-y-8 pt-2">
                  {(() => {
                    const rawSections = selectedPolicyData?.sections;
                    const sectionsList = Array.isArray(rawSections)
                      ? rawSections.flat(Infinity).filter((s) => s && typeof s === 'object')
                      : [];

                    if (sectionsList.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-400">
                          <FiFileText size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Detailed policy clauses are available upon verified registration.</p>
                        </div>
                      );
                    }

                    return sectionsList.map((section, sIdx) => {
                      // Section could have 'heading' or 'title'
                      const heading = section.heading || section.title || `Section ${sIdx + 1}`;
                      const rawClauses = section.clauses || (section.content ? [section.content] : []);
                      const clauses = Array.isArray(rawClauses) ? rawClauses.flat(Infinity) : [String(rawClauses)];

                      return (
                        <section key={sIdx} className="space-y-3">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                            <span className="w-1.5 h-5 bg-[#AE020B] rounded-full shrink-0" />
                            {heading}
                          </h3>

                          <div className="space-y-2.5 pl-3.5">
                            {clauses.map((clause, cIdx) => {
                              const isBullet = typeof clause === 'string' && (clause.startsWith('•') || clause.startsWith('-'));
                              return (
                                <div
                                  key={cIdx}
                                  className={`text-xs sm:text-sm leading-relaxed ${
                                    isDarkMode ? 'text-zinc-300' : 'text-gray-600'
                                  } ${isBullet ? 'flex items-start gap-2' : ''}`}
                                >
                                  {isBullet && (
                                    <span className="text-[#AE020B] font-black select-none">•</span>
                                  )}
                                  <p className="whitespace-pre-line">
                                    {isBullet ? clause.replace(/^[•-]\s*/, '') : clause}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    });
                  })()}
                </div>

                {/* Footer Notice & Acceptance */}
                <div className="border-t border-gray-150 dark:border-zinc-800 pt-6 mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium">
                    {selectedPolicyData.footer || 'Peoples League Of Electronics Private Limited © 2026. All rights reserved.'}
                  </p>

                  <button
                    onClick={() => navigate('/')}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#AE020B] hover:bg-[#8e0208] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <FiCheckCircle size={14} />
                    <span>Accept & Return to Portal</span>
                  </button>
                </div>
              </motion.article>
            </main>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default PortalPoliciesHub;
