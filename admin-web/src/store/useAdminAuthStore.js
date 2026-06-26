import { create } from 'zustand';
import axios from 'axios';

export const useAdminAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  // ── Initialize Auth on App Mount ──
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/refresh-token`,
        {},
        { withCredentials: true }
      );

      const accessToken = response.data.accessToken;
      let userData = JSON.parse(localStorage.getItem('user') || 'null');

      if (!accessToken) {
        throw new Error('User session invalid or incomplete');
      }

      if (!userData) {
        userData = { name: "Super Admin", type: "SUPERADMIN" };
        localStorage.setItem('user', JSON.stringify(userData));
      }

      set({
        user: userData,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.log('Refresh Failed:', error.response?.data || error.message);
      // Expired or invalid session → clear everything
      localStorage.removeItem('user');
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // ── Login ──
  login: (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    set({
      user: userData,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  // ── Logout ──
  logout: async () => {
    set({ isLoading: true });
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/logout`,
        {},
        { withCredentials: true }
      );
    } catch (error) {
      console.error('Logout error on server:', error);
    } finally {
      localStorage.removeItem('user');
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
