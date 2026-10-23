import axios from "axios";
import { useAuthStore } from "../store/useAuthStore.js"; // 👈 Adjust path to your authStore file

const configuredBaseURL = import.meta.env.VITE_API_URL || "/api2";
const normalizedBaseURL = configuredBaseURL
  .replace(/\/+$/, "")
  .endsWith("/api2")
  ? configuredBaseURL.replace(/\/+$/, "")
  : `${configuredBaseURL.replace(/\/+$/, "")}/api2`;

const api = axios.create({
  baseURL: normalizedBaseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    // 1. Read token & user directly from Zustand IN-MEMORY store
    const { accessToken, user } = useAuthStore.getState();

    let token = accessToken;
    let tenantId = user?.id || user?.tenantId;

    // Fallback for tenantId from localStorage if user object is cached
    if (!tenantId) {
      const rawUser = localStorage.getItem("user");
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          tenantId = parsed.id || parsed.tenantId;
        } catch (e) {
          // ignore
        }
      }
    }

    // 2. Attach Authorization header if in-memory token exists
    if (token && typeof token === "string") {
      config.headers.Authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }

    // 3. Attach tenant ID header
    if (tenantId) {
      config.headers["x-tenant-id"] = tenantId;
    }

    console.log("🚀 [api.js] Request Auth Status:", {
      hasJwtToken: Boolean(config.headers.Authorization),
      tenantId: config.headers["x-tenant-id"] || "MISSING",
    });

    return config;
  },
  (error) => Promise.reject(error),
);

export default api;
