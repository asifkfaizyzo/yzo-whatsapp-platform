import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api2`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 1️⃣ Request Interceptor: Attach Access Token from Zustand Store
api.interceptors.request.use((config) => {
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

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/login') &&
      !originalRequest.url.includes('/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const isUser = localStorage.getItem('user_type') === 'USER';
        const refreshEndpoint = isUser ? '/refresh-user-access' : '/refresh-token';
        const refreshBaseUrl = isUser 
          ? `${import.meta.env.VITE_BACKEND_URL}/api3` 
          : `${import.meta.env.VITE_BACKEND_URL}/api2`;

        const response = await axios.post(
          `${refreshBaseUrl}${refreshEndpoint}`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = isUser ? response.data.data.accessToken : response.data.accessToken;
        
        useAuthStore.setState({ accessToken: newAccessToken });

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;