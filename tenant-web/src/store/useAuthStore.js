import { create } from 'zustand';
import axios from 'axios';
import api from '../lib/axios';

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  // Action: Initialize Auth (Silent token refresh on app mount)
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      // Determine if user is tenant or agent by checking a small local state hint
      const isUser = localStorage.getItem('user_type') === 'USER';
      const refreshEndpoint = isUser ? '/refresh-user-access' : '/refresh-token';
      const refreshBaseUrl = isUser 
        ? `${import.meta.env.VITE_BACKEND_URL}/api3` 
        : `${import.meta.env.VITE_BACKEND_URL}/api2`;

      // Make a call to refresh endpoint. The browser automatically attaches the httpOnly cookie.
      const response = await axios.post(
        `${refreshBaseUrl}${refreshEndpoint}`,
        {},
        { withCredentials: true }
      );
      
      const accessToken = isUser ? response.data.data.accessToken : response.data.accessToken;
      
      // Load user details from localStorage
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');

      if (!storedUser) {
        throw new Error('User metadata not found in localStorage');
      }

      set({
        user: storedUser,
        accessToken: accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Clear memory states if session expired or failed
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

  // Action: Set User and Token manually (after successful login)
  login: (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('user_type', userData.type); // Hint for endpoints
    set({
      user: userData,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  // Action: Clear store on logout
  logout: async () => {
    set({ isLoading: true });
    try {
      const isUser = localStorage.getItem('user_type') === 'USER';
      const logoutEndpoint = isUser ? '/logout-user' : '/logout';
      const logoutBaseUrl = isUser 
        ? `${import.meta.env.VITE_BACKEND_URL}/api3` 
        : `${import.meta.env.VITE_BACKEND_URL}/api2`;

      await axios.post(`${logoutBaseUrl}${logoutEndpoint}`, {}, { withCredentials: true });
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