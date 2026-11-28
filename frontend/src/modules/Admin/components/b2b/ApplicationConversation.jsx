import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getB2BUserById, sendB2BApplicationMessage } from '../../services/adminService';

// Admin side of the conversation an applicant sees on their application-status page.
const ApplicationConversation = ({ companyId }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    setMessages([]);
    setDraft('');
    getB2BUserById(companyId)
      .then((res) => {
        const detail = res?.data ?? res;
        if (alive) setMessages(detail?.company?.applicationMessages || []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [companyId]);

  const send = async () => {
    if (sending || !draft.trim()) return;
    setSending(true);
    try {
      const res = await sendB2BApplicationMessage(companyId, draft);
      setMessages(res?.data ?? res);
      setDraft('');
      toast.success('Message sent to the applicant');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Message could not be sent');
    } finally {
      setSending(false);
    }
  };

  return (
    <div data-testid="admin-application-conversation">
      <h3 className="text-sm font-semibold uppercase text-blue-600 mb-3 tracking-wider">Applicant messages</h3>
      <div className="bg-gray-50 p-4 rounded-xl space-y-3">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {messages.length === 0 && <p className="text-sm text-gray-500">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m._id || m.createdAt} className={`max-w-[85%] rounded-lg px-3 py-2 border border-gray-200 ${m.senderType === 'admin' ? 'ml-auto bg-blue-50' : 'bg-white'}`}>
              <p className="text-[11px] font-bold text-gray-500">{m.senderName || m.senderType} · {new Date(m.createdAt).toLocaleString('en-IN')}</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.message}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} rows={2} placeholder="Ask for a clarification or reply" aria-label="Reply to applicant"
            className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white text-sm px-3 py-2" />
          <button type="button" onClick={send} disabled={sending || !draft.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">Send</button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationConversation;
