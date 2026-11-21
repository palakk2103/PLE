import { useEffect, useRef } from 'react';
import socketService from '../utils/socket';

const COUNTERPART = { customer: ['vendor', 'admin'], vendor: ['customer'] };

/**
 * Live delivery / seen ticks for an open chat.
 *
 *  - "messages_delivered" / "messages_seen" from the other side update the ticks on YOUR messages.
 *  - While this chat is on screen, a new message from the other side (and window focus) calls
 *    `markRead`, so the sender's ticks turn blue right away.
 *
 * mySide: 'customer' | 'vendor'; setMessages: the page's messages setter; markRead: () => Promise.
 */
export const useChatReceipts = ({ threadId, mySide, setMessages, markRead, enabled = true }) => {
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  useEffect(() => {
    if (!enabled || !threadId) return undefined;
    const socket = socketService.getSocket();
    if (!socket) return undefined;
    const tid = String(threadId);
    const theirs = COUNTERPART[mySide] || [];
    const sender = (by) => (mySide === 'customer' ? by === 'vendor' : by === 'customer');

    const stamp = (at, level) =>
      setMessages((prev) =>
        prev.map((m) => {
          if (m.sender !== mySide) return m;
          if (level === 'seen') return m.status === 'seen' ? m : { ...m, status: 'seen', seenAt: at, deliveredAt: m.deliveredAt || at };
          if (m.status === 'seen' || m.status === 'delivered') return m;
          return { ...m, status: 'delivered', deliveredAt: at };
        })
      );

    const onDelivered = (p) => { if (String(p?.threadId) === tid && sender(p.by)) stamp(p.at, 'delivered'); };
    const onSeen = (p) => { if (String(p?.threadId) === tid && sender(p.by)) stamp(p.at, 'seen'); };

    let timer = null;
    const scheduleRead = () => {
      if (document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      timer = setTimeout(() => { Promise.resolve(markReadRef.current?.()).catch(() => {}); }, 250);
    };
    const onNewMessage = (m) => { if (theirs.includes(m?.sender)) scheduleRead(); };

    socket.on('messages_delivered', onDelivered);
    socket.on('messages_seen', onSeen);
    socket.on('new_message', onNewMessage);
    window.addEventListener('focus', scheduleRead);
    document.addEventListener('visibilitychange', scheduleRead);

    return () => {
      clearTimeout(timer);
      socket.off('messages_delivered', onDelivered);
      socket.off('messages_seen', onSeen);
      socket.off('new_message', onNewMessage);
      window.removeEventListener('focus', scheduleRead);
      document.removeEventListener('visibilitychange', scheduleRead);
    };
  }, [threadId, mySide, enabled, setMessages]);
};

export default useChatReceipts;
