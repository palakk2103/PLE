import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../shared/utils/api';

const SESSION_KEY = 'vendorDraftSession';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const btn = 'px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors';

/** Forget this browser's saved draft (call once the registration has been submitted). */
export const clearVendorDraftSession = () => {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};

/**
 * Save-as-draft and resume for the vendor registration form, same flow as B2B registration:
 *  - "Save as draft" stores the form (never passwords, bank account numbers or files) and emails a
 *    single-use link to continue on any device
 *  - the emailed link (?resume=...&email=...) or a 6-digit code restores it
 *  - the same browser restores automatically
 */
const VendorDraftBar = ({ formData, onRestore }) => {
  const [draftToken, setDraftToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [resume, setResume] = useState({ open: false, email: '', otp: '', sent: false, busy: false, msg: '' });

  const apply = (draft, token) => {
    onRestore(draft.data?.form || {});
    setDraftToken(token);
    setLastSaved(draft.updatedAt);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email: draft.email, token })); } catch { /* ignore */ }
  };

  // Emailed link: read once, strip it from the address bar, never submit it twice (single use)
  const [{ linkToken, linkEmail }] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return { linkToken: p.get('resume'), linkEmail: p.get('email') };
  });
  const linkHandled = useRef(false);

  const restoreSession = () => {
    let session = null;
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { /* ignore */ }
    if (!session?.email || !session?.token) return false;
    api.post('/vendor/auth/draft/load', { email: session.email, draftToken: session.token })
      .then((res) => { apply(res.data, session.token); toast.success('Your saved registration was restored. Re-enter your password and bank account number.'); })
      .catch(() => clearVendorDraftSession());
    return true;
  };

  useEffect(() => {
    if (linkToken && linkEmail) {
      if (linkHandled.current) return;
      linkHandled.current = true;
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('resume');
        url.searchParams.delete('email');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      } catch { /* ignore */ }
      api.post('/vendor/auth/draft/resume-link', { email: linkEmail, token: linkToken })
        .then((res) => {
          apply(res.data, res.data.draftToken);
          toast.success('Welcome back! Your saved details are back. Re-enter your password, bank account number and upload your documents again.', { duration: 7000 });
        })
        .catch((err) => {
          if (restoreSession()) return; // link already used: this browser may still hold the draft
          toast.error(err?.response?.data?.message || 'This link is invalid or has expired.');
          setResume((r) => ({ ...r, open: true, email: linkEmail }));
        });
      return;
    }
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const email = String(formData.email || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) return toast.error('Enter your email first so we know where to send the link.');
    setSaving(true);
    try {
      const res = await api.post('/vendor/auth/draft/save', {
        email, draftToken: draftToken || undefined, currentStep: 1, completedSteps: [], data: { form: formData },
      });
      const d = res?.data || {};
      const token = d.draftToken || draftToken;
      setDraftToken(token);
      setLastSaved(d.updatedAt);
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email, token })); } catch { /* ignore */ }
      toast.success(d.resumeLinkSent
        ? `Draft saved. We emailed a link to ${email} so you can continue later from any device. Passwords, bank account numbers and documents are not stored.`
        : 'Draft saved. Passwords, bank account numbers and documents are not stored: re-enter them when you resume.', { duration: 6000 });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Could not save draft.';
      toast.error(msg);
      if (err?.response?.status === 409 && /draft already exists/i.test(msg)) setResume((r) => ({ ...r, open: true, email }));
    } finally {
      setSaving(false);
    }
  };

  const call = async (path, body, onOk) => {
    setResume((r) => ({ ...r, busy: true, msg: '' }));
    try {
      const res = await api.post(path, body);
      onOk(res);
    } catch (err) {
      setResume((r) => ({ ...r, busy: false, msg: err?.response?.data?.message || 'Something went wrong. Please try again.' }));
    }
  };
  const requestOtp = () => call('/vendor/auth/draft/request-otp', { email: resume.email },
    (res) => setResume((r) => ({ ...r, sent: true, busy: false, msg: res?.message || 'Code sent if a draft exists.' })));
  const requestLink = () => call('/vendor/auth/draft/send-link', { email: resume.email },
    (res) => setResume((r) => ({ ...r, busy: false, msg: res?.message || 'If a saved registration exists, we emailed you a link.' })));
  const verifyOtp = () => call('/vendor/auth/draft/verify-otp', { email: resume.email, otp: resume.otp }, (res) => {
    apply(res.data, res.data.draftToken);
    setResume({ open: false, email: '', otp: '', sent: false, busy: false, msg: '' });
    toast.success('Draft restored. Continue where you left off.');
  });

  const emailOk = EMAIL_REGEX.test(resume.email);
  return (
    <div className="mb-6 space-y-3" data-testid="vendor-draft-bar">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={saving} className={`${btn} border border-primary-300 text-primary-700 hover:bg-primary-50`} data-testid="save-draft">
            {saving ? 'Saving...' : 'Save as draft'}
          </button>
          <button type="button" onClick={() => setResume((r) => ({ ...r, open: !r.open, email: r.email || String(formData.email || '') }))} className="text-primary-700 font-semibold hover:underline" data-testid="resume-toggle">
            Resume a saved registration
          </button>
        </div>
        {lastSaved && <span className="text-xs text-gray-400" data-testid="draft-saved-at">Draft saved {new Date(lastSaved).toLocaleTimeString()}</span>}
      </div>

      {resume.open && (
        <div className="p-3 border border-gray-200 rounded-xl space-y-2 bg-gray-50" data-testid="resume-panel">
          <input type="email" value={resume.email} onChange={(e) => setResume((r) => ({ ...r, email: e.target.value }))} placeholder="Email used for the draft" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="resume-email" />
          {!resume.sent ? (
            <div className="flex gap-2">
              <button type="button" disabled={resume.busy || !emailOk} onClick={requestOtp} className={`${btn} flex-1 bg-primary-600 text-white`} data-testid="resume-send">{resume.busy ? 'Sending...' : 'Send verification code'}</button>
              <button type="button" disabled={resume.busy || !emailOk} onClick={requestLink} className={`${btn} flex-1 border border-gray-300`} data-testid="resume-send-link">Email me a link</button>
            </div>
          ) : (
            <>
              <input type="text" inputMode="numeric" maxLength={6} value={resume.otp} onChange={(e) => setResume((r) => ({ ...r, otp: e.target.value.replace(/\D/g, '') }))} placeholder="6-digit code" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="resume-otp" />
              <div className="flex gap-2">
                <button type="button" disabled={resume.busy || resume.otp.length !== 6} onClick={verifyOtp} className={`${btn} flex-1 bg-primary-600 text-white`} data-testid="resume-verify">{resume.busy ? 'Verifying...' : 'Verify & resume'}</button>
                <button type="button" disabled={resume.busy} onClick={requestOtp} className={`${btn} flex-1 border border-gray-300`}>Resend code</button>
              </div>
            </>
          )}
          {resume.msg && <p className="text-xs text-gray-600" role="status" data-testid="resume-msg">{resume.msg}</p>}
        </div>
      )}
    </div>
  );
};

export default VendorDraftBar;
