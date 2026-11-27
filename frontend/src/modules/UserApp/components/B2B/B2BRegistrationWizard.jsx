import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiEye, FiEyeOff, FiUploadCloud, FiTrash2, FiFileText, FiDownload, FiCheck, FiRefreshCw, FiEdit2, FiArrowLeft, FiArrowRight, FiBookmark, FiHelpCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../../../shared/utils/api';
import { useAuthStore } from '../../../../shared/store/authStore';
import { useB2bStore } from '../../../../shared/store/b2bStore';
import { useB2BAdminStore } from '../../../B2BAdmin/store/b2bAdminStore';

// Pages of the wizard. `step` is the logical step (1-4 are persisted in drafts, 5 = frontend-only review).
const PAGES = [
  { key: 'company', step: 1, title: 'Company Details', label: 'Basic information', subtitle: "Let's start with your business information." },
  { key: 'address', step: 1, title: 'Company Address', label: 'Registered address', subtitle: 'Tell us where your business is located.' },
  { key: 'bank', step: 1, title: 'Bank Details', label: 'Settlement account', subtitle: 'The bank account used for payments and verification.' },
  { key: 'gst', step: 1, title: 'GST & Agreement', label: 'Tax & agreement', subtitle: 'GST registration details and your signed platform agreement.' },
  { key: 'signatory', step: 2, title: 'Authorised Signatory', label: 'Signatory & authority', subtitle: 'Who is authorised to sign on behalf of the business.' },
  { key: 'admin', step: 3, title: 'Admin Information', label: 'Primary admin & security', subtitle: 'Set up the primary administrator of this account.' },
  { key: 'employees', step: 4, title: 'Employees', label: 'Team members (optional)', subtitle: 'Add team members who can use this business account.' },
  { key: 'review', step: 5, title: 'Review & Submit', label: 'Confirm and create account', subtitle: 'Check everything you have entered before submitting.' },
];
const GROUPS = [
  { step: 1, title: 'Company Details', desc: 'Business, address, bank & GST' },
  { step: 2, title: 'Authorised Signatory', desc: 'Signatory identity & authority' },
  { step: 3, title: 'Admin Information', desc: 'Primary admin & security' },
  { step: 4, title: 'Employees', desc: 'Add team members (optional)' },
  { step: 5, title: 'Review & Submit', desc: 'Confirm and create your account' },
];
const pagesOfStep = (st) => PAGES.map((p, i) => (p.step === st ? i : -1)).filter((i) => i >= 0);
const PAGE_BY_KEY = Object.fromEntries(PAGES.map((p, i) => [p.key, i]));

const SESSION_KEY = 'b2bDraftSession';
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const DOC_EXTS = ['pdf', 'jpg', 'jpeg', 'png'];
const DOC_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const mobileOk = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(d.length === 12 && d.startsWith('91') ? d.slice(2) : d);
};

const COMPANY_TYPE_DOC_CONFIG = {
  'Proprietorship': { label: 'Business Registration Proof / Shop & Establishment Certificate', hint: 'Shop Act License, Udyam / MSME Registration, or Municipal Trade License' },
  'Partnership Firm': { label: 'Partnership Deed / Registration Certificate', hint: 'Registered / Notarized Partnership Deed or Registrar of Firms Certificate' },
  'LLP (Limited Liability Partnership)': { label: 'LLP Agreement / Certificate of Incorporation (LLPIN)', hint: 'LLP Agreement (Form 3) or MCA Certificate of Incorporation' },
  'Private Limited Company': { label: 'Certificate of Incorporation (CIN / COI)', hint: 'MCA Certificate of Incorporation (CIN) or MOA & AOA' },
  'Public Limited Company': { label: 'Certificate of Incorporation (CIN / COI)', hint: 'MCA Certificate of Incorporation (CIN) or Commencement Certificate' },
  'One Person Company (OPC)': { label: 'Certificate of Incorporation (COI)', hint: 'MCA Certificate of Incorporation (CIN)' },
  'Other': { label: 'Company Registration / Incorporation Proof', hint: 'Official government/state business registration certificate' },
};

const initialForm = {
  companyName: '', businessType: '', companyRegistrationNumber: '', businessEmail: '', businessPhone: '', website: '',
  addrLine1: '', addrLine2: '', country: 'India', state: '', city: '', pincode: '',
  accountHolderName: '', bankName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', branchName: '',
  accountType: 'Current', bankDocType: 'cancelled_cheque',
  gstRegistered: '', gstNumber: '', gstLegalName: '', gstRegType: '', gstState: '',
  sigName: '', sigDesignation: '', sigEmail: '', sigMobile: '', sigDeclaration: false, sigDeclaredAt: '',
  sameAsSignatory: false, adminName: '', adminEmail: '', adminPhone: '', adminDesignation: '',
  password: '', confirmPassword: '', secretKey: '', confirmSecretKey: '',
};

const inputCls = (err) =>
  `w-full px-3.5 md:px-4 py-2.5 md:py-3 rounded-xl border-2 ${err ? 'border-red-400' : 'border-gray-200 dark:border-zinc-800'} focus:border-[#AE020B] bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:outline-none text-xs md:text-base`;
const labelCls = 'block text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1 md:mb-1.5';
const btnPrimary = 'bg-[#AE020B] hover:bg-[#8d0208] text-white py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm disabled:opacity-50';
const btnSecondary = 'border-2 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm disabled:opacity-50';

const Section = ({ title, children }) => (
  <div className="border-t first:border-t-0 first:pt-0 dark:border-zinc-800 pt-3 md:pt-4 space-y-3">
    <h3 className="text-xs md:text-sm font-bold text-[#AE020B] uppercase tracking-wide">{title}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-5 gap-y-3 md:gap-y-4 [&>*]:min-w-0">{children}</div>
  </div>
);

const Field = ({ label, required, error, name, full, children }) => (
  <div data-field={name} className={full ? 'md:col-span-2' : undefined}>
    <label className={labelCls}>{label} {required ? '*' : <span className="font-normal text-gray-400">(Optional)</span>}</label>
    {children}
    {error && <p className="mt-1 text-[11px] md:text-xs text-red-600" role="alert">{error}</p>}
  </div>
);

const DocUpload = ({ id, label, hint, doc, onChange, error, required = true }) => {
  const [progress, setProgress] = useState(null);
  const [localErr, setLocalErr] = useState('');
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setLocalErr('');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!DOC_EXTS.includes(ext) || !DOC_MIMES.includes(file.type)) {
      setLocalErr('Only PDF, JPG and PNG files are allowed.');
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setLocalErr('Maximum file size is 5 MB.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setProgress(0);
    try {
      const res = await api.post('/b2b-user/auth/upload-registration-doc', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      const data = res?.data || res;
      if (!data?.url) throw new Error('Upload failed.');
      onChange(data);
    } catch (err) {
      setLocalErr(err?.response?.data?.message || err?.message || 'Upload failed. Please try again.');
    } finally {
      setProgress(null);
    }
  };

  const shownErr = localErr || error;
  return (
    <div className="md:col-span-2 p-3 bg-gray-50 dark:bg-zinc-900/60 rounded-xl border border-gray-200 dark:border-zinc-800 space-y-2" data-field={id}>
      <label className="block text-xs font-bold text-gray-800 dark:text-zinc-200">{label} {required ? '*' : '(Optional)'}</label>
      {hint && <p className="text-[11px] text-gray-500 dark:text-zinc-400">{hint}</p>}
      <input ref={inputRef} id={id} data-testid={id} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden"
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      {!doc && progress === null && (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-[#AE020B] rounded-xl p-3 text-center">
          <FiUploadCloud className="text-xl text-gray-400 mx-auto mb-1" />
          <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">Click to upload</span>
          <span className="block text-[10px] text-gray-400">PDF, JPG or PNG (Max 5 MB)</span>
        </button>
      )}
      {progress !== null && (
        <div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-[#AE020B]" style={{ width: `${progress}%` }} /></div>
          <p className="text-[11px] text-blue-500 font-semibold mt-1">Uploading... {progress}%</p>
        </div>
      )}
      {doc && (
        <div className="bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {doc.mimeType?.startsWith('image/')
              ? <img src={doc.url} alt="preview" className="w-10 h-10 object-cover rounded" />
              : <FiFileText className="text-lg text-[#AE020B] shrink-0" />}
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 truncate" data-testid={`${id}-name`}>{doc.fileName}</p>
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline">Preview</a>
              <span className="text-[10px] text-emerald-600 font-semibold ml-2"><FiCheck className="inline" /> Uploaded</span>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button type="button" title="Replace" onClick={() => inputRef.current?.click()} className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><FiRefreshCw /></button>
            <button type="button" title="Remove" onClick={() => onChange(null)} className="p-1.5 text-red-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"><FiTrash2 /></button>
          </div>
        </div>
      )}
      {shownErr && <p className="text-[11px] md:text-xs text-red-600" role="alert">{shownErr}</p>}
    </div>
  );
};

const PasswordInput = ({ name, value, onChange, error, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} name={name} value={value} onChange={onChange} placeholder={placeholder} className={`${inputCls(error)} pr-10`} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Toggle visibility">
        {show ? <FiEyeOff size={18} /> : <FiEye size={18} />}
      </button>
    </div>
  );
};

const B2BRegistrationWizard = () => {
  const navigate = useNavigate();
  const { register: registerB2BAdminAPI, login: loginB2B, isLoading } = useB2BAdminStore();

  const [page, setPage] = useState(0);
  const [donePages, setDonePages] = useState([]);
  const step = PAGES[page].step;
  const current = PAGES[page];
  // logical steps (1-4) whose pages are all done - this is what drafts persist
  const completed = [1, 2, 3, 4].filter((st) => pagesOfStep(st).every((i) => donePages.includes(i)));
  const [form, setForm] = useState(initialForm);
  const [docs, setDocs] = useState({});
  const [employees, setEmployees] = useState([]);
  const [empInput, setEmpInput] = useState({ name: '', email: '', phone: '', designation: '', department: '', address: '', password: '' });
  const [empConfirm, setEmpConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [agreementUploading, setAgreementUploading] = useState(false);
  const [draftToken, setDraftToken] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [resume, setResume] = useState({ open: false, email: '', otp: '', sent: false, busy: false, msg: '' });
  const agreementRef = useRef(null);

  const set = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => (p[name] ? { ...p, [name]: undefined } : p));
  };
  const onChange = (e) => set(e.target.name, e.target.value);
  const setDoc = (key) => (doc) => {
    setDocs((p) => ({ ...p, [key]: doc || undefined }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  useEffect(() => {
    api.get('/agreement-template/active')
      .then((res) => {
        const t = res?.data || res;
        if (t && (t.url || t._id)) setActiveTemplate(t);
      })
      .catch(() => {});
  }, []);

  const applyDraft = (draft, token) => {
    setForm({ ...initialForm, ...(draft.data?.form || {}) });
    setDocs(draft.data?.docs || {});
    setEmployees(draft.data?.employees || []);
    const doneSteps = draft.completedSteps || [];
    setDonePages(doneSteps.flatMap((st) => pagesOfStep(st)));
    setPage(pagesOfStep(Math.min(Math.max(draft.currentStep || 1, 1), 4))[0] ?? 0);
    setDraftToken(token);
    setLastSaved(draft.updatedAt);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email: draft.email, token })); } catch { /* ignore */ }
  };

  // Resume from the emailed link (?resume=<token>&email=<email>). Takes priority over the
  // same-browser session; the token is removed from the address bar straight away.
  // Read once on mount; the URL is cleaned with history.replaceState (not a router navigation)
  // so the wizard is not remounted while the draft is loading.
  const [{ linkToken, linkEmail }] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return { linkToken: p.get('resume'), linkEmail: p.get('email') };
  });
  const linkHandled = useRef(false); // the link is single-use: never submit it twice (e.g. StrictMode)
  useEffect(() => {
    if (!linkToken || !linkEmail || linkHandled.current) return;
    linkHandled.current = true;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('resume');
      url.searchParams.delete('email');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch { /* ignore */ }
    api.post('/b2b-user/auth/draft/resume-link', { email: linkEmail, token: linkToken })
      .then((res) => {
        applyDraft(res.data, res.data.draftToken);
        toast.success(`Welcome back! Continuing your registration at step ${res.data.currentStep || 1}. Re-enter passwords and secret keys when you get to them.`);
      })
      .catch((err) => {
        // Link used/expired: if this browser already holds the draft, just restore it.
        if (restoreSession()) return;
        toast.error(err?.response?.data?.message || 'This link is invalid or has expired.');
        setResume((r) => ({ ...r, open: true, email: linkEmail }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same-browser resume using the saved ownership token. Returns false if there is none.
  function restoreSession() {
    let session = null;
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { /* ignore */ }
    if (!session?.email || !session?.token) return false;
    api.post('/b2b-user/auth/draft/load', { email: session.email, draftToken: session.token })
      .then((res) => {
        applyDraft(res.data, session.token);
        toast.success('Your saved registration was restored.');
      })
      .catch(() => { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } });
    return true;
  }
  useEffect(() => {
    if (linkToken && linkEmail) return;
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- validation ---------------- */
  const req = (v) => String(v ?? '').trim().length > 0;
  const validate = (key) => {
    const e = {};
    if (key === 'company') {
      if (!req(form.companyName)) e.companyName = 'Company name is required.';
      if (!req(form.businessType)) e.businessType = 'Business type is required.';
      if (!EMAIL_REGEX.test(form.businessEmail.trim())) e.businessEmail = 'Enter a valid company email.';
      if (!mobileOk(form.businessPhone)) e.businessPhone = 'Enter a valid 10-digit contact number.';
      if (!docs.companyRegistrationProof) e.companyRegistrationProof = 'Registration proof is required.';
    }
    if (key === 'address') {
      if (!req(form.addrLine1)) e.addrLine1 = 'Address Line 1 is required.';
      if (!req(form.country)) e.country = 'Country is required.';
      if (!req(form.state)) e.state = 'State is required.';
      if (!req(form.city)) e.city = 'City is required.';
      if (!/^[1-9][0-9]{5}$/.test(form.pincode.trim())) e.pincode = 'Enter a valid 6-digit pincode.';
      if (!docs.addressProof) e.addressProof = 'Address proof is required.';
    }
    if (key === 'bank') {
      if (!req(form.accountHolderName)) e.accountHolderName = 'Account holder name is required.';
      if (!req(form.bankName)) e.bankName = 'Bank name is required.';
      if (!/^[0-9]{9,18}$/.test(form.accountNumber.trim())) e.accountNumber = 'Account number must be 9-18 digits.';
      if (form.accountNumber !== form.confirmAccountNumber) e.confirmAccountNumber = 'Account numbers do not match.';
      if (!IFSC_REGEX.test(form.ifscCode.trim().toUpperCase())) e.ifscCode = 'Invalid IFSC code (e.g. HDFC0001234).';
      if (!req(form.branchName)) e.branchName = 'Branch name is required.';
      if (!docs.bankDocument) e.bankDocument = `Upload your ${form.bankDocType === 'bank_statement' ? 'bank statement' : 'cancelled cheque'}.`;
    }
    if (key === 'gst') {
      if (form.gstRegistered === '') e.gstRegistered = 'Please select Yes or No.';
      if (form.gstRegistered === 'yes') {
        if (!GST_REGEX.test(form.gstNumber.trim().toUpperCase())) e.gstNumber = 'Enter a valid 15-character GSTIN.';
        if (!req(form.gstLegalName)) e.gstLegalName = 'Legal business name is required.';
        if (!docs.gstCertificate) e.gstCertificate = 'GST certificate is required.';
      }
      if (!docs.acceptanceExecutionDocument) e.acceptanceExecutionDocument = 'Upload the signed Acceptance & Execution Agreement.';
    }
    if (key === 'signatory') {
      if (!req(form.sigName)) e.sigName = 'Full legal name is required.';
      if (!req(form.sigDesignation)) e.sigDesignation = 'Designation is required.';
      if (!EMAIL_REGEX.test(form.sigEmail.trim())) e.sigEmail = 'Enter a valid official email.';
      if (!mobileOk(form.sigMobile)) e.sigMobile = 'Enter a valid 10-digit mobile number.';
      if (!docs.sigIdentity) e.sigIdentity = 'Identity document is required.';
      if (!docs.sigAuthorisation) e.sigAuthorisation = 'Authorisation document is required.';
      if (!form.sigDeclaration) e.sigDeclaration = 'You must accept the declaration to continue.';
    }
    if (key === 'admin') {
      if (!req(form.adminName)) e.adminName = 'Admin name is required.';
      if (!EMAIL_REGEX.test(form.adminEmail.trim())) e.adminEmail = 'Enter a valid admin email.';
      if (!mobileOk(form.adminPhone)) e.adminPhone = 'Enter a valid 10-digit mobile number.';
      if (!PASSWORD_REGEX.test(form.password)) e.password = 'Min 8 characters with upper-case, lower-case and a number.';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
      if (form.secretKey.length < 6) e.secretKey = 'Secret key must be at least 6 characters.';
      if (form.secretKey !== form.confirmSecretKey) e.confirmSecretKey = 'Secret keys do not match.';
    }
    if (key === 'employees') {
      employees.forEach((emp, i) => {
        if (!emp.password || emp.password.length < 6) e[`emp${i}`] = 'Password required (min 6 characters).';
      });
    }
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error('Please fix the highlighted fields.');
      setTimeout(() => {
        const first = Object.keys(e)[0];
        document.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
      return false;
    }
    return true;
  };

  const next = () => {
    if (!validate(current.key)) return;
    setDonePages((p) => [...new Set([...p, page])]);
    setPage(page + 1);
    window.scrollTo({ top: 0 });
  };
  const back = () => { setErrors({}); setPage(Math.max(0, page - 1)); window.scrollTo({ top: 0 }); };
  // Sidebar / review jumps: only to pages already reached.
  const maxReached = Math.max(page, ...donePages.map((i) => i + 1), 0);
  const goTo = (i) => {
    if (i > maxReached || i === page) return;
    setErrors({});
    setPage(i);
    window.scrollTo({ top: 0 });
  };

  /* ---------------- GST / same-as handlers ---------------- */
  const chooseGst = (val) => {
    setForm((p) => ({
      ...p,
      gstRegistered: val,
      ...(val === 'no' ? { gstNumber: '', gstLegalName: '', gstRegType: '', gstState: '' } : {}),
    }));
    if (val === 'no') setDocs((p) => ({ ...p, gstCertificate: undefined }));
    setErrors((p) => ({ ...p, gstRegistered: undefined, gstNumber: undefined, gstLegalName: undefined, gstCertificate: undefined }));
  };

  const toggleSame = (checked) => {
    setForm((p) => ({
      ...p,
      sameAsSignatory: checked,
      ...(checked ? { adminName: p.sigName, adminEmail: p.sigEmail, adminPhone: p.sigMobile, adminDesignation: p.sigDesignation } : {}),
    }));
  };

  const toggleDeclaration = (checked) => {
    setForm((p) => ({ ...p, sigDeclaration: checked, sigDeclaredAt: checked ? new Date().toISOString() : '' }));
    setErrors((p) => ({ ...p, sigDeclaration: undefined }));
  };

  /* ---------------- agreement upload (existing mandatory doc, PDF only) ---------------- */
  const uploadAgreement = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') return toast.error('Only PDF files are allowed.');
    if (file.size > 10 * 1024 * 1024) return toast.error('Maximum file size is 10 MB.');
    setAgreementUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/b2b-user/auth/upload-agreement', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = res?.data || res;
      if (!data?.url) throw new Error('Upload failed.');
      setDoc('acceptanceExecutionDocument')(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to upload signed agreement.');
    } finally {
      setAgreementUploading(false);
    }
  };

  /* ---------------- employees ---------------- */
  const addEmployee = () => {
    const emp = empInput;
    if (!emp.name || !emp.email || !emp.phone || !emp.designation || !emp.password) return toast.error('All employee fields including password are required.');
    if (!EMAIL_REGEX.test(emp.email)) return toast.error('Please enter a valid employee email.');
    if (emp.password !== empConfirm) return toast.error('Employee passwords do not match.');
    if (employees.some((x) => x.email.toLowerCase() === emp.email.toLowerCase())) return toast.error('Employee with this email already added.');
    setEmployees((p) => [...p, { ...emp }]);
    setEmpInput({ name: '', email: '', phone: '', designation: '', department: '', address: '', password: '' });
    setEmpConfirm('');
    toast.success('Employee added successfully!');
  };

  /* ---------------- drafts ---------------- */
  const buildDraftBody = () => ({
    email: form.businessEmail.trim().toLowerCase(),
    draftToken: draftToken || undefined,
    currentStep: Math.min(step, 4),
    completedSteps: completed,
    data: { form, docs, employees },
  });

  const saveDraft = async () => {
    if (!EMAIL_REGEX.test(form.businessEmail.trim())) {
      setErrors((p) => ({ ...p, businessEmail: 'Enter your company email to save a draft.' }));
      if (page !== 0) setPage(0);
      return toast.error('Enter your company email (Step 1) to save a draft.');
    }
    setSavingDraft(true);
    try {
      const res = await api.post('/b2b-user/auth/draft/save', buildDraftBody());
      const d = res?.data || {};
      const token = d.draftToken || draftToken;
      setDraftToken(token);
      setLastSaved(d.updatedAt);
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email: form.businessEmail.trim().toLowerCase(), token })); } catch { /* ignore */ }
      toast.success(d.resumeLinkSent
        ? `Draft saved. We emailed a link to ${form.businessEmail.trim()} so you can continue later from any device. Passwords and secret keys are not stored.`
        : 'Draft saved. Passwords and secret keys are not stored - re-enter them when you resume.', { duration: 6000 });
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || 'Could not save draft.';
      toast.error(msg);
      if (status === 409 && /draft already exists/i.test(msg)) {
        setResume((r) => ({ ...r, open: true, email: form.businessEmail.trim().toLowerCase() }));
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const requestOtp = async () => {
    setResume((r) => ({ ...r, busy: true, msg: '' }));
    try {
      const res = await api.post('/b2b-user/auth/draft/request-otp', { email: resume.email });
      setResume((r) => ({ ...r, sent: true, busy: false, msg: res?.message || 'Code sent if a draft exists.' }));
    } catch (err) {
      setResume((r) => ({ ...r, busy: false, msg: err?.response?.data?.message || 'Could not send code.' }));
    }
  };

  const requestLink = async () => {
    setResume((r) => ({ ...r, busy: true, msg: '' }));
    try {
      const res = await api.post('/b2b-user/auth/draft/send-link', { email: resume.email });
      setResume((r) => ({ ...r, busy: false, linkSent: true, msg: res?.message || 'If a saved registration exists, we emailed you a link.' }));
    } catch (err) {
      setResume((r) => ({ ...r, busy: false, msg: err?.response?.data?.message || 'Could not send the link.' }));
    }
  };

  const verifyOtp = async () => {
    setResume((r) => ({ ...r, busy: true, msg: '' }));
    try {
      const res = await api.post('/b2b-user/auth/draft/verify-otp', { email: resume.email, otp: resume.otp });
      applyDraft(res.data, res.data.draftToken);
      setResume({ open: false, email: '', otp: '', sent: false, busy: false, msg: '' });
      toast.success('Draft restored. Continue where you left off.');
    } catch (err) {
      setResume((r) => ({ ...r, busy: false, msg: err?.response?.data?.message || 'Invalid or expired code.' }));
    }
  };

  /* ---------------- submit ---------------- */
  const submit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    // Enter pressed on an intermediate page just moves forward; only the review page submits.
    if (current.key !== 'review') { next(); return; }
    for (const k of ['company', 'address', 'bank', 'gst', 'signatory', 'admin', 'employees']) {
      if (!validate(k)) { setPage(PAGE_BY_KEY[k]); return; }
    }
    const bankDocType = form.bankDocType;
    const payload = {
      version: 2,
      draftToken: draftToken || undefined,
      companyData: {
        companyName: form.companyName.trim(),
        businessType: form.businessType,
        companyRegistrationNumber: form.companyRegistrationNumber.trim(),
        businessEmail: form.businessEmail.trim(),
        businessPhone: form.businessPhone.trim(),
        website: form.website.trim(),
        secretKey: form.secretKey,
        addressDetails: { line1: form.addrLine1.trim(), line2: form.addrLine2.trim(), country: form.country, state: form.state.trim(), city: form.city.trim(), pincode: form.pincode.trim() },
        addressProof: docs.addressProof,
        bankDetails: {
          accountHolderName: form.accountHolderName.trim(), bankName: form.bankName.trim(), accountNumber: form.accountNumber.trim(),
          ifscCode: form.ifscCode.trim().toUpperCase(), branchName: form.branchName.trim(), accountType: form.accountType,
        },
        bankDocumentType: bankDocType,
        bankDocument: docs.bankDocument,
        gstRegistered: form.gstRegistered === 'yes',
        ...(form.gstRegistered === 'yes'
          ? { gstNumber: form.gstNumber.trim().toUpperCase(), gstDetails: { legalName: form.gstLegalName.trim(), registrationType: form.gstRegType, state: form.gstState.trim() }, gstCertificate: docs.gstCertificate }
          : {}),
        companyRegistrationProof: docs.companyRegistrationProof,
        acceptanceExecutionDocument: docs.acceptanceExecutionDocument,
      },
      signatoryData: {
        fullName: form.sigName.trim(), designation: form.sigDesignation, email: form.sigEmail.trim(), mobile: form.sigMobile.trim(),
        identityDocument: docs.sigIdentity, authorisationDocument: docs.sigAuthorisation, declarationAccepted: form.sigDeclaration,
      },
      adminData: {
        adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim(), adminPhone: form.adminPhone.trim(),
        designation: form.adminDesignation, sameAsSignatory: form.sameAsSignatory, password: form.password, confirmPassword: form.confirmPassword,
      },
      employees,
    };

    const success = await registerB2BAdminAPI(payload);
    if (!success) {
      toast.error(useB2BAdminStore.getState().error || 'Registration failed. Please try again.');
      return;
    }
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    toast.success('Company Registration Successful!');
    const skipped = useB2BAdminStore.getState().lastRegistrationSkippedEmployees || [];
    if (skipped.length) {
      toast.error(`${skipped.length} employee(s) could not be added: ${skipped.map((e) => `${e.email} (${e.reason})`).join('; ')}. You can add them later from Employee Management.`, { duration: 10000 });
    }
    try {
      const loginResult = await loginB2B({ businessEmail: form.adminEmail, password: form.password });
      if (loginResult?.success || loginResult === true) {
        const { adminProfile } = useB2BAdminStore.getState();
        useB2bStore.getState().setUserRole('business_buyer');
        const token = localStorage.getItem('b2bAdminToken') || sessionStorage.getItem('b2bAdminToken');
        if (token) {
          localStorage.setItem('token', token);
          sessionStorage.setItem('token', token);
          useAuthStore.setState({ isAuthenticated: true, token, user: adminProfile });
        }
        navigate('/home', { replace: true });
        return;
      }
      // Normal case right after registering: the company is waiting for approval.
      if (loginResult?.error) toast(loginResult.error, { icon: 'ℹ️', duration: 8000 });
    } catch (loginErr) {
      console.error('Auto login after B2B registration failed:', loginErr);
    }
    navigate('/b2b/login', { replace: true });
  };

  /* ---------------- render ---------------- */
  const typeCfg = COMPANY_TYPE_DOC_CONFIG[form.businessType];
  const radio = (name, value, label, checked, onSel, testId) => (
    <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer text-xs md:text-sm ${checked ? 'border-[#AE020B] bg-red-50/40 dark:bg-red-950/20' : 'border-gray-200 dark:border-zinc-800'}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onSel(value)} data-testid={testId} />
      {label}
    </label>
  );

  const docLink = (d) => (d ? (
    <span className="inline-flex items-center gap-2 min-w-0">
      <FiFileText className="text-[#AE020B] shrink-0" />
      <span className="truncate">{d.fileName || 'Uploaded document'}</span>
      {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline shrink-0">Preview</a>}
    </span>
  ) : null);
  const mask = (v) => (v ? `${'•'.repeat(Math.max(String(v).length - 4, 0))}${String(v).slice(-4)}` : '');

  // One block of the review page: a titled card with an Edit button and label/value rows.
  const reviewBlock = (title, pageKey, rows) => (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/60 overflow-hidden" data-testid={`review-${pageKey}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{title}</h3>
        <button type="button" onClick={() => goTo(PAGE_BY_KEY[pageKey])} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#AE020B] dark:text-red-400 hover:underline">
          <FiEdit2 /> Edit
        </button>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 p-4">
        {rows.filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-zinc-500">{label}</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-zinc-100 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const groupState = (g) => {
    const idx = g.step === 5 ? [PAGE_BY_KEY.review] : pagesOfStep(g.step);
    const active = idx.includes(page);
    const done = g.step !== 5 && idx.every((i) => donePages.includes(i));
    const reachable = idx[0] <= maxReached;
    return { idx, active, done, reachable };
  };

  const resumeLabel = (
    <div className="flex items-center justify-between text-[11px] mb-5">
      <button type="button" onClick={() => setResume((r) => ({ ...r, open: !r.open, email: r.email || form.businessEmail }))} className="text-[#AE020B] dark:text-red-400 font-bold hover:underline" data-testid="resume-toggle">
        Resume a saved registration
      </button>
      {lastSaved && <span className="text-gray-400">Draft saved {new Date(lastSaved).toLocaleTimeString()}</span>}
    </div>
  );

  const formBody = (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {resumeLabel}

      {resume.open && (
        <div className="p-3 border border-gray-200 dark:border-zinc-800 rounded-xl space-y-2 bg-gray-50 dark:bg-zinc-900" data-testid="resume-panel">
          <input type="email" value={resume.email} onChange={(e) => setResume((r) => ({ ...r, email: e.target.value }))} placeholder="Company email used for the draft" className={inputCls(false)} data-testid="resume-email" />
          {!resume.sent ? (
            <div className="flex gap-2">
              <button type="button" disabled={resume.busy || !EMAIL_REGEX.test(resume.email)} onClick={requestOtp} className={`${btnPrimary} flex-1`} data-testid="resume-send">
                {resume.busy ? 'Sending...' : 'Send verification code'}
              </button>
              <button type="button" disabled={resume.busy || !EMAIL_REGEX.test(resume.email)} onClick={requestLink} className={`${btnSecondary} flex-1`} data-testid="resume-send-link">
                Email me a link
              </button>
            </div>
          ) : (
            <>
              <input type="text" inputMode="numeric" maxLength={6} value={resume.otp} onChange={(e) => setResume((r) => ({ ...r, otp: e.target.value.replace(/\D/g, '') }))} placeholder="6-digit code" className={inputCls(false)} data-testid="resume-otp" />
              <div className="flex gap-2">
                <button type="button" disabled={resume.busy || resume.otp.length !== 6} onClick={verifyOtp} className={`${btnPrimary} flex-1`} data-testid="resume-verify">
                  {resume.busy ? 'Verifying...' : 'Verify & resume'}
                </button>
                <button type="button" disabled={resume.busy} onClick={requestOtp} className={`${btnSecondary} flex-1`}>Resend code</button>
              </div>
            </>
          )}
          {resume.msg && <p className="text-[11px] text-gray-600 dark:text-zinc-400" role="status" data-testid="resume-msg">{resume.msg}</p>}
        </div>
      )}

      {page === 0 && (
        <div className="space-y-4">
          <Section title="Basic Company Information">
            <Field label="Company / Business Name" required name="companyName" error={errors.companyName}>
              <input name="companyName" value={form.companyName} onChange={onChange} className={inputCls(errors.companyName)} placeholder="Apex General Enterprises" />
            </Field>
            <Field label="Business Type" required name="businessType" error={errors.businessType}>
              <select name="businessType" value={form.businessType} onChange={onChange} className={inputCls(errors.businessType)}>
                <option value="">Select Business Type</option>
                {Object.keys(COMPANY_TYPE_DOC_CONFIG).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            {form.businessType && (
              <DocUpload id="companyRegistrationProof" label={typeCfg?.label || 'Company Registration Proof'} hint={typeCfg?.hint}
                doc={docs.companyRegistrationProof} onChange={setDoc('companyRegistrationProof')} error={errors.companyRegistrationProof} />
            )}
            <Field label="Company Registration Number" name="companyRegistrationNumber" error={errors.companyRegistrationNumber}>
              <input name="companyRegistrationNumber" value={form.companyRegistrationNumber} onChange={onChange} className={inputCls()} placeholder="CIN / LLPIN / Registration No." />
            </Field>
            <Field label="Company Email" required name="businessEmail" error={errors.businessEmail}>
              <input type="email" name="businessEmail" value={form.businessEmail} onChange={onChange} className={inputCls(errors.businessEmail)} placeholder="procurement@apexenterprises.in" />
            </Field>
            <Field label="Company Contact Number" required name="businessPhone" error={errors.businessPhone}>
              <input type="tel" name="businessPhone" value={form.businessPhone} onChange={onChange} className={inputCls(errors.businessPhone)} placeholder="9876543210" />
            </Field>
            <Field label="Website" name="website">
              <input name="website" value={form.website} onChange={onChange} className={inputCls()} placeholder="https://apexenterprises.in" />
            </Field>
          </Section>

        </div>
      )}

      {page === 1 && (
        <div className="space-y-4">
          <Section title="Company Address">
            <Field full label="Address Line 1" required name="addrLine1" error={errors.addrLine1}>
              <input name="addrLine1" value={form.addrLine1} onChange={onChange} className={inputCls(errors.addrLine1)} placeholder="404 Business Hub" />
            </Field>
            <Field full label="Address Line 2" name="addrLine2">
              <input name="addrLine2" value={form.addrLine2} onChange={onChange} className={inputCls()} placeholder="BKC" />
            </Field>
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-x-5">
              <Field label="Country" required name="country" error={errors.country}>
                <input name="country" value={form.country} onChange={onChange} className={inputCls(errors.country)} />
              </Field>
              <Field label="State" required name="state" error={errors.state}>
                <input name="state" value={form.state} onChange={onChange} className={inputCls(errors.state)} placeholder="Maharashtra" />
              </Field>
              <Field label="City" required name="city" error={errors.city}>
                <input name="city" value={form.city} onChange={onChange} className={inputCls(errors.city)} placeholder="Mumbai" />
              </Field>
              <Field label="Pincode" required name="pincode" error={errors.pincode}>
                <input name="pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={onChange} className={inputCls(errors.pincode)} placeholder="400051" />
              </Field>
            </div>
            <DocUpload id="addressProof" label="Address Proof" hint="Utility bill, rent agreement, or any official address proof"
              doc={docs.addressProof} onChange={setDoc('addressProof')} error={errors.addressProof} />
          </Section>

        </div>
      )}

      {page === 2 && (
        <div className="space-y-4">
          <Section title="Bank Details">
            <Field label="Account Holder Name" required name="accountHolderName" error={errors.accountHolderName}>
              <input name="accountHolderName" value={form.accountHolderName} onChange={onChange} className={inputCls(errors.accountHolderName)} />
            </Field>
            <Field label="Bank Name" required name="bankName" error={errors.bankName}>
              <input name="bankName" value={form.bankName} onChange={onChange} className={inputCls(errors.bankName)} />
            </Field>
            <Field label="Account Number" required name="accountNumber" error={errors.accountNumber}>
              <input name="accountNumber" inputMode="numeric" value={form.accountNumber} onChange={onChange} className={inputCls(errors.accountNumber)} />
            </Field>
            <Field label="Confirm Account Number" required name="confirmAccountNumber" error={errors.confirmAccountNumber}>
              <input name="confirmAccountNumber" inputMode="numeric" value={form.confirmAccountNumber} onChange={onChange} onPaste={(e) => e.preventDefault()} className={inputCls(errors.confirmAccountNumber)} />
            </Field>
            <div className="contents">
              <Field label="IFSC Code" required name="ifscCode" error={errors.ifscCode}>
                <input name="ifscCode" value={form.ifscCode} onChange={(e) => set('ifscCode', e.target.value.toUpperCase())} maxLength={11} className={`${inputCls(errors.ifscCode)} font-mono`} placeholder="HDFC0001234" />
              </Field>
              <Field label="Account Type" required name="accountType" error={errors.accountType}>
                <select name="accountType" value={form.accountType} onChange={onChange} className={inputCls()}>
                  <option>Current</option><option>Savings</option><option>Other</option>
                </select>
              </Field>
            </div>
            <Field label="Branch Name" required name="branchName" error={errors.branchName}>
              <input name="branchName" value={form.branchName} onChange={onChange} className={inputCls(errors.branchName)} />
            </Field>
            <div data-field="bankDocType" className="md:col-span-2">
              <p className={labelCls}>Bank Document *</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {radio('bankDocType', 'cancelled_cheque', 'Cancelled Cheque', form.bankDocType === 'cancelled_cheque', (v) => { set('bankDocType', v); setDoc('bankDocument')(null); }, 'bankdoc-cheque')}
                {radio('bankDocType', 'bank_statement', 'Bank Statement', form.bankDocType === 'bank_statement', (v) => { set('bankDocType', v); setDoc('bankDocument')(null); }, 'bankdoc-statement')}
              </div>
              <DocUpload id="bankDocument" label={form.bankDocType === 'bank_statement' ? 'Upload Bank Statement' : 'Upload Cancelled Cheque'}
                doc={docs.bankDocument} onChange={setDoc('bankDocument')} error={errors.bankDocument} />
            </div>
          </Section>

        </div>
      )}

      {page === 3 && (
        <div className="space-y-4">
          <Section title="GST Details">
            <div data-field="gstRegistered" className="md:col-span-2">
              <p className={labelCls}>Do you have GST registration? *</p>
              <div className="flex flex-wrap gap-2">
                {radio('gstRegistered', 'yes', 'Yes, I have GST.', form.gstRegistered === 'yes', chooseGst, 'gst-yes')}
                {radio('gstRegistered', 'no', "No, I don't have GST.", form.gstRegistered === 'no', chooseGst, 'gst-no')}
              </div>
              {errors.gstRegistered && <p className="mt-1 text-[11px] md:text-xs text-red-600" role="alert">{errors.gstRegistered}</p>}
            </div>
            {form.gstRegistered === 'yes' && (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 md:gap-x-5 gap-y-3 md:gap-y-4" data-testid="gst-fields">
                <Field label="GST Number" required name="gstNumber" error={errors.gstNumber}>
                  <input name="gstNumber" value={form.gstNumber} onChange={(e) => set('gstNumber', e.target.value.toUpperCase())} maxLength={15} className={`${inputCls(errors.gstNumber)} font-mono`} placeholder="27AAPCG9838F1Z1" />
                </Field>
                <Field label="Legal Business Name" required name="gstLegalName" error={errors.gstLegalName}>
                  <input name="gstLegalName" value={form.gstLegalName} onChange={onChange} className={inputCls(errors.gstLegalName)} />
                </Field>
                <div className="contents">
                  <Field label="GST Registration Type" name="gstRegType">
                    <select name="gstRegType" value={form.gstRegType} onChange={onChange} className={inputCls()}>
                      <option value="">Select</option><option>Regular</option><option>Composition</option><option>Other</option>
                    </select>
                  </Field>
                  <Field label="State / Jurisdiction" name="gstState">
                    <input name="gstState" value={form.gstState} onChange={onChange} className={inputCls()} />
                  </Field>
                </div>
                <DocUpload id="gstCertificate" label="GST Certificate" doc={docs.gstCertificate} onChange={setDoc('gstCertificate')} error={errors.gstCertificate} />
              </div>
            )}
          </Section>

          <Section title="Acceptance & Execution Agreement">
            <p className="md:col-span-2 text-[11px] md:text-xs text-gray-500 dark:text-zinc-400">Download the Platform Agreement template, sign it with your company seal, and upload the signed PDF.</p>
            {activeTemplate ? (
              <a href={activeTemplate.url} target="_blank" rel="noopener noreferrer" className="md:col-span-2 justify-self-start inline-flex items-center gap-1 text-xs font-bold text-white bg-[#AE020B] px-3 py-1.5 rounded-lg"><FiDownload /> Download template</a>
            ) : (
              <p className="md:col-span-2 text-[11px] text-amber-600 font-semibold">Platform Agreement template is not configured yet. Please contact support.</p>
            )}
            <div data-field="acceptanceExecutionDocument" className="md:col-span-2 p-3 bg-gray-50 dark:bg-zinc-900/60 rounded-xl border border-gray-200 dark:border-zinc-800 space-y-2">
              <input ref={agreementRef} type="file" accept=".pdf,application/pdf" className="hidden" data-testid="agreement-input" onChange={(e) => { uploadAgreement(e.target.files?.[0]); e.target.value = ''; }} />
              {!docs.acceptanceExecutionDocument ? (
                <button type="button" onClick={() => agreementRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl p-3 text-xs font-bold text-gray-700 dark:text-zinc-300">
                  {agreementUploading ? 'Uploading...' : 'Upload signed agreement (PDF, max 10 MB)'}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate"><FiFileText className="inline text-[#AE020B]" /> {docs.acceptanceExecutionDocument.fileName}</span>
                  <button type="button" onClick={() => setDoc('acceptanceExecutionDocument')(null)} className="text-red-500 p-1.5" title="Remove"><FiTrash2 /></button>
                </div>
              )}
              {errors.acceptanceExecutionDocument && <p className="text-[11px] md:text-xs text-red-600" role="alert">{errors.acceptanceExecutionDocument}</p>}
            </div>
          </Section>
        </div>
      )}

      {/* ---------------- STEP 2 ---------------- */}
      {page === 4 && (
        <div className="space-y-4">
          <Section title="A. Personal Information">
            <Field label="Full Legal Name" required name="sigName" error={errors.sigName}>
              <input name="sigName" value={form.sigName} onChange={onChange} className={inputCls(errors.sigName)} />
            </Field>
            <Field label="Designation" required name="sigDesignation" error={errors.sigDesignation}>
              <select name="sigDesignation" value={form.sigDesignation} onChange={onChange} className={inputCls(errors.sigDesignation)}>
                <option value="">Select designation</option>
                <option>Director</option><option>Partner</option><option>Proprietor</option><option>Managing Director</option><option>Authorised Representative</option><option>Other</option>
              </select>
            </Field>
            <Field label="Official Email" required name="sigEmail" error={errors.sigEmail}>
              <input type="email" name="sigEmail" value={form.sigEmail} onChange={onChange} className={inputCls(errors.sigEmail)} />
            </Field>
            <Field label="Mobile Number" required name="sigMobile" error={errors.sigMobile}>
              <input type="tel" name="sigMobile" value={form.sigMobile} onChange={onChange} className={inputCls(errors.sigMobile)} placeholder="9876543210" />
            </Field>
          </Section>
          <Section title="B. Identity Verification">
            <DocUpload id="sigIdentity" label="Upload PAN / Accepted Government Identity Document" doc={docs.sigIdentity} onChange={setDoc('sigIdentity')} error={errors.sigIdentity} />
          </Section>
          <Section title="C. Authorisation Document">
            <DocUpload id="sigAuthorisation" label="Upload Board Resolution / Authorisation Letter / Applicable Authority Proof" doc={docs.sigAuthorisation} onChange={setDoc('sigAuthorisation')} error={errors.sigAuthorisation} />
          </Section>
          <Section title="D. Declaration">
            <label className="md:col-span-2 flex items-start gap-2 text-xs md:text-sm text-gray-700 dark:text-zinc-300 cursor-pointer" data-field="sigDeclaration">
              <input type="checkbox" checked={form.sigDeclaration} onChange={(e) => toggleDeclaration(e.target.checked)} className="mt-0.5" data-testid="declaration" />
              <span>I confirm that I am authorised to represent this business and execute agreements on its behalf.</span>
            </label>
            {errors.sigDeclaration && <p className="md:col-span-2 text-[11px] md:text-xs text-red-600" role="alert">{errors.sigDeclaration}</p>}
          </Section>
        </div>
      )}

      {/* ---------------- STEP 3 ---------------- */}
      {page === 5 && (
        <div className="space-y-4">
          <Section title="Admin Information">
            <label className="md:col-span-2 flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-700 dark:text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={form.sameAsSignatory} onChange={(e) => toggleSame(e.target.checked)} data-testid="same-as-signatory" />
              Same as Authorised Signatory
            </label>
            <Field label="Admin Name" required name="adminName" error={errors.adminName}>
              <input name="adminName" value={form.adminName} onChange={onChange} className={inputCls(errors.adminName)} />
            </Field>
            <Field label="Admin Email" required name="adminEmail" error={errors.adminEmail}>
              <input type="email" name="adminEmail" value={form.adminEmail} onChange={onChange} className={inputCls(errors.adminEmail)} />
            </Field>
            <Field label="Admin Mobile" required name="adminPhone" error={errors.adminPhone}>
              <input type="tel" name="adminPhone" value={form.adminPhone} onChange={onChange} className={inputCls(errors.adminPhone)} />
            </Field>
            <Field label="Designation" name="adminDesignation">
              <input name="adminDesignation" value={form.adminDesignation} onChange={onChange} className={inputCls()} />
            </Field>
          </Section>
          <Section title="Account Security">
            <Field label="Password" required name="password" error={errors.password}>
              <PasswordInput name="password" value={form.password} onChange={onChange} error={errors.password} placeholder="Create admin password" />
            </Field>
            <Field label="Confirm Password" required name="confirmPassword" error={errors.confirmPassword}>
              <PasswordInput name="confirmPassword" value={form.confirmPassword} onChange={onChange} error={errors.confirmPassword} placeholder="Confirm admin password" />
            </Field>
            <Field label="Company Owner Secret Key" required name="secretKey" error={errors.secretKey}>
              <PasswordInput name="secretKey" value={form.secretKey} onChange={onChange} error={errors.secretKey} placeholder="Min 6 characters (for handover protection)" />
            </Field>
            <Field label="Confirm Secret Key" required name="confirmSecretKey" error={errors.confirmSecretKey}>
              <PasswordInput name="confirmSecretKey" value={form.confirmSecretKey} onChange={onChange} error={errors.confirmSecretKey} placeholder="Confirm secret key" />
            </Field>
          </Section>
        </div>
      )}

      {/* ---------------- STEP 4 ---------------- */}
      {page === 6 && (
        <div className="space-y-3.5 text-xs font-semibold">
          <p className="text-[11px] text-gray-500">Adding employees is optional.</p>
          <div className="border border-gray-150 dark:border-zinc-800 p-3.5 md:p-5 rounded-xl bg-gray-50 dark:bg-zinc-900 space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-3 [&>*]:min-w-0">
            <h3 className="md:col-span-2 font-bold text-xs md:text-sm text-gray-800 dark:text-zinc-100">Add Employee</h3>
            {[['name', 'Employee Name *', 'text'], ['email', 'Employee Email *', 'email'], ['phone', 'Employee Phone *', 'tel'], ['designation', 'Designation *', 'text'], ['department', 'Department', 'text']].map(([n, l, t]) => (
              <div key={n}>
                <label className="block text-gray-600 dark:text-zinc-400 mb-1">{l}</label>
                <input type={t} value={empInput[n]} onChange={(e) => setEmpInput((p) => ({ ...p, [n]: e.target.value }))} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" />
              </div>
            ))}
            <div className="md:col-span-2">
              <label className="block text-gray-600 dark:text-zinc-400 mb-1">Address</label>
              <textarea rows={2} value={empInput.address} onChange={(e) => setEmpInput((p) => ({ ...p, address: e.target.value }))} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-xs" />
            </div>
            <div>
              <label className="block text-gray-600 dark:text-zinc-400 mb-1">Password *</label>
              <PasswordInput name="empPassword" value={empInput.password} onChange={(e) => setEmpInput((p) => ({ ...p, password: e.target.value }))} placeholder="Employee password" />
            </div>
            <div>
              <label className="block text-gray-600 dark:text-zinc-400 mb-1">Confirm Password *</label>
              <PasswordInput name="empConfirm" value={empConfirm} onChange={(e) => setEmpConfirm(e.target.value)} placeholder="Confirm password" />
            </div>
            <button type="button" onClick={addEmployee} className="md:col-span-2 w-full py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold">Add to Team</button>
          </div>

          {employees.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-gray-800 dark:text-zinc-100">Added Team Members ({employees.length})</h4>
              <div className="divide-y max-h-64 overflow-y-auto border rounded-xl bg-white dark:bg-zinc-950 dark:border-zinc-800">
                {employees.map((emp, i) => (
                  <div key={emp.email} className="p-3 space-y-1.5" data-field={`emp${i}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-800 dark:text-zinc-100">{emp.name}</p>
                        <p className="text-gray-500">{emp.email} - {emp.designation}</p>
                      </div>
                      <button type="button" onClick={() => setEmployees((p) => p.filter((_, x) => x !== i))} className="text-red-600 font-bold hover:underline">Remove</button>
                    </div>
                    {!emp.password && (
                      <div>
                        <input type="password" placeholder="Re-enter employee password (not stored in drafts)" onChange={(e) => setEmployees((p) => p.map((x, xi) => (xi === i ? { ...x, password: e.target.value } : x)))} className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-zinc-950" />
                        {errors[`emp${i}`] && <p className="text-[11px] text-red-600" role="alert">{errors[`emp${i}`]}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- REVIEW ---------------- */}
      {page === 7 && (
        <div className="space-y-4" data-testid="review-page">
          {reviewBlock('Company Details', 'company', [
            ['Company / Business Name', form.companyName], ['Business Type', form.businessType],
            ['Registration Number', form.companyRegistrationNumber], ['Company Email', form.businessEmail],
            ['Contact Number', form.businessPhone], ['Website', form.website],
            ['Registration Proof', docLink(docs.companyRegistrationProof)],
          ])}
          {reviewBlock('Company Address', 'address', [
            ['Address Line 1', form.addrLine1], ['Address Line 2', form.addrLine2],
            ['City', form.city], ['State', form.state], ['Pincode', form.pincode], ['Country', form.country],
            ['Address Proof', docLink(docs.addressProof)],
          ])}
          {reviewBlock('Bank Details', 'bank', [
            ['Account Holder', form.accountHolderName], ['Bank Name', form.bankName],
            ['Account Number', mask(form.accountNumber)], ['IFSC Code', form.ifscCode],
            ['Account Type', form.accountType], ['Branch', form.branchName],
            [form.bankDocType === 'bank_statement' ? 'Bank Statement' : 'Cancelled Cheque', docLink(docs.bankDocument)],
          ])}
          {reviewBlock('GST & Agreement', 'gst', [
            ['GST Registered', form.gstRegistered === 'yes' ? 'Yes' : form.gstRegistered === 'no' ? 'No' : ''],
            ['GST Number', form.gstNumber], ['Legal Business Name', form.gstLegalName],
            ['Registration Type', form.gstRegType], ['State / Jurisdiction', form.gstState],
            ['GST Certificate', docLink(docs.gstCertificate)],
            ['Signed Agreement', docLink(docs.acceptanceExecutionDocument)],
          ])}
          {reviewBlock('Authorised Signatory', 'signatory', [
            ['Full Legal Name', form.sigName], ['Designation', form.sigDesignation],
            ['Official Email', form.sigEmail], ['Mobile Number', form.sigMobile],
            ['Identity Document', docLink(docs.sigIdentity)], ['Authorisation Document', docLink(docs.sigAuthorisation)],
            ['Declaration', form.sigDeclaration ? 'Accepted' : ''],
          ])}
          {reviewBlock('Admin Information', 'admin', [
            ['Admin Name', form.adminName], ['Admin Email', form.adminEmail],
            ['Admin Mobile', form.adminPhone], ['Designation', form.adminDesignation],
            ['Same as Signatory', form.sameAsSignatory ? 'Yes' : ''],
            ['Password', form.password ? '••••••••' : ''],
            ['Owner Secret Key', form.secretKey ? '••••••' : ''],
          ])}
          {reviewBlock(`Employees (${employees.length})`, 'employees', employees.length
            ? employees.map((emp, i) => [`${i + 1}. ${emp.name}`, [emp.email, emp.phone, emp.designation, emp.department].filter(Boolean).join(' · ')])
            : [['Team members', 'No employees added']])}
          <p className="text-[11px] md:text-xs text-gray-500 dark:text-zinc-500 leading-relaxed">
            By submitting, you agree to our{' '}
            <Link to="/terms-and-conditions" className="text-[#AE020B] dark:text-red-400 font-bold underline">Terms & Conditions</Link> and{' '}
            <Link to="/privacy-policy" className="text-[#AE020B] dark:text-red-400 font-bold underline">Privacy Policy</Link>.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-5 mt-2 border-t border-gray-200 dark:border-zinc-800">
        <div>
          {page > 0 && (
            <button type="button" onClick={back} className={`${btnSecondary} w-full sm:w-auto px-5 inline-flex items-center justify-center gap-2`} data-testid="prev-btn">
              <FiArrowLeft /> Previous
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={saveDraft} disabled={savingDraft} className={`${btnSecondary} px-5 inline-flex items-center justify-center gap-2`} data-testid="save-draft">
            <FiBookmark /> {savingDraft ? 'Saving...' : 'Save & Continue Later'}
          </button>
          {page < 7 && (
            <button type="button" onClick={next} className={`${btnPrimary} px-6 inline-flex items-center justify-center gap-2`} data-testid="next-btn">
              {page === 6 ? 'Review Details' : 'Continue to Next Step'} <FiArrowRight />
            </button>
          )}
          {page === 7 && (
            <button type="submit" disabled={isLoading} className={`${btnPrimary} px-6`} data-testid="submit-btn">
              {isLoading ? 'Registering...' : 'Submit Registration'}
            </button>
          )}
        </div>
      </div>
    </form>
  );

  /* ---------------- page shell (header + sidebar + content card) ---------------- */
  return (
    <div>
      <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-zinc-100 relative overflow-x-hidden transition-colors duration-300">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-40 -right-40 w-[34rem] h-[34rem] rounded-full bg-[#AE020B]/10 dark:bg-[#AE020B]/20 blur-3xl" />
          <div className="absolute bottom-0 -left-40 w-[30rem] h-[30rem] rounded-full bg-[#AE020B]/5 dark:bg-[#AE020B]/10 blur-3xl" />
        </div>

        <header className="relative z-20 border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-white p-1 shrink-0"><img src="/PLEwhite.png" alt="PLE" className="w-full h-full object-contain" /></span>
              <span className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">PLE <span className="font-semibold text-gray-600 dark:text-zinc-300">eStore</span></span>
              <span className="hidden sm:block h-6 w-px bg-gray-300 dark:bg-white/15" />
              <span className="hidden sm:block text-sm text-gray-500 dark:text-zinc-400 truncate">Business Account Registration</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <Link to="/help-support" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white"><FiHelpCircle /> Need Help?</Link>
              <Link to="/b2b/login" className="px-4 py-1.5 rounded-lg border border-[#AE020B] text-sm font-semibold text-[#AE020B] dark:text-white hover:bg-[#AE020B] hover:text-white transition-colors">Login</Link>
            </div>
          </div>
        </header>

        <div className="relative z-10 max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8 items-start">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:flex flex-col lg:sticky lg:top-6 rounded-2xl text-white bg-gradient-to-br from-[#AE020B] via-[#8d0208] to-[#4a0105] shadow-xl overflow-hidden relative">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" aria-hidden="true" />
            <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-black/10" aria-hidden="true" />
            <div className="p-6 relative">
              <span className="inline-block text-[10px] font-bold tracking-widest text-white bg-white/15 border border-white/30 rounded px-2 py-1">B2B ONBOARDING</span>
              <h2 className="mt-4 text-2xl font-bold leading-tight text-white">Create Your Business Account</h2>
              <p className="mt-3 text-sm text-white/80 leading-relaxed">Get access to enterprise pricing, procurement tools and a dedicated business experience on PLE eStore.</p>

              <ol className="mt-6 space-y-1">
                {GROUPS.map((g) => {
                  const { idx, active, done, reachable } = groupState(g);
                  return (
                    <li key={g.step}>
                      <button type="button" disabled={!reachable} onClick={() => goTo(idx[0])}
                        className={`w-full flex items-start gap-3 text-left rounded-xl px-3 py-2.5 transition-colors ${active ? 'bg-white/15' : reachable ? 'hover:bg-white/10' : 'opacity-60 cursor-default'}`}>
                        <span className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${active ? 'bg-white text-[#AE020B]' : done ? 'bg-emerald-500 text-white' : 'bg-white/15 text-white/80'}`}>
                          {done && !active ? <FiCheck /> : g.step}
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-sm font-semibold text-white`}>{g.title}</span>
                          <span className="block text-xs text-white/70">{g.desc}</span>
                          {active && idx.length > 1 && (
                            <span className="mt-2 block space-y-1">
                              {idx.map((i) => (
                                <span key={i} className={`flex items-center gap-2 text-xs ${i === page ? 'text-white font-semibold' : donePages.includes(i) ? 'text-emerald-300' : 'text-white/60'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${i === page ? 'bg-white' : donePages.includes(i) ? 'bg-emerald-300' : 'bg-white/40'}`} />
                                  {PAGES[i].title}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="relative h-24 flex items-end p-5">
              <span className="text-xs text-white/70">Your progress is saved when you choose &ldquo;Save &amp; Continue Later&rdquo;.</span>
            </div>
          </aside>

          {/* Content */}
          <section className="min-w-0">
            {/* Compact progress (mobile / tablet) */}
            <div className="lg:hidden mb-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 p-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-2">
                <span className="font-semibold text-[#AE020B] dark:text-red-400">Step {Math.min(step, 4)} of 4{step === 5 ? ' · Final review' : ''}</span>
                <span>{page + 1} / {PAGES.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden"><div className="h-full bg-[#AE020B] transition-all" style={{ width: `${((page + 1) / PAGES.length) * 100}%` }} /></div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900/70 p-4 sm:p-6 lg:p-8 shadow-xl dark:shadow-2xl">
              <p className="text-xs font-bold text-[#AE020B] dark:text-red-400" data-testid="step-label">
                {step === 5 ? 'Final step' : `Step ${step} of 4`}
                {step === 1 ? ` · Part ${page + 1} of ${pagesOfStep(1).length}` : ''}
              </p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{current.title}</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{current.subtitle}</p>
              <div className="my-5 border-t border-gray-200 dark:border-white/10" />
              {formBody}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default B2BRegistrationWizard;
