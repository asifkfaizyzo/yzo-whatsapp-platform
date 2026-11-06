
# SudoReply Route Audit — Full Context Document
**Date:** 2026-11-05
**Branch:** `dev` (local, not yet merged to `prod`)
**Purpose:** Complete route mismatch audit after major module restructure

---

## 1. PROJECT OVERVIEW

- **Stack:** Express backend, React (Vite) frontend (admin-web + tenant-web), Prisma ORM, PostgreSQL, Redis, BullMQ
- **Deployment:** Docker Compose v2 on VPS `72.61.241.109`, SSH user `sudoreply`, project at `/var/www/SudoReply`
- **Domains:** `api.sudoreply.com` → backend:5000, `admin.sudoreply.com` → admin-web:3001, `sudoreply.com` → tenant-web:3002
- **User is on Windows with PowerShell in VS Code** — `grep` does not work. Use `Select-String`.
- **Do NOT give approximate line numbers.** Always provide exact find→replace text blocks.
- **Never edit code on VPS.** Fix locally on dev → merge to prod → push → pull on VPS.
- **Backend `.env` vars** are runtime (restart container). **Root `.env` `VITE_*` vars** are build-time (must rebuild frontend images).

---

## 2. BACKEND ROUTE ARCHITECTURE

### 2.1 Mount Structure (from `backend/src/app.js`)

**Superadmin routes (`/sradmin/*`):**
| Mount Prefix | Router File | Notes |
|---|---|---|
| `/sradmin` | `superadmin.routes.js` | Auth, tenant CRUD, reports, GST settings |
| `/sradmin` | `ticket.admin.routes.js` | Admin ticket management |
| `/sradmin` | `revenue.routes.js` | Revenue stats |
| `/sradmin` | `enquiry.routes.js` | Enquiry management (dual-mount) |
| `/sradmin/plans` | `plan.routes.js` | Plan CRUD (dual-mount, superadmin-only section after `router.use(verifySuperAdmin)`) |
| `/sradmin/billing` | `billing.routes.js` | Billing (dual-mount, tenant-only features) |
| `/sradmin/google-sheets` | `googleSheets.routes.js` | Google Sheets (dual-mount, tenant-only) |
| `/sradmin/super-admin/notifications` | `superadminNotification.routes.js` | |
| `/sradmin/admin/subscriptions` | `adminSubscription.routes.js` | |
| `/sradmin/superadmin/audit-logs` | `audit.routes.js` | |
| `/sradmin/dlq` | `dlq.routes.js` | Dead letter queue |
| `/sradmin/register/enterprise-lead` | `enterpriseLead.routes.js` | Dual-mount |
| `/sradmin/admin/enterprise-leads` | `enterpriseLead.admin.routes.js` | |
| `/sradmin` | `public.routes.js` | Public routes (dual-mount) |
| `/sradmin/media` | `media.routes.js` | Signed URL media serving |
| `/sradmin/flows` | `flow.routes.js` | Flow automation (dual-mount) |
| `/sradmin/webhook` | `webhook.routes.js` | Webhook receiver |

**Tenant routes (`/tenant/*`):**
| Mount Prefix | Router File | Notes |
|---|---|---|
| `/tenant` | `tenant.routes.js` | **NESTING HUB** — mounts 6 sub-routers at `/` (see 2.2) |
| `/tenant` | `ticket.routes.js` | Tenant ticket routes |
| `/tenant` | `enquiry.routes.js` | Enquiry (dual-mount) |
| `/tenant/contacts` | `contact.routes.js` | **SEPARATE** from nested `tenant.contacts.routes.js` |
| `/tenant/conversations` | `conversation.routes.js` | **SEPARATE** from nested `tenant.conversations.routes.js` |
| `/tenant/messages` | `message.routes.js` | |
| `/tenant/tags` | `tag.routes.js` | |
| `/tenant/templates` | `template.routes.js` | |
| `/tenant/broadcasts` | `broadcast.routes.js` | |
| `/tenant/quick-replies` | `quickReply.routes.js` | |
| `/tenant/orders` | `order.routes.js` | |
| `/tenant/analytics` | `analytics.routes.js` | |
| `/tenant/notifications` | `notification.routes.js` | |
| `/tenant/plans` | `plan.routes.js` | Dual-mount |
| `/tenant/billing` | `billing.routes.js` | Dual-mount |
| `/tenant/google-sheets` | `googleSheets.routes.js` | Dual-mount |
| `/tenant/register/enterprise-lead` | `enterpriseLead.routes.js` | Dual-mount |
| `/tenant` | `public.routes.js` | Dual-mount |
| `/tenant/flows` | `flow.routes.js` | Dual-mount |

**User/Agent routes:**
| Mount Prefix | Router File | Notes |
|---|---|---|
| `/tenant/user` | `user.routes.js` | User auth, profile, availability, push tokens |

**Integration routes:**
| Mount Prefix | Router File |
|---|---|
| `/tenant/whatsapp` | `whatsapp.routes.js` |
| `/tenant/shopify` | `shopify.routes.js` |
| `/tenant/woocommerce` | `woocommerce.routes.js` |
| `/tenant/zoho` | `zoho.routes.js` |

**Direct app routes (in `app.js`, no router file):**
- `GET /sradmin/health`
- `GET /robots.txt`
- Various webhook/OAuth callback aliases (`/api/zoho/*`, `/auth/razorpay/callback`, etc.)
- WooCommerce webhook aliases (`/sradmin/webhooks/woocommerce`, `/tenant/webhooks/woocommerce`, etc.)

### 2.2 Nested Router Tree (`tenant.routes.js`)

`tenant.routes.js` is a **nesting hub** that mounts 6 sub-routers all at `/`:

```
/tenant  ← app.js mounts tenantRoutes here
  ├── /  ← authRoutes (tenant.auth.routes.js)
  │       → /login, /logout, /refresh-token, /register/step-1 through step-5,
  │         /register/verify-email, /register/status,
  │         /forgot-ten-password, /reset-ten-password,
  │         /google-login, /facebook-login
  │
  ├── /  ← profileRoutes (tenant.profile.routes.js)
  │       → /me, /update-profile, /change-password, /upload-logo, /delete-logo
  │
  ├── /  ← usersRoutes (tenant.users.routes.js)
  │       → /create-user, /get-all-users, /get-user/:id, /update-user/:id,
  │         /users/:id/deactivate, /users/:id/reactivate, /delete-user/:id
  │
  ├── /  ← contactsRoutes (tenant.contacts.routes.js)
  │       → /assign-contact/:contactId, /re-assign-contacts/:contactId,
  │         /unassign-contact/:contactId, /unassigned-contacts, /assign-multiple
  │
  ├── /  ← conversationsRoutes (tenant.conversations.routes.js)
  │       → /list-User-conversations, /auto-reopen-config (GET + PUT)
  │
  └── /  ← integrationsRoutes (tenant.integrations.routes.js)
          → /whatsapp-credentials (GET + PUT),
            /meta-channels/status, /meta-channels/connect, /meta-channels/disconnect,
            /payment-gateway (GET + PUT), /payment-gateway/test,
            /payment-gateway/oauth/url, /payment-gateway/oauth/status,
            /payment-gateway/oauth/disconnect
```

**IMPORTANT:** There are TWO contact route files and TWO conversation route files:
- `tenant.contacts.routes.js` (nested at `/tenant`) — assignment/reassignment only
- `contact.routes.js` (mounted at `/tenant/contacts`) — full CRUD, import, tags
- `tenant.conversations.routes.js` (nested at `/tenant`) — list, auto-reopen config
- `conversation.routes.js` (mounted at `/tenant/conversations`) — create, archive, media, pin

This is acknowledged architectural debt. User wants to normalize patterns later.

### 2.3 Frontend Axios Instance → BaseURL Mapping

| App | Instance | BaseURL | Actual Prefix |
|---|---|---|---|
| admin-web | `api` (default export) | `${VITE_API_URL}/sradmin` | `/sradmin` |
| tenant-web | `api` (default export) | `${VITE_BACKEND_URL}/tenant` | `/tenant` |
| tenant-web | `userApi` (named export) | `${VITE_BACKEND_URL}/tenant/user` | `/tenant/user` |

### 2.4 Frontend URL Construction Patterns (CRITICAL for understanding)

**Pattern A — Relative path, baseURL applies:**
```js
// admin-web/src/api/auth.js
api.post("/create", ...)  // → POST /sradmin/create
```

**Pattern B — Full URL constant, baseURL IGNORED by axios:**
```js
// tenant-web/src/api/analytics.js
const ANALYTICS_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/tenant/analytics`;
api.get(`${ANALYTICS_BASE_URL}/overview`)  // → GET /tenant/analytics/overview
```

**Pattern C — Relative constant, baseURL applies:**
```js
// admin-web/src/api/notification.js
const BASE_URL = "/super-admin/notifications";
api.get(`${BASE_URL}/paginated`)  // → GET /sradmin/super-admin/notifications/paginated
```

**Pattern D — Full URL inline, baseURL ignored:**
```js
// tenant-web/src/api/tenant.js
api.post(`${import.meta.env.VITE_BACKEND_URL}/tenant/upload-logo`, ...)  // → POST /tenant/upload-logo
```

**Pattern E — Dynamic JS variables in path (scanner can't resolve):**
```js
// admin-web Tenants.jsx
api.patch(`/${action}-tenant/${tenantId}`)  // action = "approve"|"block"|"unblock"
// useAuthStore.js
axios.post(`${baseUrl}${refreshEndpoint}`)  // resolves to /tenant/refresh-token at runtime
```

---

## 3. SCANNER TOOL (v2)

**File:** `scan-route-mismatches-v2.js` (project root)
**Run:** `node scan-route-mismatches-v2.js`
**Output:** Console stats + `route-audit.json`

### What it does:
1. Parses `app.js` for `app.use("/prefix", routerName)` mounts
2. Recursively follows `router.use("/sub", subRouter)` nesting (handles `tenant.routes.js` hub)
3. Extracts all `router.METHOD("/path", ...)` definitions
4. Scans all `.js`/`.jsx` files in `admin-web/src` and `tenant-web/src`
5. Resolves frontend constants and env vars to determine actual API paths
6. Normalizes path params (`:id`, `${id}` → `:param`)
7. Strips query strings
8. Handles full-URL vs relative-URL patterns (doesn't double-prefix)
9. Bidirectional diff: missing routes + orphan routes
10. Excludes webhook/callback/external routes from orphan report

### Latest scan results (2026-11-05):
- **442 backend routes** found
- **279 frontend calls** found
- **273 matched** (97.8%)
- **6 flagged missing** (4 are false positives, 2 are real)
- **140 orphan routes** (most are expected — see section 5)
- **0 unresolvable**

### Known scanner limitations:
- Cannot resolve JS variables inside path segments (e.g., `/${action}-tenant/`)
- Cannot resolve dynamic URL concatenation in stores (e.g., `${baseUrl}${endpoint}`)
- Only scans `.js`/`.jsx` files, not `.ts`/`.tsx`

---

## 4. CONFIRMED FIXES (Already Applied on `dev`)

### Fix A: `POST /tenant/whatsapp/exchange-token` ✅ DONE
- **Problem:** `exchangeToken` was exported from `whatsapp.controller.js` but never imported/routed in `whatsapp.routes.js`
- **Fix:** Added `exchangeToken` to import and added `router.post("/exchange-token", verifyTenant, exchangeToken)` before the `requireApprovedTenant` middleware
- **Status:** Confirmed working. Scanner no longer flags it. File verified.

### Fix B: `POST /sradmin/register-tenant` ✅ DONE
- **Problem:** Frontend `Tenants.jsx` was calling `POST /tenant/register` (wrong prefix, route didn't exist)
- **Fix:** Route already existed in `superadmin.routes.js` as `POST /register-tenant`. Frontend was updated to call `api.post("/register-tenant", newTenant)` using the `api` instance (baseURL `/sradmin`)
- **Status:** Confirmed in `superadmin.routes.js`. Scanner no longer flags it.

---

## 5. REAL MISSING ROUTES (2 — Need Action)

### 5.1 `DELETE /tenant/tags/:tagId/users/:userId`
- **Frontend call:** `tenant-web/src/api/tag.js` — function `removeUserFromTag(tagId, userId)` calls `api.delete(\`${TAGS_BASE_URL}/${tagId}/users/${userId}\`)`
- **Backend status:** `tag.routes.js` only has:
  - `POST /createtag`
  - `GET /get-all-tag`
  - `POST /:tagId/assign-user`
  - `PATCH /users/:userId/change-tag`
  - **No DELETE route for removing a user from a tag**
- **Decision needed:** Is "remove user from tag" a needed feature?
  - If YES → need to add route + controller logic in `tag.routes.js` and `tag.controller.js`
  - If NO → remove dead frontend code in `tag.js`

### 5.2 `POST /tenant/conversations/send-contact`
- **Frontend call:** `tenant-web/src/pages/dashboard/Inbox.jsx` — inline `api.post(\`${VITE_BACKEND_URL}/tenant/conversations/send-contact\`, ...)`
- **Backend status:** Does not exist anywhere. PowerShell grep for "send-contact" across entire `backend/src` returned zero results.
- **Decision needed:** What should this do?
  - Possible intent: Send a message to a contact, creating a conversation if none exists
  - If feature is needed → need to build route + controller
  - If leftover → remove frontend call from `Inbox.jsx`

---

## 6. ORPHAN ROUTES (140 — Categorized)

### 6.1 Dual-Mount Artifacts (~55 routes) — NOT BROKEN
Routes mounted at both `/sradmin` and `/tenant` but only one side uses them. Architectural debt from the shared-router pattern.

**Examples:**
- `/sradmin/flows/*` (15 routes) — admin-web has no flow builder
- `/sradmin/plans/public`, `create-order`, `verify-payment`, `billing`, etc. (8) — tenant-only payment flows
- `/sradmin/billing/*` (8) — tenant-only
- `/sradmin/google-sheets/*` (12) — tenant-only
- `/sradmin/register/enterprise-lead/*` (2) — tenant landing page only
- `/sradmin/enquiries` POST (1) — tenant Contact page only
- `/sradmin/settings/tax/public`, `company-info`, `features` (3) — public, tenant-facing
- `/tenant/plans/*` superadmin-only routes (8) — `GET /`, `POST /`, `PUT /:id`, etc. mounted at tenant prefix but behind `verifySuperAdmin`
- `/tenant/admin/enquiries/*` (4) — admin-only routes mounted at tenant prefix

**Future action:** Normalize the dual-mount pattern. Separate shared routes from role-specific routes.

### 6.2 False Positive Orphans (~17 routes) — ACTUALLY CALLED
Scanner can't resolve dynamic JS variables:
- `/sradmin/approve-tenant/:id`, `block-tenant/:id`, `unblock-tenant/:id` — called via `/${action}-tenant/${tenantId}` in Tenants.jsx
- `/tenant/logout`, `/tenant/refresh-token` — called from `useAuthStore.js` via `${baseUrl}${endpoint}`
- `/tenant/user/login-user`, `logout-user`, `refresh-user-access`, `google-login` — same store pattern

### 6.3 Component-Level Calls Not in api/ Layer (~37 routes) — EXPECTED
Routes called inline from `.jsx` components using `api.post(...)` rather than through centralized `api/` service files. Not broken, just inconsistent pattern.

**Examples:**
- `/tenant/contacts/by-user/:id`, `get-contact/:id`, `assign-by-priority`, `import-phone`
- `/tenant/conversations/conversation/:id`
- `/tenant/messages/incoming`, `messages/contacts/:id/messages/template`
- `/tenant/notifications` GET
- `/tenant/tickets` POST, reply, reply-user, user-tickets
- `/tenant/broadcasts/test/woo-segment`
- `/tenant/tags/users/:id/change-tag`

### 6.4 Integration Routes — Future UI (~30 routes) — EXPECTED
Backend routes for integrations where the frontend UI hasn't been built yet:
- `/tenant/shopify/sync-customers`, `products/*`, `back-in-stock/*` (8)
- `/tenant/woocommerce/cart-events`, `auth-events`, `test/*` (5)
- `/tenant/zoho/plan`, `products`, `events`, `tickets/:id/sync-case`, `invoices/:id/send-whatsapp` (5)
- `/tenant/whatsapp/calls/contact/:id`, `permissions/:id`, `my-wabas`, `register-phone` (4)
- `/tenant/whatsapp/calls/settings/:phoneId` PUT, voicemail-greeting (2)

### 6.5 Superadmin Routes Not Yet in Admin UI (~10 routes) — EXPECTED
- `/sradmin/profile` — test route
- `/sradmin/get-tenant/:id` — single-tenant fetch (admin-web uses list only)
- `/sradmin/superadmin/audit-logs/cleanup` — no UI button
- `/sradmin/dlq/*` (7) — DLQ management UI not built

### 6.6 Auth Routes Called from Interceptors (~5 routes) — EXPECTED
- `/tenant/user/refresh-user-access` — called from `axios.js` response interceptor
- `/tenant/user/logout-user` — called from store

---

## 7. PENDING ACTION ITEMS (From Previous Sessions)

### 7.1 Google Cloud Console Redirect URI
- **Current:** `http://localhost:5000/tenant/google-sheets/callback`
- **Should be:** `https://api.sudoreply.com/tenant/google-sheets/callback`
- **Where:** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs

### 7.2 Merge dev → prod and Deploy
- Fixes for `exchange-token` and `register-tenant` are on `dev`
- Need to merge to `prod`, push, pull on VPS, rebuild containers
- Command sequence on VPS:
  ```bash
  cd /var/www/SudoReply
  git checkout prod
  git merge dev
  git push origin prod
  docker compose up -d --build
  ```

### 7.3 Pattern Normalization (Future)
- Dual-mount pattern creates ~55 orphan routes
- Duplicate contact/conversation routers (nested vs separate)
- Inconsistent frontend URL patterns (relative vs full URL constants)
- User acknowledged this needs fixing but is not urgent

---

## 8. KEY FILE LOCATIONS

### Backend Route Files
```
backend/src/app.js                                    ← Master mount file
backend/src/modules/superadmin/superadmin.routes.js    ← Auth + tenant CRUD + reports + GST
backend/src/modules/tenant/tenant.routes.js            ← Nesting hub (6 sub-routers)
backend/src/modules/tenant/auth/tenant.auth.routes.js  ← Login, register steps, password
backend/src/modules/tenant/profile/tenant.profile.routes.js ← /me, /update-profile, logo
backend/src/modules/tenant/users/tenant.users.routes.js ← User CRUD under tenant
backend/src/modules/tenant/contacts/tenant.contacts.routes.js ← Contact assignment
backend/src/modules/tenant/conversations/tenant.conversations.routes.js ← Auto-reopen
backend/src/modules/tenant/integrations/tenant.integrations.routes.js ← WA creds, Meta, Razorpay
backend/src/modules/contacts/contact.routes.js         ← Full contact CRUD (separate mount)
backend/src/modules/conversations/conversation.routes.js ← Full conversation CRUD (separate)
backend/src/modules/whatsapp/whatsapp.routes.js        ← WA setup, calls, exchange-token
backend/src/modules/users/user.routes.js               ← User/agent auth + profile
backend/src/modules/plans/plan.routes.js               ← Plans + payments (dual-mount)
backend/src/modules/billing/billing.routes.js          ← Subscription management (dual-mount)
backend/src/modules/public/public.routes.js            ← Public GST/tax (dual-mount)
backend/src/modules/automation/flow.routes.js          ← Flow builder (dual-mount)
backend/src/modules/webhook/webhook.routes.js          ← Meta, Razorpay, Shopify, Woo webhooks
backend/src/modules/tags/tag.routes.js                 ← Tag CRUD (MISSING delete user from tag)
```

### Frontend API Files
```
admin-web/src/api/axios.js          ← baseURL: /sradmin
admin-web/src/api/auth.js           ← Superadmin auth (relative paths)
admin-web/src/api/notification.js   ← Relative constant BASE_URL
admin-web/src/api/plan.js           ← Relative paths
admin-web/src/api/reports.js        ← Relative paths

tenant-web/src/api/axios.js         ← baseURL: /tenant (api) + /tenant/user (userApi)
tenant-web/src/api/auth.js          ← Tenant + user auth (relative paths, uses both api and userApi)
tenant-web/src/api/analytics.js     ← Full URL constant (ANALYTICS_BASE_URL)
tenant-web/src/api/tenant.js        ← Full URL constant (TENANT_BASE_URL)
tenant-web/src/api/contact.js       ← Full URL constant (CONTACTS_BASE_URL)
tenant-web/src/api/conversation.js  ← Full URL constant (CONV_BASE_URL)
tenant-web/src/api/flow.js          ← Full URL constant (FLOW_BASE_URL)
tenant-web/src/api/googleSheets.js  ← Relative constant (GOOGLE_SHEETS_BASE)
tenant-web/src/api/billing.js       ← Relative paths
tenant-web/src/api/tag.js           ← Full URL constant (TAGS_BASE_URL)
```

---

## 9. CONVENTIONS & RULES (For AI Context)

1. Every new/modified file must have its exact project-relative path as a comment on line 1
2. Do NOT give full-file replacements unless >60% of file changes. Use exact find→replace blocks.
3. Do NOT assume anything about the system. Ask for context files if unclear.
4. Backend architecture must be finalized before frontend planning.
5. Follow existing project conventions. Do not invent new patterns without justification.
6. Use `docker compose` (v2, space), NOT `docker-compose` (v1, hyphen).
7. SudoReply runs on Docker Compose v2, NOT PM2. The PM2 process `sudoreply-backend` is a leftover.
8. When providing code changes, ask user to paste the file first if you haven't seen the current version.
9. PowerShell commands: use `Select-String`, `Get-ChildItem`, NOT `grep`/`find`.



PS Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform> Get-ChildItem -Path backend\src -Recurse -Include *.js | Select-String -Pattern "exchange-token" | Select-Object Path, LineNumber, Line

Path                                                                                                     LineNumber Line     
----                                                                                                     ---------- ----     
Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform\backend\src\modules\whatsapp\whatsapp.controller.js        108 // POS...
Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform\backend\src\modules\whatsapp\whatsapp.routes.js             88 // POS...
Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform\backend\src\modules\whatsapp\whatsapp.routes.js             90 router...


PS Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform> Get-ChildItem -Path backend\src -Recurse -Include *.js | Select-String -Pattern "send-contact" | Select-Object Path, LineNumber, Line
PS Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform> Get-ChildItem -Path tenant-web\src -Recurse -Include *.js,*.jsx | Select-String -Pattern "exchange-token" | Select-Object Path, LineNumber, Line

Path                                                                                                        LineNumber Line  
----                                                                                                        ---------- ----  
Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform\tenant-web\src\components\whatsapp\WhatsAppConnect.jsx        102    ...


PS Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform> Get-ChildItem -Path tenant-web\src -Recurse -Include *.js,*.jsx | Select-String -Pattern "my-wabas" | Select-Object Path, LineNumber, Line
PS Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform> Get-ChildItem -Path tenant-web\src -Recurse -Include *.js,*.jsx | Select-String -Pattern "register-phone" | Select-Object Path, LineNumber, Line
PS Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform> Get-ChildItem -Path admin-web\src -Recurse -Include *.js,*.jsx | Select-String -Pattern "action.*-tenant|approve-tenant|block-tenant|unblock-tenant" | Select-Object Path, LineNumber, Line

Path                                                                                           LineNumber Line               
----                                                                                           ---------- ----               
Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform\admin-web\src\pages\dashboard\Tenants.jsx       1903         const re...
Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform\admin-web\src\pages\dashboard\Tenants.jsx       1940         const re...


PS Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform> Get-ChildItem -Path tenant-web\src -Recurse -Include *.js,*.jsx | Select-String -Pattern "/orders" | Select-Object Path, LineNumber, Line
PS Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform> 







{
  "timestamp": "2026-11-05T12:08:28.473Z",
  "stats": {
    "backendRoutes": 442,
    "frontendCalls": 279,
    "matched": 273,
    "missingRoutes": 6,
    "orphanRoutes": 140,
    "unresolvable": 0
  },
  "missingRoutes": [
    {
      "method": "PATCH",
      "path": "/sradmin/:param-tenant/:param",
      "file": "admin-web\\src\\pages\\dashboard\\Tenants.jsx",
      "raw": "/${action}-tenant/${tenantId}"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/:param-tenant/:param",
      "file": "admin-web\\src\\pages\\dashboard\\Tenants.jsx",
      "raw": "/${action}-tenant/${tenantId}"
    },
    {
      "method": "DELETE",
      "path": "/tenant/tags/:param/users/:param",
      "file": "tenant-web\\src\\api\\tag.js",
      "raw": "${TAGS_BASE_URL}/${tagId}/users/${userId}"
    },
    {
      "method": "POST",
      "path": "/tenant/conversations/send-contact",
      "file": "tenant-web\\src\\pages\\dashboard\\Inbox.jsx",
      "raw": "${import.meta.env.VITE_BACKEND_URL}/tenant/conversations/send-contact"
    },
    {
      "method": "POST",
      "path": "/tenant:param:param",
      "file": "tenant-web\\src\\store\\useAuthStore.js",
      "raw": "${baseUrl}${refreshEndpoint}"
    },
    {
      "method": "POST",
      "path": "/tenant:param:param",
      "file": "tenant-web\\src\\store\\useAuthStore.js",
      "raw": "${baseUrl}${logoutEndpoint}"
    }
  ],
  "orphanRoutes": [
    {
      "method": "GET",
      "path": "/sradmin/media/serve",
      "file": "backend\\src\\modules\\messages\\media.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/media/refresh/:param",
      "file": "backend\\src\\modules\\messages\\media.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/flows",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/flows/:param",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/flows",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "PUT",
      "path": "/sradmin/flows/:param",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/sradmin/flows/:param",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/flows/:param/toggle",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/flows/:param/set-default",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/flows/:param/unset-default",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/flows/keywords/all",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/flows/:param/keywords",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/flows/:param/keywords",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/sradmin/flows/keywords/:param",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/flows/media/upload",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/flows/keywords/all",
      "file": "backend\\src\\modules\\automation\\flow.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/settings/tax/public",
      "file": "backend\\src\\modules\\public\\public.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/company-info",
      "file": "backend\\src\\modules\\public\\public.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/features",
      "file": "backend\\src\\modules\\public\\public.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/company-info",
      "file": "backend\\src\\modules\\public\\public.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/features",
      "file": "backend\\src\\modules\\public\\public.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/profile",
      "file": "backend\\src\\modules\\superadmin\\superadmin.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/get-tenant/:param",
      "file": "backend\\src\\modules\\superadmin\\superadmin.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/deactivate-tenant/:param",
      "file": "backend\\src\\modules\\superadmin\\superadmin.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/reactivate-tenant/:param",
      "file": "backend\\src\\modules\\superadmin\\superadmin.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/approve-tenant/:param",
      "file": "backend\\src\\modules\\superadmin\\superadmin.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/block-tenant/:param",
      "file": "backend\\src\\modules\\superadmin\\superadmin.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/sradmin/unblock-tenant/:param",
      "file": "backend\\src\\modules\\superadmin\\superadmin.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/enquiries",
      "file": "backend\\src\\modules\\enquiries\\enquiry.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/plans/public",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/plans/create-order",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/plans/verify-payment",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/plans/create-subscription-trial",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/plans/verify-subscription-trial",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/plans/create-paid-subscription",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/plans/verify-paid-subscription",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/plans/billing",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/plans/billing/invoice/:param",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/billing/cancel",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/billing/cancel-autopay",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/billing/reactivate",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/billing/pause",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/billing/resume",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/billing",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/billing/invoices",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/billing/invoices/:param/download",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/google-sheets/auth-url",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/google-sheets/status",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/sradmin/google-sheets/disconnect",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/google-sheets/fields",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/google-sheets/fields",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "PUT",
      "path": "/sradmin/google-sheets/fields/reorder",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "PUT",
      "path": "/sradmin/google-sheets/fields/:param",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "PUT",
      "path": "/sradmin/google-sheets/fields/:param/toggle",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/sradmin/google-sheets/fields/:param",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/google-sheets/fields/sync",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/google-sheets/preview",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/google-sheets/broadcast",
      "file": "backend\\src\\modules\\google-sheets\\googleSheets.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/super-admin/notifications",
      "file": "backend\\src\\modules\\superadmin-notifications\\superadminNotification.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/superadmin/audit-logs/cleanup",
      "file": "backend\\src\\modules\\audit\\audit.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/dlq/stats",
      "file": "backend\\src\\modules\\webhook\\dlq.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/dlq",
      "file": "backend\\src\\modules\\webhook\\dlq.routes.js"
    },
    {
      "method": "GET",
      "path": "/sradmin/dlq/:param",
      "file": "backend\\src\\modules\\webhook\\dlq.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/dlq/:param/retry",
      "file": "backend\\src\\modules\\webhook\\dlq.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/dlq/retry-all",
      "file": "backend\\src\\modules\\webhook\\dlq.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/sradmin/dlq/:param",
      "file": "backend\\src\\modules\\webhook\\dlq.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/sradmin/dlq",
      "file": "backend\\src\\modules\\webhook\\dlq.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/register/enterprise-lead",
      "file": "backend\\src\\modules\\enterprise-leads\\enterpriseLead.routes.js"
    },
    {
      "method": "POST",
      "path": "/sradmin/register/enterprise-lead/reset",
      "file": "backend\\src\\modules\\enterprise-leads\\enterpriseLead.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/logout",
      "file": "backend\\src\\modules\\tenant\\auth\\tenant.auth.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/refresh-token",
      "file": "backend\\src\\modules\\tenant\\auth\\tenant.auth.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/get-user/:param",
      "file": "backend\\src\\modules\\tenant\\users\\tenant.users.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/list-User-conversations",
      "file": "backend\\src\\modules\\tenant\\conversations\\tenant.conversations.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/tickets",
      "file": "backend\\src\\modules\\tickets\\ticket.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/tickets/:param/reply",
      "file": "backend\\src\\modules\\tickets\\ticket.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/tickets/:param/reply-user",
      "file": "backend\\src\\modules\\tickets\\ticket.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/user-tickets",
      "file": "backend\\src\\modules\\tickets\\ticket.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/user-tickets/:param/reply",
      "file": "backend\\src\\modules\\tickets\\ticket.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/admin/enquiries",
      "file": "backend\\src\\modules\\enquiries\\enquiry.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/admin/enquiries/:param",
      "file": "backend\\src\\modules\\enquiries\\enquiry.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/tenant/admin/enquiries/:param/status",
      "file": "backend\\src\\modules\\enquiries\\enquiry.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/tenant/admin/enquiries/:param",
      "file": "backend\\src\\modules\\enquiries\\enquiry.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/contacts/by-user/:param",
      "file": "backend\\src\\modules\\contacts\\contact.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/contacts/get-contact/:param",
      "file": "backend\\src\\modules\\contacts\\contact.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/tenant/contacts/assign-by-priority",
      "file": "backend\\src\\modules\\contacts\\contact.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/contacts/import-phone",
      "file": "backend\\src\\modules\\contacts\\contact.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/conversations/conversation/:param",
      "file": "backend\\src\\modules\\conversations\\conversation.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/messages/incoming",
      "file": "backend\\src\\modules\\messages\\message.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/messages/contacts/:param/messages/template",
      "file": "backend\\src\\modules\\messages\\message.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/tenant/tags/users/:param/change-tag",
      "file": "backend\\src\\modules\\tags\\tag.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/broadcasts/test/woo-segment",
      "file": "backend\\src\\modules\\broadcasts\\broadcast.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/orders",
      "file": "backend\\src\\modules\\orders\\order.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/orders/:param",
      "file": "backend\\src\\modules\\orders\\order.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/orders/:param/resend-payment-link",
      "file": "backend\\src\\modules\\orders\\order.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/orders/:param/refund",
      "file": "backend\\src\\modules\\orders\\order.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/orders/:param/cancel-payment-link",
      "file": "backend\\src\\modules\\orders\\order.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/notifications",
      "file": "backend\\src\\modules\\notifications\\notification.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/plans/features",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/plans",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/plans",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "PUT",
      "path": "/tenant/plans/:param",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/tenant/plans/:param/toggle-status",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/tenant/plans/:param",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/plans/features/create",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/tenant/plans/features/:param",
      "file": "backend\\src\\modules\\plans\\plan.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/billing/cancel-autopay",
      "file": "backend\\src\\modules\\billing\\billing.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/user/login-user",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/user/logout-user",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/user/refresh-user-access",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/user/google-login",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/user/my-assigned-contacts",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/tenant/user/availability",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/user/dashboard-stats",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/user/unread-count",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/user/push-token",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/tenant/user/push-token",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/user/notification-preferences",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "PATCH",
      "path": "/tenant/user/notification-preferences",
      "file": "backend\\src\\modules\\users\\user.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/whatsapp/calls/contact/:param",
      "file": "backend\\src\\modules\\whatsapp\\whatsapp.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/whatsapp/calls/permissions/:param",
      "file": "backend\\src\\modules\\whatsapp\\whatsapp.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/whatsapp/my-wabas",
      "file": "backend\\src\\modules\\whatsapp\\whatsapp.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/whatsapp/register-phone",
      "file": "backend\\src\\modules\\whatsapp\\whatsapp.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/tenant/shopify/disconnect",
      "file": "backend\\src\\modules\\shopify\\shopify.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/shopify/sync-customers",
      "file": "backend\\src\\modules\\shopify\\shopify.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/shopify/products/sync",
      "file": "backend\\src\\modules\\shopify\\shopify.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/shopify/products",
      "file": "backend\\src\\modules\\shopify\\shopify.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/shopify/products/:param",
      "file": "backend\\src\\modules\\shopify\\shopify.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/shopify/back-in-stock/subscribe",
      "file": "backend\\src\\modules\\shopify\\shopify.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/shopify/back-in-stock/unsubscribe",
      "file": "backend\\src\\modules\\shopify\\shopify.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/shopify/back-in-stock/subscriptions",
      "file": "backend\\src\\modules\\shopify\\shopify.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/woocommerce/cart-events",
      "file": "backend\\src\\modules\\woocommerce\\woocommerce.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/woocommerce/auth-events",
      "file": "backend\\src\\modules\\woocommerce\\woocommerce.routes.js"
    },
    {
      "method": "DELETE",
      "path": "/tenant/woocommerce/disconnect",
      "file": "backend\\src\\modules\\woocommerce\\woocommerce.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/woocommerce/test/low-stock",
      "file": "backend\\src\\modules\\woocommerce\\woocommerce.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/woocommerce/test/daily-summary",
      "file": "backend\\src\\modules\\woocommerce\\woocommerce.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/zoho/plan",
      "file": "backend\\src\\modules\\zoho\\zoho.routes.js"
    },
    {
      "method": "GET",
      "path": "/tenant/zoho/products",
      "file": "backend\\src\\modules\\zoho\\zoho.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/zoho/events",
      "file": "backend\\src\\modules\\zoho\\zoho.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/zoho/tickets/:param/sync-case",
      "file": "backend\\src\\modules\\zoho\\zoho.routes.js"
    },
    {
      "method": "POST",
      "path": "/tenant/zoho/invoices/:param/send-whatsapp",
      "file": "backend\\src\\modules\\zoho\\zoho.routes.js"
    }
  ],
  "unresolvable": []
}