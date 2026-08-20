// src/services/flow.service.js

import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

// ⭐ Create separate instance for flow routes
// because flow routes use /api not /api2
const flowApi = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// ⭐ Same auth interceptor as your main axios
flowApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => Promise.reject(error))

// ⭐ Same refresh interceptor
flowApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const isUser = localStorage.getItem('user_type') === 'USER'
        const refreshEndpoint = isUser
          ? '/refresh-user-access'
          : '/refresh-token'
        const refreshBaseUrl = isUser
          ? `${import.meta.env.VITE_BACKEND_URL}/api3`
          : `${import.meta.env.VITE_BACKEND_URL}/api2`

        const response = await axios.post(
          `${refreshBaseUrl}${refreshEndpoint}`,
          {},
          { withCredentials: true }
        )

        const newAccessToken = isUser
          ? response.data.data.accessToken
          : response.data.accessToken

        useAuthStore.setState({ accessToken: newAccessToken })
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return flowApi(originalRequest)

      } catch (refreshError) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

// ── Flow Service ──
const flowService = {

  getAllFlows: async () => {
    const res = await flowApi.get('/api/flows')
    return res.data
  },

  getFlow: async (flowId) => {
    const res = await flowApi.get(`/api/flows/${flowId}`)
    return res.data
  },

  createFlow: async (data) => {
    const res = await flowApi.post('/api/flows', data)
    return res.data
  },

  saveFlow: async (flowId, data) => {
    const res = await flowApi.put(`/api/flows/${flowId}`, data)
    return res.data
  },

  deleteFlow: async (flowId) => {
    const res = await flowApi.delete(`/api/flows/${flowId}`)
    return res.data
  },

  toggleFlow: async (flowId, isActive) => {
    const res = await flowApi.patch(
      `/api/flows/${flowId}/toggle`,
      { isActive }
    )
    return res.data
  },

  setDefault: async (flowId) => {
    const res = await flowApi.patch(`/api/flows/${flowId}/set-default`)
    return res.data
  },

  addKeywords: async (flowId, keywords) => {
    const res = await flowApi.post(
      `/api/flows/${flowId}/keywords`,
      { keywords }
    )
    return res.data
  },

  removeKeyword: async (keywordId) => {
    const res = await flowApi.delete(
      `/api/flows/keywords/${keywordId}`
    )
    return res.data
  },

getKeywords: async (flowId) => {
    const res = await flowApi.get(`/api/flows/${flowId}/keywords`)
    return res.data
  },

  // ✅ NEW: Upload media (image/video) for flow node
  uploadFlowMedia: async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const res = await flowApi.post('/api/flows/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  }
}

export default flowService