import { create } from 'zustand';
import api from '../services/api';

let restorationPromise = null;

function isValidUser(user) {
  return typeof user?.id === 'string'
    && user.id.length > 0
    && typeof user.role === 'string'
    && user.role.length > 0;
}

function clearStoredSession() {
  localStorage.removeItem('murg_token');
  localStorage.removeItem('murg_user');
  localStorage.removeItem('murg_active_branch');
}

export const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('murg_token') || null,
  user: null,
  isAuthenticated: false,
  authReady: false,
  authError: null,
  loading: false,
  error: null,

  restoreSession: () => {
    if (get().authReady) return Promise.resolve();
    if (restorationPromise) return restorationPromise;

    restorationPromise = (async () => {
      set({ authError: null });
      const token = localStorage.getItem('murg_token');
      if (!token) {
        clearStoredSession();
        set({ token: null, user: null, isAuthenticated: false, authReady: true, authError: null });
        return;
      }

      set({ token, user: null, isAuthenticated: false });
      try {
        const response = await api.get('/auth/me');
        const user = response.data.data;
        if (!isValidUser(user)) {
          throw new Error('Session validation returned an invalid user.');
        }

        localStorage.setItem('murg_user', JSON.stringify(user));
        if (!user.isGlobalAdmin && user.facilityID) {
          localStorage.setItem('murg_active_branch', user.facilityID);
        }
        set({ token, user, isAuthenticated: true, authReady: true, authError: null });
      } catch (err) {
        clearStoredSession();
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          authReady: true,
          authError: err.response?.status === 401
            ? 'Your session has expired. Please sign in again.'
            : 'Your session could not be verified. Please sign in again.',
        });
      }
    })().finally(() => {
      restorationPromise = null;
    });

    return restorationPromise;
  },

  login: async (email, password) => {
    set({ loading: true, error: null, authError: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data.data;
      if (typeof token !== 'string' || token.trim().length === 0 || !isValidUser(user)) {
        throw new Error('The server returned an invalid session.');
      }

      localStorage.setItem('murg_token', token);
      localStorage.setItem('murg_user', JSON.stringify(user));
      if (!user.isGlobalAdmin && user.facilityID) {
        localStorage.setItem('murg_active_branch', user.facilityID);
      }

      set({
        token,
        user,
        isAuthenticated: true,
        authReady: true,
        authError: null,
        loading: false,
        error: null,
      });

      return { success: true, user };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check credentials.';
      set({ loading: false, error: message });
      return { success: false, error: message };
    }
  },

  logout: () => {
    clearStoredSession();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      authReady: true,
      authError: null,
      loading: false,
      error: null,
    });
  },

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    if (user.isGlobalAdmin || user.role === 'Admin') return true;
    if (user.permissions?.includes('*')) return true;
    return Boolean(user.permissions?.includes(permission));
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('murg:auth-invalid', () => {
    useAuthStore.getState().logout();
  });
}
