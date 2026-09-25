import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('murg_user') || 'null'),
  token: localStorage.getItem('murg_token') || null,
  isAuthenticated: Boolean(localStorage.getItem('murg_token')),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data.data;

      localStorage.setItem('murg_token', token);
      localStorage.setItem('murg_user', JSON.stringify(user));

      set({
        token,
        user,
        isAuthenticated: true,
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
