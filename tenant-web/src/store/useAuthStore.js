import { create } from 'zustand';
import axios from 'axios';

// ─── Helper ───────────────────────────────────────────────────────────────────
const getAuthConfig = (userType) => {
  const isUser = userType === 'USER';
  return {
    baseUrl: isUser
      ? `${import.meta.env.VITE_BACKEND_URL}/api3`
      : `${import.meta.env.VITE_BACKEND_URL}/api2`,
    refreshEndpoint: isUser ? '/refresh-user-access' : '/refresh-token',
    logoutEndpoint: isUser ? '/logout-user' : '/logout',
  };
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  // ── Initialize Auth on App Mount ──────────────────────────────────────────
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const userType = localStorage.getItem('user_type');
      const { baseUrl, refreshEndpoint } = getAuthConfig(userType);

      const response = await axios.post(
        `${baseUrl}${refreshEndpoint}`,
        {},
        { withCredentials: true }
      );

      const isUser = userType === 'USER';

      // ✅ Prefer getting user data from server response
      const accessToken = isUser
        ? response.data.data.accessToken
        : response.data.accessToken;

      const serverUser = isUser
        ? response.data.data.user
        : response.data.user;

      // Fallback to localStorage only if server doesn't return user
      const userData = serverUser || JSON.parse(localStorage.getItem('user') || 'null');

      if (!userData) {
        throw new Error('User metadata not found');
      }

      // Keep localStorage in sync with fresh server data
      localStorage.setItem('user', JSON.stringify(userData));

      set({
        user: userData,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
          console.log('Refresh Failed:', error.response?.data);
    console.log('Status:', error.response?.status);
      const status = error.response?.status;

      if (!status || status === 401 || status === 403) {
        // Expired or invalid session → clear everything
        localStorage.removeItem('user');
        localStorage.removeItem('user_type');
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      } else {
        // Network/server error → don't force logout
        console.error('Auth check failed (non-auth error):', error);
        set({ isLoading: false });
      }
    }
  },

  // ── Login ─────────────────────────────────────────────────────────────────
  login: (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('user_type', userData.type);
    set({
      user: userData,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout: async () => {
    set({ isLoading: true });
    try {
      const userType = localStorage.getItem('user_type');
      const { baseUrl, logoutEndpoint } = getAuthConfig(userType);

      await axios.post(
        `${baseUrl}${logoutEndpoint}`,
        {},
        { withCredentials: true }
      );
    } catch (error) {
      console.error('Logout error on server:', error);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('user_type');
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));