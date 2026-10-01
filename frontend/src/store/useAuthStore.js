import { create } from 'zustand';
import api from '../services/api';

let restorationPromise = null;

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
        set({ token: null, user: null, isAuthenticated: false, authReady: true, authError: null });
        return;
      }

      set({ token, user: null, isAuthenticated: false });
      try {
        const response = await api.get('/auth/me');
        const user = response.data.data;
        localStorage.setItem('murg_user', JSON.stringify(user));
        if (!user.isGlobalAdmin && user.facilityID) {
          localStorage.setItem('murg_active_branch', user.facilityID);
        }
        set({ token, user, isAuthenticated: true, authReady: true, authError: null });
      } catch (err) {
        const isNetworkFailure = !err.response || err.code === 'ERR_NETWORK' || /ECONNRESET|proxy|network/i.test(err.message || '');

        if (err.response?.status === 401) {
          localStorage.removeItem('murg_token');
          localStorage.removeItem('murg_user');
          set({ token: null, user: null, isAuthenticated: false, authReady: true, authError: null });
          return;
        }

        if (isNetworkFailure) {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            authReady: true,
            authError: null,
          });
          return;
        }

        set({
          token,
          user: null,
          isAuthenticated: false,
          authReady: true,
          authError: 'Unable to validate your session. Check your connection and retry.',
        });
      }
    })().finally(() => {
      restorationPromise = null;
    });

    return restorationPromise;
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data.data;

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
    localStorage.removeItem('murg_token');
    localStorage.removeItem('murg_user');
    localStorage.removeItem('murg_active_branch');
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
