import axios from 'axios';
import { useAdminAuthStore } from '../store/useAdminAuthStore';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,   // important if using cookies
});

// ✅ Attach Access Token to Every Request from Zustand
api.interceptors.request.use(
  (config) => {
    const token = useAdminAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Auto Refresh Token if Expired (401 Error)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Send refresh token request (cookies are attached automatically via withCredentials)
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = response.data.accessToken;
        
        // Update the access token in the Zustand store
        useAdminAuthStore.setState({ accessToken: newAccessToken });

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // Refresh token expired or invalid → clear Zustand store and redirect
        await useAdminAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;