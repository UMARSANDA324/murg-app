import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('murg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor: handle 401 unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = /\/auth\/login(?:\?|$)/.test(error.config?.url || '');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('murg_token');
      localStorage.removeItem('murg_user');
      window.dispatchEvent(new Event('murg:auth-invalid'));
    }
    return Promise.reject(error);
  }
);

export default api;
