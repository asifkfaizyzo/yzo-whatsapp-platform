import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 1️⃣ Request Interceptor: Attach Access Token to Every Request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')

  if (token && token !== 'undefined') {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
}, (error) => Promise.reject(error))

// 2️⃣ Response Interceptor: Auto Refresh Token on 401 Error
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and the request has not been retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark request so we don't end up in an infinite loop

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken || refreshToken === 'undefined') {
          throw new Error('No refresh token available');
        }

        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const isUser = user && user.type === 'USER';

        const refreshEndpoint = isUser ? '/refresh-user-access' : '/refresh-token';
        const refreshBaseUrl = isUser 
          ? import.meta.env.VITE_USER_API_URL 
          : import.meta.env.VITE_API_URL;

        // Call backend refresh token endpoint
        const response = await axios.post(
          `${refreshBaseUrl}${refreshEndpoint}`,
          { refreshToken }
        );

        const newAccessToken = isUser ? response.data.data.accessToken : response.data.accessToken;
        localStorage.setItem('accessToken', newAccessToken);

        // Update authorization header and replay the original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // Refresh token expired or invalid -> logout user
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
)

export default api
