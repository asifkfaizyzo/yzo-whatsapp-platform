
# tenant-web/FRONTEND_API_CLEANUP.md (do not remove this comment)

## Context for the Dev Reading This

The backend is being restructured by Asif. Your job is to clean up the frontend
API layer so it matches the pattern used in the Cureli project (`cadmin-web/src/api/`).

**The good news:** most of the infrastructure already exists. You are NOT building
from scratch. You are fixing 3 specific problems left by the previous developer.

---

## Problem Summary

There are TWO competing axios instances in this codebase. One is good, one is broken.

| File | Status | Who uses it |
|---|---|---|
| `src/lib/axios.js` | ✅ GOOD — has 401 token refresh, handles both tenant + user | Most service files |
| `src/services/api.js` | ❌ BAD — no 401 refresh, console.logs every request, attaches a header the backend ignores | Only `shopify.service.js` and `woocommerce.service.js` |

Additionally, `src/services/auth.service.js` imports raw `axios` (bypassing all
interceptors) for two `/api3` user endpoints.

---

## STEP 1: Kill `src/services/api.js`

Delete the file `src/services/api.js` entirely.

**Why it's safe to delete:**
- The `x-tenant-id` header it attaches is dead code. The backend auth middleware
  identifies tenants purely from the JWT token. Grep confirmed zero backend files
  read `x-tenant-id`.
- The `console.log("🚀 [api.js] Request Auth Status:", ...)` fires on EVERY API
  call. This must not exist in production.
- It has NO response interceptor. Any request that gets a 401 will silently fail
  instead of refreshing the token.
- It reads `VITE_API_URL` which doesn't exist in `.env`. Only `VITE_BACKEND_URL`
  is defined.

---

## STEP 2: Repoint the 2 files that imported from `api.js`

### File: `src/services/shopify.service.js`

**Change:**
```js
// BEFORE
import api from "./api";

// AFTER
import api from "../lib/axios";
```

That's it. Just change the import path. Do NOT change any function logic, URL
paths, or request/response handling.

### File: `src/services/woocommerce.service.js`

**Change:**
```js
// BEFORE
import api from "./api";

// AFTER
import api from "../lib/axios";
```

Same thing. Import path only.

---

## STEP 3: Clean up `src/services/auth.service.js`

This file currently has 3 imports at the top:

```js
import api from "../lib/axios";
import api2 from "../lib/axios"; // Targets VITE_API_URL (/api2)
import axios from "axios"; // Raw axios to easily target VITE_USER_API_URL (/api3)
```

**Problems:**
1. `api` and `api2` are the exact same instance imported twice under different
   names. `api2` is only used in `forgotPasswordTenant` and `resetPasswordTenant`
   for the tenant path — but `api` would work identically.
2. Raw `axios` is used for `/api3` user endpoints. This completely bypasses the
   401 refresh interceptor. If a user's token expires and they try to reset their
   password, the request will fail with no retry.

**Fix:**

### 3a. Remove the duplicate import

Delete the `api2` line. Replace all `api2.post(...)` calls with `api.post(...)`.

### 3b. Create a second axios instance for `/api3` (user endpoints)

In `src/lib/axios.js`, add a second named export for user API calls. Add this
AFTER the existing `export default api;` line:

```js
// ============================================
// USER API INSTANCE (targets /api3)
// Same interceptors, different base URL
// ============================================
const userApi = axios.create({
  baseURL: `${import.meta.env.VITE_BACKEND_URL}/api3`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

userApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

userApi.interceptors.response.use(
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
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/api3/refresh-user-access`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = response.data.data.accessToken;
        useAuthStore.setState({ accessToken: newAccessToken });

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return userApi(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { userApi };
```

### 3c. Update `auth.service.js` imports and usage

**New imports at top of `auth.service.js`:**
```js
import api, { userApi } from "../lib/axios";
import { useAuthStore } from '../store/useAuthStore';
```

(Remove the raw `axios` import entirely.)

**In `forgotPasswordTenant`:**
```js
// BEFORE
const response = await axios.post(`${USER_API_URL}/forgot-usr-password`, { email });

// AFTER
const response = await userApi.post('/forgot-usr-password', { email });
```

**In `resetPasswordTenant`:**
```js
// BEFORE
const response = await axios.post(`${USER_API_URL}/reset-usr-password`, { ... });

// AFTER
const response = await userApi.post('/reset-usr-password', { ... });
```

Also delete the `const USER_API_URL = ...` line at the top since it's no longer needed.

---

## STEP 4: Verify nothing broke

1. Run `npm run dev` from `tenant-web/`
2. Test these flows in the browser:
   - **Tenant login** → should work as before
   - **User (agent) login** → should work as before
   - **Wait 15+ minutes** (or manually expire token in DevTools) → make a request
     → should auto-refresh, NOT kick you to login
   - **Forgot password** (both tenant and user) → should send email
   - **Shopify integration page** → should load without console errors
   - **WooCommerce integration page** → should load without console errors
3. Open DevTools Console → there should be NO `🚀 [api.js] Request Auth Status:`
   logs anymore

---

## STEP 5 (Optional, discuss with Asif first): Rename `src/services/` → `src/api/`

Cureli uses `src/api/` as the folder name. Sudo Reply uses `src/services/`.
The pattern is identical — one file per backend module, each importing from the
central axios instance.

If Asif wants the folder renamed to match Cureli exactly:
1. Rename `src/services/` → `src/api/`
2. Update all import paths across the codebase:
   ```
   from "../services/auth.service"  →  from "../api/auth.service"
   from "../../services/contact.service"  →  from "../../api/contact.service"
   ```
   etc.
3. This is a mechanical find-and-replace. No logic changes.

**Do NOT do this step without Asif's explicit approval.** It touches many files
and is purely cosmetic.

---

## Reference: Cureli's Pattern (what we're matching)

```
cadmin-web/src/api/
  axios.js          ← single instance, interceptors, token refresh
  auth.js           ← login, logout, forgot, reset
  cadminShops.js    ← shop CRUD
  cadminUsers.js    ← user CRUD
  cadminPlans.js    ← plan management
  ...               ← one file per backend module
```

Each API file is simple:
```js
import CAdminAPI from "./axios";

export function getShops(params) {
  return CAdminAPI.get("/shops", { params });
}

export function createShop(data) {
  return CAdminAPI.post("/shops", data);
}
```

Sudo Reply's `src/services/` files already follow this pattern (import central
axios, export functions). The only issues were the two competing instances and
the raw axios bypass — both fixed by Steps 1-3 above.

---

## Rules

1. **Do NOT change any API endpoint URLs.** The backend URLs (`/api2/login`,
   `/api3/refresh-user-access`, etc.) are hardcoded in many places and the
   backend team is not changing them this sprint.
2. **Do NOT change any component logic or UI.** Only touch service files and
   `src/lib/axios.js`.
3. **Do NOT create new axios instances** beyond the `userApi` in Step 3b.
4. **Do NOT add new dependencies.** Everything needed is already in `package.json`.
5. **Keep all existing path comments** on the first line of every file
   (e.g., `// tenant-web/src/lib/axios.js (do not remove this comment)`).
6. **Ask Asif** before doing Step 5 (folder rename) or any change not listed above.