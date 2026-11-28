import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiArrowLeft, FiCheckCircle, FiClock, FiSend, FiXCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../../shared/utils/api';
import { getApplicationToken, clearApplicationToken } from '../../../shared/utils/b2bApplication';

const STATUS = {
  'Pending Verification': { title: 'Pending verification', text: 'Your application is being reviewed. You can sign in once it is approved, and we will email you.', icon: FiClock, tone: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200' },
  'Resubmission Required': { title: 'Corrections needed', text: 'Some documents need to be uploaded again. Sign in as the company admin to upload them under Legal Documents.', icon: FiAlertCircle, tone: 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-200' },
  Approved: { title: 'Approved', text: 'Your application is approved. You can sign in now.', icon: FiCheckCircle, tone: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-200' },
  Rejected: { title: 'Not approved', text: 'Your application was not approved. To ask for reconsideration, send us a message below.', icon: FiXCircle, tone: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200' },
  Deactivated: { title: 'Account deactivated', text: 'This business account has been deactivated. To ask for reconsideration, send us a message below.', icon: FiXCircle, tone: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200' },
  Suspended: { title: 'Account suspended', text: 'This business account is suspended. Send us a message below if you need help.', icon: FiXCircle, tone: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200' },
};

const DOC_STATE = {
  needs_correction: ['Needs correction', 'bg-red-100 text-red-700'],
  received: ['Received', 'bg-gray-100 text-gray-700'],
  accepted: ['Accepted', 'bg-green-100 text-green-700'],
};

const DETAIL_LABELS = [
  ['companyName', 'Company name'], ['companyType', 'Business type'], ['companyRegistrationNumber', 'Company Registration Number'],
  ['gstNumber', 'GSTIN'], ['businessEmail', 'Company email'], ['businessPhone', 'Contact number'],
  ['companyAddress', 'Address'], ['website', 'Website'], ['signatory', 'Authorised signatory'], ['bank', 'Bank account'],
];

const card = 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5';
const heading = 'text-sm font-bold text-gray-900 dark:text-white mb-3';

const B2BApplicationStatus = () => {
  const navigate = useNavigate();
  const token = getApplicationToken();
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/b2b-user/auth/application', { headers: { 'x-application-token': token }, skipErrorToast: true });
      setApplication(res?.data ?? res);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load your application. Please sign in again.');
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate('/b2b/login', { replace: true });
      return;
    }
    load();
  }, [token, load, navigate]);

  const send = async (event) => {
    event.preventDefault();
    if (sending || !message.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/b2b-user/auth/application/messages', { message }, { headers: { 'x-application-token': token }, skipErrorToast: true });
      setApplication((current) => ({ ...current, messages: res?.data ?? res }));
      setMessage('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Your message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const status = application ? (STATUS[application.status] || STATUS['Pending Verification']) : null;
  const StatusIcon = status?.icon;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] px-3 sm:px-4 py-5">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/b2b/login" onClick={clearApplicationToken} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-200">
            <FiArrowLeft /> Back to login
          </Link>
          <Link to="/support" className="text-sm font-semibold text-[#AE020B] dark:text-red-400">Contact support</Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Business application status</h1>

        {error && <div className={`${card} text-sm text-red-700 dark:text-red-300`} role="alert">{error}</div>}
        {!application && !error && <p className="text-center text-gray-500 py-12">Loading your application…</p>}

        {application && (
          <>
            <div className={`border rounded-2xl p-4 flex gap-3 ${status.tone}`} data-testid="application-status">
              <StatusIcon className="text-xl shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-bold">{status.title}</p>
                <p className="text-sm mt-1">{status.text}</p>
                {application.reason && <p className="text-sm mt-2 break-words"><strong>Reason / review note:</strong> {application.reason}</p>}
                {application.submittedAt && <p className="text-xs mt-2 opacity-75">Submitted on {new Date(application.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
              </div>
            </div>

            <section className={card}>
              <h2 className={heading}>What you submitted</h2>
              <dl className="grid sm:grid-cols-2 gap-3">
                {DETAIL_LABELS.map(([key, label]) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-xs text-gray-500 dark:text-zinc-400">{label}</dt>
                    <dd className={`text-sm font-semibold break-words ${application.details[key] ? 'text-gray-900 dark:text-zinc-100' : 'text-gray-400'}`}>{application.details[key] || 'Not provided'}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={card}>
              <h2 className={heading}>Documents</h2>
              <ul className="space-y-2">
                {application.documents.map((doc) => {
                  const [label, tone] = DOC_STATE[doc.state];
                  return (
                    <li key={doc.key} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-zinc-800 rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{doc.label}</p>
                        {doc.fileName && <p className="text-xs text-gray-500 truncate">{doc.fileName}</p>}
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${tone}`}>{label}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className={card}>
              <h2 className={heading}>Messages with our team</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto" data-testid="application-messages">
                {application.messages.length === 0 && <p className="text-sm text-gray-500">No messages yet. Ask a question or explain a correction here.</p>}
                {application.messages.map((m) => (
                  <div key={m._id || m.createdAt} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.senderType === 'applicant' ? 'ml-auto bg-red-50 dark:bg-red-950/30' : 'bg-gray-100 dark:bg-zinc-800'}`}>
                    <p className="text-[11px] font-bold text-gray-500">{m.senderType === 'applicant' ? 'You' : m.senderName} · {new Date(m.createdAt).toLocaleString('en-IN')}</p>
                    <p className="text-sm text-gray-900 dark:text-zinc-100 whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="mt-3 flex gap-2 items-end">
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={2} placeholder="Write a message" aria-label="Message"
                  className="flex-1 min-w-0 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white text-sm px-3 py-2" />
                <button type="submit" disabled={sending || !message.trim()} className="inline-flex items-center gap-1.5 bg-[#AE020B] text-white text-sm font-bold rounded-xl px-4 py-2.5 disabled:opacity-50">
                  <FiSend /> Send
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default B2BApplicationStatus;
