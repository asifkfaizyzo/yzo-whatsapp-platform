import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api2`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // IMPORTANT: Allows cookies to be sent back and forth
});

// 1️⃣ Request Interceptor: Attach Access Token from Zustand Store
api.interceptors.request.use((config) => {
  // Get access token from Zustand state in memory
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
}, (error) => Promise.reject(error));

// 2️⃣ Response Interceptor: Auto Refresh Token on 401 Error
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const isUser = localStorage.getItem('user_type') === 'USER';
        const refreshEndpoint = isUser ? '/refresh-user-access' : '/refresh-token';
        const refreshBaseUrl = isUser 
          ? `${import.meta.env.VITE_BACKEND_URL}/api3` 
          : `${import.meta.env.VITE_BACKEND_URL}/api2`;

        // Request new accessToken - cookies are sent automatically
        const response = await axios.post(
          `${refreshBaseUrl}${refreshEndpoint}`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = isUser ? response.data.data.accessToken : response.data.accessToken;
        
        // Save the new token into Zustand store memory
        useAuthStore.setState({ accessToken: newAccessToken });

        // Replay the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // Silent refresh failed -> force logout state in Zustand and redirect
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;