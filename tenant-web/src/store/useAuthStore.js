import { create } from 'zustand';
import axios from 'axios';

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

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  isHydrated: false,

  checkAuth: async () => {
    set({ isLoading: true });

    try {
      const userType = localStorage.getItem('user_type');

      // No session stored
      if (!userType) {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          isHydrated: true,
        });
        return;
      }

      const { baseUrl, refreshEndpoint } = getAuthConfig(userType);

      // ✅ Now each userType reads its OWN cookie automatically
      // TENANT → sends tenant_refresh_token cookie
      // USER   → sends user_refresh_token cookie
      const response = await axios.post(
        `${baseUrl}${refreshEndpoint}`,
        {},
        { withCredentials: true }
      );

      const isUser = userType === 'USER';

      const accessToken = isUser
        ? response.data.data.accessToken
        : response.data.accessToken;

      const serverUser = isUser
        ? response.data.data.user
        : response.data.user;

      const userData =
        serverUser ||
        JSON.parse(localStorage.getItem('user') || 'null');

      if (!userData) {
        throw new Error('User metadata not found');
      }

      // ✅ Verify the returned type matches what we expected
      if (userData.type !== userType) {
        throw new Error('User type mismatch — clearing session');
      }

      localStorage.setItem('user', JSON.stringify(userData));

      set({
        user: userData,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        isHydrated: true,
      });

    } catch (error) {
      console.log('Refresh Failed:', error.response?.data || error.message);

      const status = error.response?.status;

      if (!status || status === 401 || status === 403) {
        localStorage.removeItem('user');
        localStorage.removeItem('user_type');
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
          isHydrated: true,
        });
      } else {
        set({ isLoading: false, isHydrated: true });
      }
    }
  },

  login: (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('user_type', userData.type);
    set({
      user: userData,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
      isHydrated: true,
    });
  },

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
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('user_type');
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        isHydrated: true,
      });
    }
  },
}));