import toast from 'react-hot-toast';

// Tells the user why their session ended. The note survives the full-page redirect that often follows.
const KEY = 'session-ended-notice';
const MESSAGE = 'Your session has ended. Please sign in again.';

const show = (message) => toast.error(message, { id: 'session-ended', duration: 8000 });

export const announceSessionEnded = (message = MESSAGE) => {
  sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), message }));
  show(message);
};

export const showPendingSessionNotice = () => {
  let note = null;
  try { note = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { /* ignore a malformed note */ }
  sessionStorage.removeItem(KEY);
  if (note && Date.now() - note.at < 15000) show(note.message || MESSAGE);
};
