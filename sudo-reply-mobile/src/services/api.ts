import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, ENDPOINTS } from '../config/api';
import { useAuthStore } from '../stores/authStore';

/**
 * Axios instance with auth interceptors.
 * - Attaches Bearer token to every request
 * - Auto-refreshes on 401
 * - Redirects to login on refresh failure
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request Interceptor: attach token ──
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor: auto-refresh on 401 ──
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Don't retry auth endpoints themselves
    const isAuthEndpoint =
      originalRequest?.url?.includes('/login') ||
      originalRequest?.url?.includes('/refresh-token');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { refreshToken, userType } = useAuthStore.getState();
        if (!refreshToken) throw new Error('No refresh token');

        const refreshEndpoint =
          userType === 'TENANT'
            ? ENDPOINTS.tenantAuth.refreshToken
            : ENDPOINTS.auth.refreshToken;

        const { data } = await axios.post(`${API_BASE_URL}${refreshEndpoint}`, {
          refreshToken,
        });

        const newAccessToken = data.accessToken || data.data?.accessToken;
        const newRefreshToken = data.refreshToken || data.data?.refreshToken;

        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;