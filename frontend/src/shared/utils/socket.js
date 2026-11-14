import { io } from 'socket.io-client';

const getSocketUrl = () => {
  const envUrl = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '').trim();
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return envUrl || `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    return window.location.origin;
  }
  return envUrl || 'http://localhost:5000';
};

const SOCKET_URL = getSocketUrl();

class SocketService {
  constructor() {
    this.socket = null;
    this.authToken = null;
  }

  readToken() {
    if (typeof window === 'undefined') return '';
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('vendor-token') ||
      localStorage.getItem('adminToken') ||
      localStorage.getItem('b2bAdminToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('vendor-token') ||
      sessionStorage.getItem('adminToken') ||
      ''
    );
  }

  connect() {
    if (!this.socket) {
      this.authToken = this.readToken();
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true,
        auth: { token: this.authToken },
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    // Socket was opened before login (empty/stale token) -> it is unauthenticated on the
    // server and cannot join chat rooms. Reconnect with the current token.
    if (this.socket && this.readToken() !== this.authToken) {
      this.disconnect();
    }
    return this.socket || this.connect();
  }
}

const socketService = new SocketService();
export default socketService;
