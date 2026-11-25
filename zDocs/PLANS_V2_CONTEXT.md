// zDocs/PLANS_V2_CONTEXT.md (do not remove this comment)

# Plans & Subscriptions V2 — Architecture Context Document

**Project:** SudoReply (`yzo-whatsapp-platform`)
**Status:** APPROVED FOR IMPLEMENTATION — 2026-06-22
**Scope:** Backend only. Frontend changes are deferred to a later session; expected frontend breakage is documented in §10 Appendix.

---

## 1. Strict Operating Rules (Standing)

- Do NOT assume anything about the system.
- If anything is unclear → ask for the relevant context file.
- Ask clarification questions proactively.
- Challenge vague requirements.
- Surface edge cases and risks early.
- Think structurally and architecturally.
- Do NOT generate code unless the user explicitly says: **"Proceed with implementation."**
- If the solution becomes large, propose structured phases before coding.
- Backend architecture must be finalized before frontend planning.
- Follow existing project conventions once provided — do not invent new patterns without justification.
- Do not write code until the architecture plan is explicitly approved.
- Every new or modified file must have its exact project-relative path as a comment on the first line (e.g., `// backend/src/modules/auth/auth.controller.js (do not remove this comment)`). Never remove or modify existing path comments.
- Use `Get-ChildItem -Recurse | Select-String` for recursive file content search in PowerShell.

---

## 2. Backend Tree (Current State)

```
backend/
├── prisma/
│   └── schema/
│       ├── audit.prisma
│       ├── auth.prisma
│       ├── automation.prisma
│       ├── billing.prisma          ← MAJOR REWRITE (this project)
│       ├── broadcasts.prisma
│       ├── calling.prisma
│       ├── config.prisma
│       ├── contacts.prisma
│       ├── conversations.prisma
│       ├── email.prisma
│       ├── enums.prisma            ← ADD BillingCycle, PlanVisibility, AddOnType
│       ├── integrations.prisma
│       ├── notifications.prisma
│       ├── orders.prisma
│       ├── platform.prisma         ← ADD grace/retention defaults
│       ├── quick-replies.prisma
│       ├── shopify.prisma
│       ├── templates.prisma
│       ├── tenant.prisma           ← TenantSubscription fields change
│       ├── tickets.prisma
│       └── woocommerce.prisma
├── src/
│   ├── app.js                      ← Route mounting changes
│   ├── server.js
│   ├── config/
│   │   ├── bull.board.js, bullmq.js, google.sheets.js, logger.js,
│   │   ├── meta.js, multer.js, prisma.js, razorpay.js, redis.js,
│   │   ├── upload.flowMedia.js, upload.logo.js, upload.ticket.js
│   ├── cron/
│   │   ├── jobs/
│   │   │   ├── abandoned-accounts.job.js      ← MODIFY (shared deletion util)
│   │   │   ├── audit-cleanup.job.js
│   │   │   ├── expired-subscriptions.job.js   ← REWRITE (grace + retention)
│   │   │   ├── expiry-reminders.job.js        ← REWRITE (T-x + grace)
│   │   │   ├── shopify-reorder.job.js, shopify-win-back.job.js,
│   │   │   ├── webhook-cleanup.job.js, zoho-stale-task.job.js,
│   │   │   └── zoho-watch-renewal.job.js
│   │   ├── queues/ (broadcast, call-media, dlq, email, order-webhook, webhook, zoho-sync)
│   │   └── workers/ (broadcast, call-media, email, order-webhook, webhook, zoho-sync)
│   ├── lib/
│   │   ├── billing.js              ← GST helper — REUSED, no changes
│   │   ├── crypto.js, idempotency.js, meta.errorCodes.js,
│   │   ├── plan.limits.js          ← DELETE (replaced by lib/entitlements/)
│   │   ├── rateLimiter.js, socket.js
│   │   ├── constants/media.config.js
│   │   ├── mediasoup/ (config, service)
│   │   ├── entitlements/           ← NEW FOLDER (registry, resolver, usage, access)
│   │   └── utils/ (audio.converter, media.validator, request.meta, signed.url,
│   │               tracking.helper, whatsapp.mediaSender)
│   ├── middleware/
│   │   ├── authenticate.js, bullBoardAuth.js, rateLimiter.js,
│   │   ├── requireOnboarding.js, requireSetupAccess.js, requireSRAdmin.js,
│   │   ├── requireTenant.js        ← MODIFY (subscription include)
│   │   ├── requireTenantOrUser.js  ← MODIFY (subscription include)
│   │   ├── requireUser.js,
│   │   ├── subscriptionAccess.js   ← REWRITE (same export name)
│   │   └── upload.js, uploadTemplate.js, validate.js
│   ├── modules/
│   │   ├── activity/, analytics/, audit/, auth/, auto-reopen/, automation/
│   │   ├── admin-subscriptions/    ← DELETE (replaced by superadmin/subscriptions/)
│   │   ├── billing/                ← DELETE (replaced by tenant/billing/)
│   │   ├── broadcasts/             ← MODIFY controller (engine imports)
│   │   ├── contacts/, conversations/, email/, enquiries/
│   │   ├── enterprise-leads/       ← MODIFY controller (custom-plan activation)
│   │   ├── google-sheets/, messages/, notifications/, orders/
│   │   ├── plans/                  ← DELETE (replaced by tenant/plans/)
│   │   ├── public/, quick-replies/, shopify/
│   │   ├── superadmin/
│   │   │   ├── auth/               (sradmin.auth.*)
│   │   │   ├── reports/            (sradmin.reports.*)    ← MODIFY
│   │   │   ├── revenue/            (sradmin.revenue.*)    ← MODIFY
│   │   │   ├── settings/           (sradmin.settings.*)
│   │   │   ├── tenant/             (sradmin.tenant.*)     ← MODIFY
│   │   │   ├── plans/              ← NEW (sradmin.plans.*)
│   │   │   ├── addons/             ← NEW (sradmin.addons.*)
│   │   │   └── subscriptions/      ← NEW (sradmin.subscriptions.*)
│   │   ├── superadmin-notifications/, tags/, templates/, tickets/
│   │   ├── tenant/
│   │   │   ├── razorpay.oauth.controller.js
│   │   │   ├── auth/               ← MODIFY (sanitizeTenant, SUBSCRIPTION_INCLUDE)
│   │   │   ├── contacts/, conversations/
│   │   │   ├── integrations/       ← MODIFY (integration gating)
│   │   │   ├── profile/            ← MODIFY (subscription include)
│   │   │   ├── users/              ← MODIFY (maxAgents → engine)
│   │   │   ├── plans/              ← NEW (tenant.plans.*)
│   │   │   └── billing/            ← NEW (tenant.billing.* + tenant.addons.*)
│   │   ├── users/                  ← MODIFY user.service.js
│   │   ├── webhook/
│   │   │   ├── dlq.controller.js, dlq.routes.js,
│   │   │   ├── order.webhook.controller.js
│   │   │   ├── webhook.controller.js, webhook.routes.js
│   │   │   ├── razorpay/razorpay.webhook.controller.js  ← MAJOR REWRITE
│   │   │   ├── shopify/, woocommerce/
│   │   ├── whatsapp/, woocommerce/
│   │   └── zoho/
│   │       └── zoho.plan.service.js ← UNCHANGED (detects Zoho CRM edition, NOT our plan system)
│   ├── services/ (oauth.service.js, session.service.js)
│   └── utils/ (hash, otp, recaptcha, resetToken, response, tokens, username)
├── scripts/
├── uploads/
└── package.json                    (prisma ^6.19.3, zod ^4.4.3, razorpay ^2.9.6)
```

---

## 3. V1 System Analysis

### 3.1 What V1 Had

- `SubscriptionPlan` with hardcoded scalar limits: `maxAgents`, `maxAutomations`, `maxAiCredits`, `maxApiCalls`.
- `Feature` + `PlanFeature` + `PlanIntegration` models for feature gating (many-to-many junction tables).
- `TenantSubscription` with dual status fields: `planStatus` (String) + `subscriptionStatus` (enum).
- `lib/plan.limits.js` with `checkFeatureAccess()` and `checkLimitAccess()`.
- Special bypass: `planStatus === "enterprise_active"` skipped ALL limit checks.
- Trial via Razorpay mandate only (card required).
- Hardcoded 90-day data retention for all expired accounts.
- Hardcoded 24h autopay grace window.

### 3.2 Latent V1 Bugs (Confirmed, Will Be Fixed)

| Bug | Location | Impact |
| :--- | :--- | :--- |
| `maxBroadcasts` counts ALL-TIME recipients | `plan.limits.js` line ~169 | Tenants permanently hit "monthly" cap |
| `maxCampaigns` counts ALL-TIME campaigns | `plan.limits.js` | Same permanent-cap issue |
| `maxApiCalls` never enforced | Schema only | Dead field |
| Price edit doesn't clear Razorpay plan IDs | `plan.service.js` `updatePlan` | New subscribers billed old price |
| 90-day deletion for trial accounts too | `expired-subscriptions.job.js` | Trial abuse vector |

---

## 4. V2 Architecture

### 4.1 Core Principles

1. **Registry + JSONB**: Entitlement definitions live in code (`lib/entitlements/registry.js`). Per-plan values stored in `SubscriptionPlan.entitlements` JSONB column. Adding a new feature = one registry entry.
2. **No legacy scalar columns**: `maxAgents`, `maxAutomations`, `maxAiCredits`, `maxApiCalls` are dropped from `SubscriptionPlan`. All limits live in `entitlements` JSONB.
3. **No `planStatus`**: Dropped entirely. Single source of truth = `subscriptionStatus` enum + `gracePeriodEnd` timestamp.
4. **No `enterprise_active` magic status**: Enterprise = a `planType: "CUSTOM"` or `visibility: "ADMIN_ONLY"` plan with `-1` (unlimited) entitlements, assigned via SuperAdmin.
5. **`-1` = unlimited**: Sentinel value for INT entitlements. `0` = blocked. Absent key = registry default.
6. **No backward compatibility**: Full V1 purge. Frontend breakage accepted and documented.

### 4.2 Entitlement Resolution Order

When resolving any entitlement key for a tenant:

```
1. TenantSubscription.customLimitsOverride[key]     ← SuperAdmin per-tenant override
2. Sum of active TenantAddOn values for [key]       ← Recurring + one-time add-ons
3. SubscriptionPlan.entitlements[key]               ← Base plan value
4. EntitlementRegistry default                      ← Hardcoded fallback
```

### 4.3 Grace Period & Debt Model

```
Period ends (planPeriodEnd passes)
  → subscriptionStatus = "payment_failed"
  → gracePeriodEnd = now + (tenant.gracePeriodDays ?? PlatformSettings.defaultGraceDays)
  → Full feature access + warning banner flag
  → T-x reminder emails during grace

Grace expires (gracePeriodEnd passes)
  → subscriptionStatus = "expired"
  → graceDebtDays = grace days consumed
  → graceDebtPlanPrice = snapshot of plan's monthly-equivalent price
  → Platform access blocked

Repurchase after block:
  → If new plan monthly-equiv price > graceDebtPlanPrice (upgrade):
      Debt forgiven. graceDebtDays = 0. Full cycle granted.
  → If same or cheaper (same/downgrade):
      newCycleDays = billingCycleDays - graceDebtDays
      Debt cleared after application.
  → If old plan was deleted/discontinued:
      Compare new plan price against graceDebtPlanPrice snapshot.
```

### 4.4 Dual-Tier Retention

| Account type | dataDeletionDate | On purge |
| :--- | :--- | :--- |
| Never paid (no Payment/Invoice records) | expiredAt + `PlatformSettings.trialRetentionDays` (default 7) | Hard delete + email saved to `TrialEmailRegistry` |
| Ever paid (≥1 Payment/Invoice) | expiredAt + `PlatformSettings.paidRetentionDays` (default 90) | Hard delete, email NOT blocked |

### 4.5 Trial Model

- **No card required.** Instant trial start.
- **One trial per email, ever.** Checked via `TrialEmailRegistry`.
- Trial plan selection: tenant picks from plans where `hasTrial = true`.
- During trial: full features of that plan's entitlements.
- After trial without purchase: 7-day retention (never-paid path), then purge.
- `TrialEmailRegistry` survives tenant deletion permanently.

### 4.6 Add-On Model

- **No seed data.** `PlanAddOn` table starts empty. SuperAdmin creates add-ons.
- Two types: `RECURRING` (own Razorpay subscription, independent cycle from purchase date) and `ONE_TIME_TOPUP` (Razorpay order, credits land in `TenantUsage.bonus` immediately).
- Purchase: allowed at initial signup and mid-cycle.
- Cancellation: stays active until add-on's own period end.
- If base plan expires before add-on: platform access gated (base plan gate first). Add-on preserved. Recurring add-ons auto-cancel at their period end. Bonus pool credits unlock on base plan reactivation.

### 4.7 Custom Plans

- `planType: "CUSTOM"` on `SubscriptionPlan` + `customTenantId String?` field.
- Never in public listing. SuperAdmin manages multiple custom plans.
- Admin-assigned + offline-billed (manual payment with `paymentRef`). No tenant self-checkout.
- Enterprise lead activation = SuperAdmin creates/assigns a custom plan. No magic status.

### 4.8 Integrations Catalog

- Which integrations **exist** = code-defined catalog in `lib/entitlements/registry.js` (e.g., `SHOPIFY`, `WOOCOMMERCE`, `ZOHO`, `GOOGLE_SHEETS`, `RAZORPAY`).
- Which plans **get which** = fully admin-dynamic. SuperAdmin picks from catalog in plan form.
- Developer ships new integration → adds one line to registry → appears in admin plan form automatically.
- Not auto-filled anywhere. Empty default.

---

## 5. Entitlement Registry (Code-Defined)

File: `backend/src/lib/entitlements/registry.js`

```javascript
// Key format: camelCase
// valueType: "INT" | "BOOLEAN" | "STRING_ARRAY"
// usageType: "STATIC" (live DB count) | "METERED" (per-cycle, resets) | "CONFIG" (behavioral)
// -1 = unlimited (INT only)

ENTITLEMENT_REGISTRY = {
  // ── Team ──
  maxAgents:              { category: "TEAM",         type: "INT",          usage: "STATIC",  default: 1,     unit: "seats",       implemented: true,  counterModel: "User" },

  // ── Audience ──
  maxContacts:            { category: "AUDIENCE",     type: "INT",          usage: "STATIC",  default: 1000,  unit: "contacts",    implemented: true,  counterModel: "Contact" },
  maxTags:                { category: "AUDIENCE",     type: "INT",          usage: "STATIC",  default: 15,    unit: "tags",        implemented: true,  counterModel: "Tag" },
  maxAttributes:          { category: "AUDIENCE",     type: "INT",          usage: "STATIC",  default: 15,    unit: "fields",      implemented: true,  counterModel: "SheetField" },
  maxSegments:            { category: "AUDIENCE",     type: "INT",          usage: "STATIC",  default: 2,     unit: "segments",    implemented: false },
  maxContactLists:        { category: "AUDIENCE",     type: "INT",          usage: "STATIC",  default: 10,    unit: "lists",       implemented: false },

  // ── Automation ──
  maxAutomations:         { category: "AUTOMATION",   type: "INT",          usage: "STATIC",  default: 5,     unit: "flows",       implemented: true,  counterModel: "Flow" },
  maxAutomationTriggers:  { category: "AUTOMATION",   type: "INT",          usage: "METERED", default: 1000,  unit: "runs/mo",     implemented: false },

  // ── Messaging ──
  maxCampaigns:           { category: "MESSAGING",    type: "INT",          usage: "METERED", default: 10,    unit: "campaigns/mo",implemented: true },
  maxBroadcasts:          { category: "MESSAGING",    type: "INT",          usage: "METERED", default: 5000,  unit: "recipients/mo",implemented: true },
  messagingSpeed:         { category: "MESSAGING",    type: "INT",          usage: "CONFIG",  default: 40,    unit: "msg/sec",     implemented: false },
  maxStorageMb:           { category: "STORAGE",      type: "INT",          usage: "STATIC",  default: 1000,  unit: "MB",          implemented: false },

  // ── API ──
  maxApiCalls:            { category: "API",          type: "INT",          usage: "METERED", default: 10000, unit: "calls/mo",    implemented: false },
  enableApiAccess:        { category: "API",          type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },
  enableWebhooks:         { category: "API",          type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },

  // ── AI ──
  enableAiAgent:          { category: "AI",           type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },
  maxAiCredits:           { category: "AI",           type: "INT",          usage: "METERED", default: 500,   unit: "credits/mo",  implemented: false },
  enableAiVoice:          { category: "AI",           type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },
  maxAiVoiceCredits:      { category: "AI",           type: "INT",          usage: "METERED", default: 0,     unit: "credits/mo",  implemented: false },

  // ── Calling ──
  enableWhatsappCalling:  { category: "CALLING",      type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: true },

  // ── Channels ──
  allowedChannels:        { category: "CHANNELS",     type: "STRING_ARRAY", usage: "STATIC",  default: ["WHATSAPP"], unit: null,   implemented: false },
  maxChannels:            { category: "CHANNELS",     type: "INT",          usage: "STATIC",  default: 1,     unit: "connections", implemented: false },

  // ── Integrations ──
  allowedIntegrations:    { category: "INTEGRATIONS", type: "STRING_ARRAY", usage: "STATIC",  default: [],    unit: null,          implemented: false },
  maxIntegrations:        { category: "INTEGRATIONS", type: "INT",          usage: "STATIC",  default: 1,     unit: "connections", implemented: false },

  // ── Features ──
  enableCampaignScheduler:{ category: "FEATURES",     type: "BOOLEAN",      usage: "STATIC",  default: true,  unit: null,          implemented: true },
  enableClickTracking:    { category: "FEATURES",     type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },
  enableAutoRetry:        { category: "FEATURES",     type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },
  enableCatalog:          { category: "FEATURES",     type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },
  enableCustomRoles:      { category: "FEATURES",     type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },
  enablePrioritySupport:  { category: "FEATURES",     type: "BOOLEAN",      usage: "STATIC",  default: false, unit: null,          implemented: false },
}

// NOTE: Number masking is NOT in the registry.
// It is a free platform feature for all users per business decision.

INTEGRATION_CATALOG = ["SHOPIFY", "WOOCOMMERCE", "ZOHO", "GOOGLE_SHEETS", "RAZORPAY"]
CHANNEL_CATALOG = ["WHATSAPP", "INSTAGRAM", "MESSENGER"]
```

---

## 6. V2 Database Schema

### 6.1 Enums (`enums.prisma` — additions)

```prisma
enum BillingCycle {
  MONTHLY
  QUARTERLY
  ANNUAL
  ONE_TIME
}

enum PlanVisibility {
  PUBLIC
  HIDDEN_LINK_ONLY
  ADMIN_ONLY
}

enum AddOnType {
  RECURRING
  ONE_TIME_TOPUP
}
```

### 6.2 SubscriptionPlan (`billing.prisma` — rewrite)

```prisma
model SubscriptionPlan {
  id                      String         @id @default(cuid())
  name                    String         @unique
  description             String?        @db.Text
  status                  PlanStatus     @default(ACTIVE)
  planType                String         @default("REGULAR") // REGULAR | CUSTOM | PROMO
  visibility              PlanVisibility @default(PUBLIC)
  sortOrder               Int            @default(0)
  badgeText               String?
  customTenantId          String?        // Set only when planType = CUSTOM

  // Pricing
  monthlyPrice            Float          @default(0)
  quarterlyPrice          Float?
  annualPrice             Float          @default(0)
  originalPrice           Float?         // Strikethrough for promos
  offerValidUntil         DateTime?

  // Trial
  hasTrial                Boolean        @default(false)
  trialDays               Int            @default(14)
  trialRequiresCard       Boolean        @default(false)

  // Razorpay
  razorpayMonthlyPlanId   String?
  razorpayQuarterlyPlanId String?
  razorpayAnnualPlanId    String?

  // Dynamic entitlements (JSONB)
  entitlements            Json           @default("{}")

  tenantSubscriptions     TenantSubscription[]
  createdAt               DateTime       @default(now())
  updatedAt               DateTime       @updatedAt

  @@map("subscription_plans")
}
```

**DROPPED from V1:** `maxAgents`, `maxAutomations`, `maxAiCredits`, `maxApiCalls` (all moved into `entitlements` JSONB).

### 6.3 TenantSubscription (`tenant.prisma` → moved to `billing.prisma`)

```prisma
model TenantSubscription {
  id                      String             @id @default(cuid())
  tenantId                String             @unique
  tenant                  Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  planId                  String?
  plan                    SubscriptionPlan?  @relation(fields: [planId], references: [id])
  subscriptionStatus      SubscriptionStatus @default(expired)
  billingCycle            BillingCycle       @default(MONTHLY)
  currentPlan             String?            // Name snapshot for emails/display
  planPeriodStart         DateTime?
  planPeriodEnd           DateTime?

  // Trial & free-until
  freeUntilDate           DateTime?

  // Grace period & debt
  gracePeriodDays         Int?               // Per-tenant override; null = use PlatformSettings.defaultGraceDays
  gracePeriodEnd          DateTime?
  graceDebtDays           Int                @default(0)
  graceDebtPlanPrice      Float?             // Snapshot at block time

  // Razorpay
  razorpaySubscriptionId  String?            @unique
  razorpayCustomerId      String?
  autopayEnabled          Boolean            @default(false)

  // SuperAdmin overrides
  customLimitsOverride    Json?              @default("{}")

  // Retention
  dataDeletionDate        DateTime?

  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  @@map("tenant_subscriptions")
}
```

**DROPPED from V1:** `planStatus`, `hasUsedTrial`, `trialExtendedCount`, `trialExtendedByAdmin`.

### 6.4 New Models

```prisma
model TenantUsage {
  id          String   @id @default(cuid())
  tenantId    String
  periodStart DateTime
  periodEnd   DateTime
  key         String   // Entitlement key (e.g. "maxBroadcasts")
  used        Int      @default(0)
  bonus       Int      @default(0) // From one-time top-ups

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, periodStart, periodEnd, key])
  @@index([tenantId, key])
  @@map("tenant_usages")
}

model PlanAddOn {
  id               String       @id @default(cuid())
  name             String
  key              String       @unique
  description      String?      @db.Text
  type             AddOnType    @default(RECURRING)
  billingCycle     BillingCycle @default(MONTHLY)
  price            Float
  isActive         Boolean      @default(true)
  sortOrder        Int          @default(0)
  entitlementKey   String       // Must match registry key
  entitlementValue Json         // e.g. 5000 (increment) or true (boolean)
  razorpayPlanId   String?
  tenantAddOns     TenantAddOn[]
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@map("plan_add_ons")
}

model TenantAddOn {
  id                     String       @id @default(cuid())
  tenantId               String
  addOnId                String
  status                 String       @default("active") // active | cancelled | expired
  quantity               Int          @default(1)
  startsAt               DateTime     @default(now())
  expiresAt              DateTime?
  razorpaySubscriptionId String?      @unique
  tenant                 Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  addOn                  PlanAddOn    @relation(fields: [addOnId], references: [id])
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  @@index([tenantId, status])
  @@map("tenant_add_ons")
}

model TrialEmailRegistry {
  id        String   @id @default(cuid())
  email     String   @unique
  usedAt    DateTime @default(now())

  @@map("trial_email_registry")
}
```

### 6.5 PlatformSettings additions (`platform.prisma`)

```prisma
// Add to existing PlatformSettings model:
defaultGraceDays      Int @default(7)
trialRetentionDays    Int @default(7)
paidRetentionDays     Int @default(90)
```

### 6.6 Dropped Models

- `Feature` — deleted
- `PlanFeature` — deleted
- `PlanIntegration` — deleted

### 6.7 Payment/Invoice additions

```prisma
// Add to Payment model:
purchaseType  String  @default("PLAN") // PLAN | ADDON | TOPUP
addOnId       String? // FK to PlanAddOn when purchaseType != PLAN

// Same additions to Invoice model.
```

---

## 7. V1 → V2 Consumer Mapping

| File | V1 usage | V2 change |
| :--- | :--- | :--- |
| `lib/plan.limits.js` | `checkFeatureAccess`, `checkLimitAccess` | **DELETED.** Replaced by `lib/entitlements/access.js` |
| `middleware/subscriptionAccess.js` | Hardcoded 24h grace, `planStatus` checks | **REWRITTEN.** Grace window via `gracePeriodEnd`, `freeUntilDate`, blocked state. Export name `checkSubscriptionAccess` preserved. |
| `modules/automation/flow.controller.js` | `checkLimitAccess(tenantId, "maxAutomations")` | Import from `lib/entitlements/access.js`. Static count vs resolved `maxAutomations`. |
| `modules/broadcasts/broadcast.controller.js` | `checkFeatureAccess` + `checkLimitAccess` for maxCampaigns, maxBroadcasts | Import from `lib/entitlements/access.js`. Metered per-period via `TenantUsage`. |
| `modules/tenant/users/tenant.users.service.js` | `checkLimitAccess(tenantId, "maxAgents")` ×3 | Import from `lib/entitlements/access.js`. Static User count. |
| `middleware/requireTenant.js` | Subscription include fields | Updated include (drop `planStatus`, `hasUsedTrial`; add grace fields) |
| `middleware/requireTenantOrUser.js` | Same | Same |
| `modules/users/user.service.js` | `planStatus` reference | Updated to `subscriptionStatus` |
| `modules/tenant/profile/tenant.profile.controller.js` | Subscription include | Updated fields |
| `modules/tenant/auth/tenant.auth.service.js` | `SUBSCRIPTION_INCLUDE`, `sanitizeTenant` | Drop `planStatus`, `hasUsedTrial`. Add grace fields, `billingCycle`. |
| `modules/tenant/integrations/tenant.integrations.controller.js` | — | Add `allowedIntegrations` gating check |
| `modules/enterprise-leads/enterpriseLead.controller.js` | Sets `planStatus: "enterprise_active"` | Assign custom plan instead. No magic status. |
| `modules/superadmin/tenant/sradmin.tenant.service.js` | `maxAgents`, `maxAutomations` scalar refs | Read from `entitlements` JSONB |
| `modules/superadmin/reports/sradmin.reports.service.js` | Plan references | Updated field names |
| `modules/superadmin/revenue/sradmin.revenue.service.js` | Plan references | Updated field names |
| `modules/webhook/razorpay/razorpay.webhook.controller.js` | Renewal, status changes | Major rewrite: renewal rollover, grace-debt settlement, add-on events |
| `cron/jobs/expired-subscriptions.job.js` | Hardcoded 90-day, 24h autopay grace | Grace entry/exit, debt recording, 7/90-day split |
| `cron/jobs/expiry-reminders.job.js` | T-15/7/3/1 for paid only | Add trial reminders, grace reminders |
| `cron/jobs/abandoned-accounts.job.js` | Inline deletion logic | Use shared `utils/tenantDeletion.js` |
| Route files (analytics, broadcast, contact, message, quickReply, template, whatsapp, billing, flow) | Mount `checkSubscriptionAccess` | **NO CHANGES** — export name preserved |
| `modules/plans/plan.routes.js` | All endpoints | **DELETED** — replaced by `tenant/plans/` + `superadmin/plans/` |
| `modules/plans/plan.controller.js` | All handlers | **DELETED** — replaced |
| `modules/plans/plan.service.js` | CRUD | **DELETED** — replaced |
| `modules/plans/plan.schema.js` | Zod schemas | **DELETED** — replaced |
| `modules/plans/invoice.service.js` | Invoice generation | **DELETED** — absorbed into `tenant/billing/tenant.billing.service.js` |
| `modules/billing/billing.controller.js` | Cancel/reactivate/pause/resume/overview | **DELETED** — replaced by `tenant/billing/` |
| `modules/billing/billing.routes.js` | Route definitions | **DELETED** — replaced |
| `modules/admin-subscriptions/` | Admin subscription management | **DELETED** — replaced by `superadmin/subscriptions/` |

---

## 8. Route Mounting Changes (`app.js`)

### Unmount (remove imports + `app.use`):
- `planRoutes` from `./modules/plans/plan.routes.js` (mounted at `/sradmin/plans` and `/tenant/plans`)
- `billingRoutes` from `./modules/billing/billing.routes.js` (mounted at `/sradmin/billing` and `/tenant/billing`)
- `adminSubscriptionsRoute` from `./modules/admin-subscriptions/adminSubscription.routes.js` (mounted at `/sradmin/admin/subscriptions`)

### Mount (new):
```javascript
// SuperAdmin
import sradminPlansRoutes from "./modules/superadmin/plans/sradmin.plans.routes.js";
import sradminAddonsRoutes from "./modules/superadmin/addons/sradmin.addons.routes.js";
import sradminSubscriptionsRoutes from "./modules/superadmin/subscriptions/sradmin.subscriptions.routes.js";

app.use("/sradmin/plans", sradminPlansRoutes);
app.use("/sradmin/addons", sradminAddonsRoutes);
app.use("/sradmin/subscriptions", sradminSubscriptionsRoutes);

// Tenant
import tenantPlansRoutes from "./modules/tenant/plans/tenant.plans.routes.js";
import tenantBillingRoutes from "./modules/tenant/billing/tenant.billing.routes.js";
import tenantAddonsRoutes from "./modules/tenant/billing/tenant.addons.routes.js";

app.use("/tenant/plans", tenantPlansRoutes);
app.use("/tenant/billing", tenantBillingRoutes);
app.use("/tenant/billing/addons", tenantAddonsRoutes);
```

---

## 9. API Endpoint Inventory

### 9.1 Public (no auth)
| Method | Path | Handler | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/tenant/plans/public` | List active PUBLIC plans + registry metadata | Replaces old `/plans/public` |
| GET | `/tenant/plans/public/:id` | Get single plan details (for HIDDEN_LINK_ONLY access) | |

### 9.2 Tenant — Plans (authenticated, `requireTenant`)
| Method | Path | Handler | Notes |
| :--- | :--- | :--- | :--- |
| POST | `/tenant/plans/trial/start` | Start no-card trial | Checks TrialEmailRegistry |
| GET | `/tenant/plans/trial/eligibility` | Check if email can trial | |
| POST | `/tenant/plans/subscribe` | Create Razorpay subscription (M/Q/A) | |
| POST | `/tenant/plans/verify-subscription` | Verify Razorpay payment | |
| POST | `/tenant/plans/change` | Schedule plan change at period end | |

### 9.3 Tenant — Billing (authenticated, `requireTenant` + `checkSubscriptionAccess`)
| Method | Path | Handler | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/tenant/billing` | Overview: plan + usage meters + add-ons | |
| POST | `/tenant/billing/cancel` | Cancel at period end | |
| POST | `/tenant/billing/cancel-autopay` | Cancel Razorpay autopay | |
| POST | `/tenant/billing/reactivate` | Undo cancel | |
| POST | `/tenant/billing/pause` | Pause subscription | |
| POST | `/tenant/billing/resume` | Resume paused | |
| GET | `/tenant/billing/invoices` | List invoices | |
| GET | `/tenant/billing/invoices/:id/download` | Download invoice PDF | |

### 9.4 Tenant — Add-ons (authenticated, `requireTenant` + `checkSubscriptionAccess`)
| Method | Path | Handler | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/tenant/billing/addons` | List active add-ons (store) | Conditional render if none exist |
| POST | `/tenant/billing/addons/purchase` | Purchase recurring or one-time | |
| POST | `/tenant/billing/addons/verify` | Verify Razorpay payment | |
| POST | `/tenant/billing/addons/:id/cancel` | Cancel recurring add-on | Active until period end |

### 9.5 SuperAdmin — Plans (`authenticate` + `requireSRAdmin`)
| Method | Path | Handler | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/sradmin/plans` | List all plans (all types/visibility) | |
| GET | `/sradmin/plans/registry` | Get entitlement registry metadata | For dynamic form rendering |
| GET | `/sradmin/plans/:id` | Get single plan | |
| POST | `/sradmin/plans` | Create plan | Registry-validated entitlements |
| PUT | `/sradmin/plans/:id` | Update plan | Price change → null Razorpay IDs |
| PATCH | `/sradmin/plans/:id/toggle-status` | Toggle ACTIVE/INACTIVE | |
| PATCH | `/sradmin/plans/reorder` | Bulk sortOrder update | |
| DELETE | `/sradmin/plans/:id` | Delete plan | Blocked if active subscriptions |

### 9.6 SuperAdmin — Add-ons (`authenticate` + `requireSRAdmin`)
| Method | Path | Handler | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/sradmin/addons` | List all add-ons | |
| POST | `/sradmin/addons` | Create add-on | |
| PUT | `/sradmin/addons/:id` | Update add-on | |
| PATCH | `/sradmin/addons/:id/toggle` | Toggle active | |
| DELETE | `/sradmin/addons/:id` | Delete add-on | Blocked if active subscriptions |

### 9.7 SuperAdmin — Subscriptions (`authenticate` + `requireSRAdmin`)
| Method | Path | Handler | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/sradmin/subscriptions` | List all tenant subscriptions | |
| GET | `/sradmin/subscriptions/:tenantId` | Get tenant subscription detail | |
| POST | `/sradmin/subscriptions/:tenantId/extend` | Extend period by N days | |
| POST | `/sradmin/subscriptions/:tenantId/extend-trial` | Extend trial | |
| POST | `/sradmin/subscriptions/:tenantId/change-plan` | Force plan change | |
| POST | `/sradmin/subscriptions/:tenantId/manual-activate` | Offline payment activation | paymentRef idempotency |
| POST | `/sradmin/subscriptions/:tenantId/pause` | Admin pause | |
| POST | `/sradmin/subscriptions/:tenantId/reactivate` | Admin reactivate | |
| POST | `/sradmin/subscriptions/:tenantId/expire` | Force expire | |
| PUT | `/sradmin/subscriptions/:tenantId/limits` | Set customLimitsOverride | |
| PUT | `/sradmin/subscriptions/:tenantId/grace` | Set gracePeriodDays override | |
| PUT | `/sradmin/subscriptions/:tenantId/free-until` | Set freeUntilDate | |

---

## 10. Known Frontend Breakage (Appendix for Future Session)

The following will break in the existing frontend and must be fixed in a later frontend session:

1. **Old plan API response shape** — `maxAgents`, `maxAutomations`, `maxAiCredits`, `maxApiCalls` no longer top-level fields. Now in `entitlements` object.
2. **Old endpoint paths** — `/tenant/plans/*` and `/sradmin/plans/*` endpoints have new handlers with different request/response shapes.
3. **`/tenant/billing` overview response** — Now includes usage meters and add-on data.
4. **Feature/PlanFeature/PlanIntegration APIs** — Deleted entirely. Old `/plans/features` endpoints gone.
5. **`planStatus` field** — No longer in auth/profile/subscription responses. Use `subscriptionStatus` + grace fields.
6. **`hasUsedTrial`** — No longer returned. Trial eligibility checked via `/tenant/plans/trial/eligibility`.
7. **Admin plan form** — Must be rebuilt as registry-driven dynamic form.
8. **Add-on store** — New UI section needed in tenant billing.
9. **Pricing page** — Must support quarterly toggle, badges, strikethrough, promo plans.
10. **Usage dashboard** — New section for metered limits with progress bars.

---

## 11. Implementation Phases

### Phase 1: Schema

**Files modified:**
- `backend/prisma/schema/enums.prisma` — add `BillingCycle`, `PlanVisibility`, `AddOnType`
- `backend/prisma/schema/billing.prisma` — rewrite `SubscriptionPlan`, add `TenantUsage`, `PlanAddOn`, `TenantAddOn`, `TrialEmailRegistry`, add `purchaseType`/`addOnId` to Payment/Invoice, move `TenantSubscription` here, delete `Feature`/`PlanFeature`/`PlanIntegration`
- `backend/prisma/schema/tenant.prisma` — remove `TenantSubscription` model, add `usages`/`addOns` relations to `Tenant`
- `backend/prisma/schema/platform.prisma` — add `defaultGraceDays`, `trialRetentionDays`, `paidRetentionDays`

**Commands:**
```powershell
cd backend
npx prisma migrate dev --name plans_v2_schema
```

**Verification:** `npx prisma validate` + `npx prisma generate` + confirm migration SQL looks correct.

**Files needed from user at phase start:** None (all schema files already reviewed).

---

### Phase 2: Entitlement Engine

**Files created:**
- `backend/src/lib/entitlements/registry.js` — entitlement registry + integration catalog + channel catalog
- `backend/src/lib/entitlements/entitlement.service.js` — 4-tier resolver (override → add-ons → plan → default)
- `backend/src/lib/entitlements/usage.service.js` — `consumeQuota()`, `getUsage()`, `getUsageSummary()`, period rollover, bonus pool
- `backend/src/lib/entitlements/access.js` — `checkFeatureAccess(tenantId, key)`, `checkLimitAccess(tenantId, key, requiredCount)` (new implementations)

**Verification:** Unit-level smoke tests via script or manual invocation.

**Files needed from user at phase start:** None.

---

### Phase 3: SuperAdmin Modules

**Files created:**
- `backend/src/modules/superadmin/plans/sradmin.plans.routes.js`
- `backend/src/modules/superadmin/plans/sradmin.plans.controller.js`
- `backend/src/modules/superadmin/plans/sradmin.plans.service.js`
- `backend/src/modules/superadmin/plans/sradmin.plans.schema.js`
- `backend/src/modules/superadmin/addons/sradmin.addons.routes.js`
- `backend/src/modules/superadmin/addons/sradmin.addons.controller.js`
- `backend/src/modules/superadmin/addons/sradmin.addons.service.js`
- `backend/src/modules/superadmin/addons/sradmin.addons.schema.js`
- `backend/src/modules/superadmin/subscriptions/sradmin.subscriptions.routes.js`
- `backend/src/modules/superadmin/subscriptions/sradmin.subscriptions.controller.js`
- `backend/src/modules/superadmin/subscriptions/sradmin.subscriptions.service.js`
- `backend/src/modules/superadmin/subscriptions/sradmin.subscriptions.schema.js`

**Files modified:**
- `backend/src/app.js` — mount new superadmin routes

**Files needed from user at phase start:**
- `backend/src/modules/superadmin/settings/sradmin.settings.routes.js` (convention reference)
- `backend/src/modules/superadmin/settings/sradmin.settings.controller.js` (convention reference)
- `backend/src/middleware/requireSRAdmin.js` (confirm import path/usage)

---

### Phase 4: Tenant Billing Flows

**Files created:**
- `backend/src/modules/tenant/plans/tenant.plans.routes.js`
- `backend/src/modules/tenant/plans/tenant.plans.controller.js`
- `backend/src/modules/tenant/plans/tenant.plans.service.js`
- `backend/src/modules/tenant/plans/tenant.plans.schema.js`
- `backend/src/modules/tenant/billing/tenant.billing.routes.js`
- `backend/src/modules/tenant/billing/tenant.billing.controller.js`
- `backend/src/modules/tenant/billing/tenant.billing.service.js`
- `backend/src/modules/tenant/billing/tenant.addons.routes.js`
- `backend/src/modules/tenant/billing/tenant.addons.controller.js`
- `backend/src/modules/tenant/billing/tenant.addons.service.js`

**Files modified:**
- `backend/src/app.js` — mount new tenant routes, unmount old plan/billing routes
- `backend/src/modules/webhook/razorpay/razorpay.webhook.controller.js` — rewrite for V2 flows

**Files needed from user at phase start:**
- `backend/src/modules/webhook/razorpay/razorpay.webhook.controller.js` (full rewrite base)
- `backend/src/config/razorpay.js` (client setup)
- `backend/src/lib/billing.js` (GST helper — already have, confirm no changes)

---

### Phase 5: Enforcement, Middleware, Cron

**Files created:**
- `backend/src/utils/tenantDeletion.js` — shared cascade delete util
- `backend/src/cron/jobs/data-deletion.job.js` — 7/90-day purge executor
- New email templates:
  - `backend/src/modules/email/templates/gracePeriodStarted.js`
  - `backend/src/modules/email/templates/gracePeriodEnding.js`
  - `backend/src/modules/email/templates/accountBlocked.js`
  - `backend/src/modules/email/templates/trialExpiring.js`
  - `backend/src/modules/email/templates/trialDeleted.js`
  - `backend/src/modules/email/templates/addonPurchased.js`

**Files rewritten:**
- `backend/src/middleware/subscriptionAccess.js` — grace window, freeUntilDate, blocked state (export name preserved)

**Files modified:**
- `backend/src/middleware/requireTenant.js` — subscription include update
- `backend/src/middleware/requireTenantOrUser.js` — subscription include update
- `backend/src/modules/automation/flow.controller.js` — new engine import
- `backend/src/modules/broadcasts/broadcast.controller.js` — new engine import
- `backend/src/modules/tenant/users/tenant.users.service.js` — new engine import
- `backend/src/modules/tenant/auth/tenant.auth.service.js` — sanitizeTenant, SUBSCRIPTION_INCLUDE
- `backend/src/modules/tenant/profile/tenant.profile.controller.js` — subscription include
- `backend/src/modules/users/user.service.js` — planStatus → subscriptionStatus
- `backend/src/modules/tenant/integrations/tenant.integrations.controller.js` — integration gating
- `backend/src/modules/enterprise-leads/enterpriseLead.controller.js` — custom plan activation
- `backend/src/modules/superadmin/tenant/sradmin.tenant.service.js` — entitlements JSONB
- `backend/src/modules/superadmin/reports/sradmin.reports.service.js` — field updates
- `backend/src/modules/superadmin/revenue/sradmin.revenue.service.js` — field updates
- `backend/src/cron/jobs/expired-subscriptions.job.js` — grace entry/exit, debt, retention split
- `backend/src/cron/jobs/expiry-reminders.job.js` — trial + grace reminders
- `backend/src/cron/jobs/abandoned-accounts.job.js` — shared deletion util
- `backend/src/modules/email/index.js` — export new templates

**Files needed from user at phase start:**
- `backend/src/middleware/requireTenant.js`
- `backend/src/middleware/requireTenantOrUser.js`
- `backend/src/modules/tenant/profile/tenant.profile.controller.js`
- `backend/src/modules/users/user.service.js`
- `backend/src/modules/tenant/integrations/tenant.integrations.controller.js`
- `backend/src/modules/enterprise-leads/enterpriseLead.controller.js`
- `backend/src/modules/superadmin/reports/sradmin.reports.service.js`
- `backend/src/modules/superadmin/revenue/sradmin.revenue.service.js`
- `backend/src/modules/email/index.js` (template export pattern)

---

### Phase 6: V1 Purge & Verification

**Files deleted:**
- `backend/src/lib/plan.limits.js`
- `backend/src/modules/plans/plan.routes.js`
- `backend/src/modules/plans/plan.controller.js`
- `backend/src/modules/plans/plan.service.js`
- `backend/src/modules/plans/plan.schema.js`
- `backend/src/modules/plans/invoice.service.js`
- `backend/src/modules/billing/billing.controller.js`
- `backend/src/modules/billing/billing.routes.js`
- `backend/src/modules/admin-subscriptions/adminSubscription.controller.js`
- `backend/src/modules/admin-subscriptions/adminSubscription.routes.js`

**Verification sweep (must return zero hits):**
```powershell
Get-ChildItem -Recurse -Include *.js backend\src | Select-String -Pattern "plan\.limits|maxAgents|maxAutomations|maxAiCredits|maxApiCalls|hasUsedTrial|trialExtended|enterprise_active|planStatus|PlanFeature|PlanIntegration"
Get-ChildItem -Recurse -Include *.js backend\src | Select-String -Pattern "modules/plans/plan|modules/billing/billing|modules/admin-subscriptions"
```

**Final steps:**
1. `npx prisma validate`
2. `npx prisma generate`
3. Server boot test (`npm run dev`)
4. Manual cron job triggers (dry-run mode)
5. API smoke tests (list plans, start trial, subscribe, check limits)
6. Update this document with final status

---

## 12. Decisions Log

| # | Decision | Rationale |
| :--- | :--- | :--- |
| 1 | Registry + JSONB over EAV | Single source of truth in code; JSONB for flexible per-plan values |
| 2 | Drop all V1 scalar limit columns | Clean break, no dual-write complexity |
| 3 | Drop `planStatus` field | Dual status fields caused drift; single `subscriptionStatus` + `gracePeriodEnd` |
| 4 | Drop `hasUsedTrial` | `TrialEmailRegistry` is permanent source of truth |
| 5 | Drop `enterprise_active` magic status | Enterprise = custom plan with -1 entitlements |
| 6 | `-1` = unlimited sentinel | `null` ambiguous with "not set"; `0` means blocked |
| 7 | No-card trials | Boss decision; reduces friction |
| 8 | One trial per email ever | Prevents trial abuse; `TrialEmailRegistry` survives deletion |
| 9 | 7-day retention for never-paid, 90-day for ever-paid | Business decision |
| 10 | Grace debt: forgiven on upgrade, deducted on same/downgrade | Incentivizes upgrades |
| 11 | Quarterly billing support | Boss decision; Razorpay `interval: 3` |
| 12 | No Free Forever plan | Trial only |
| 13 | Add-ons fully built now | Boss decision |
| 14 | Recurring add-ons = independent Razorpay subscriptions | Avoids proration complexity |
| 15 | One-time top-ups = bonus pool in TenantUsage | Credits don't expire |
| 16 | Custom plans = planType CUSTOM + customTenantId | SuperAdmin-managed, offline-billed |
| 17 | Number masking = free for all | Business decision; not in registry |
| 18 | Integrations = code catalog + admin assignment | Developer adds line to registry; admin picks |
| 19 | No proration | Upgrades/downgrades apply at period end |
| 20 | Backend only scope | Frontend breakage documented, fixed in later session |
| 21 | Full V1 purge | No backward compatibility |
| 22 | Module naming: `sradmin.*` prefix in `superadmin/` folder | Existing convention |
| 23 | Tenant modules in `tenant/` folder | Existing convention |
| 24 | `checkSubscriptionAccess` export name preserved | Zero route file changes |
| 25 | `lib/billing.js` unchanged | GST helper, not plan-related |
| 26 | `zoho.plan.service.js` unchanged | Detects Zoho CRM edition, not our plan system |

---

## 13. Business Context (Boss Decisions)

1. **No wallet** — tenants pay Meta/provider directly; subscription fee only
2. **Add-ons: build fully now**
3. **Quarterly billing: yes** (Monthly/Quarterly/Yearly)
4. **No Free Forever plan** — trial only
5. **Trial: no card needed** — instant start
6. **Channels = which apps allowed** (WhatsApp/Instagram/Messenger)
7. **Number masking = free for everyone** — not a plan feature
8. **Tenant-level overrides: yes**
9. **Monthly reset for metered limits; static counts for seats/tags**
10. **Mid-cycle changes apply at period end** (no proration)
11. **Storage limit covers uploaded media**
12. **Grace period: per-tenant configurable + global default; debt rules as specified**
13. **Marketing tools: reordering, badges, strikethrough, limited-time offers, hidden promo plans**

---

**END OF DOCUMENT**




## 14. Implementation Progress Log

| Phase | Scope | Status | Completed | Notes |
| :--- | :--- | :--- | :--- | :--- |
| P1 | Schema (`plans_v2_schema`) | ✅ DONE | 2026-11-18 | Migration `20261118074054_plans_v2_schema` applied; `prisma validate` passes |
| P2 | Entitlement engine (`lib/entitlements/*`) | ✅ DONE | 2026-11-18 | `registry.js`, `entitlement.service.js`, `usage.service.js`, `access.js`; errata 1–4 resolved in P3E |
| P3A | SuperAdmin — Plans module | ✅ DONE | 2026-11-18 | `sradmin.plans.*` (4 files) + `lib/utils/http.error.js` + audit retrofit; mounted at `/sradmin/plans` |
| P3B | SuperAdmin — Add-ons + subscription policy + audit helper | ✅ DONE | 2026-11-18 | `sradmin.addons.*` (4 files), `sradmin.settings.*` policy endpoints, `lib/utils/admin.audit.js`; migration `20261118093653_audit_actions_plans_v2` |
| P3D | Schema amendment (`plans_v2_amendments`) | ✅ DONE | 2026-11-18 | Migration `20261118095806_plans_v2_amendments` (`pendingPlanId`, `pendingBillingCycle`, `Invoice.billingCycle`/`paymentId`, `TenantAddOn.source`, 20 `AuditAction` values) |
| P3C | SuperAdmin — Subscriptions module + PDF generator | ✅ DONE | 2026-11-18 | `sradmin.subscriptions.*` (4 files), `lib/invoice.js`, `deletePlanService` pending guard; mounted at `/sradmin/subscriptions` |
| P3E | Entitlement engine hardening | ✅ DONE | 2026-11-18 | Atomic `consumeQuota`, `TenantCreditPool` (`bonus` dropped), monthly anchored usage windows, live storage counter + `MediaAsset` ledger, ctx-based checks, top-up grants; migration `20261118104510_entitlement_engine_hardening` |
| P4A | Tenant Plans catalog, instant trial & scheduled plan change | ✅ DONE | 2026-11-18 | `lib/billingPeriod.js` + `tenant.plans.*` (catalog, promo slug lookup, cardless trial, scheduled period-end change) |
| P4B | Tenant Plan checkout & verification (orders + autopay + signup add-ons) | ✅ DONE | 2026-11-18 | `tenant.plans.service.js` (`create-order`, `verify-payment`, `create-subscription`, `verify-subscription`, bundled signup add-ons, grace debt rules) |
| P4C | Tenant Add-ons/Top-ups commerce & Tenant Billing management | ✅ DONE | 2026-11-18 | `tenant.addons.*` + `tenant.billing.*` + `entitlement.service.js` (`cancel_at_period_end` add-on entitlement window) |
| P4D | Razorpay webhook rewrite & route cutover (`app.js`) | ✅ DONE | 2026-11-18 | `razorpay.webhook.controller.js` V2 rewrite (`PLAN | ADDON | TOPUP`) + `app.js` cutover to `/tenant/plans`, `/tenant/billing/addons`, `/tenant/billing` |
| P5A | Access & Auth Middleware + Webhook Gating | ✅ DONE | 2026-11-18 | `subscriptionAccess.js`, `requireTenant.js`, `requireTenantOrUser.js`, `webhook.worker.js` |
| P5B | Feature, Quota & Storage Enforcement Across Tenant Controllers/Services | ✅ DONE | 2026-11-18 | `flow.controller.js`, `broadcast.controller.js`, `tenant.users.service.js`, `user.service.js`, `tenant.profile.controller.js`, `enterpriseLead.controller.js`, `flowMedia.controller.js`, `template.controller.js`, `message.controller.js` |
| P5C | SuperAdmin Services, Integrations, Auth & Email Templates | ✅ DONE | 2026-11-18 | `tenant.integrations.controller.js`, `tenant.auth.service.js`, `sradmin.tenant.service.js`, `sradmin.revenue.service.js`, `sradmin.reports.service.js`, 9 new email templates in `modules/email/templates/*`, `modules/email/index.js` |
| P5D | Cron Jobs, Storage Alignment & Data/Media Deletion Engine | ✅ DONE | 2026-11-18 | `lib/entitlements/access.js`, `lib/entitlements/usage.service.js`, `utils/tenantDeletion.js`, `expired-subscriptions.job.js`, `expiry-reminders.job.js`, `abandoned-accounts.job.js`, `data-deletion.job.js` (7/90d tenant purge + 14d soft-deleted media purge), `server.js` |
| P6 | V1 purge & end-to-end verification | ✅ DONE | 2026-11-18 | Deleted `lib/plan.limits.js`, `modules/plans/*`, `modules/billing/*`, `modules/admin-subscriptions/*`; completed V2 `razorpay.webhook.controller.js` cutover; 0 V1 grep matches; `prisma validate` & `prisma generate` passed |

### Phase 1 — Schema Amendments Applied

1. `TenantSubscription` preserves all merchant gateway + Razorpay Partner OAuth fields.
2. `TenantSubscription` PK is `tenantId @id`; table is `tenant_subscription`. Added `createdAt`/`updatedAt`.
3. `SubscriptionPlan` drops V1 `isPopular`, `maxBroadcasts`, `maxCampaigns` scalars (`badgeText` supersedes `isPopular`; limits live in `entitlements` JSON).
4. `Payment.planId` is optional `String?` (no FK). `Payment` and `Invoice` have `purchaseType` (`PLAN | ADDON | TOPUP`) and `addOnId` (FK to `PlanAddOn`, `onDelete: Restrict`).
5. Grace period reuses `subscriptionStatus: payment_failed` + `gracePeriodEnd`.
6. `hasTrial` defaults to `false`.

### Phase 2 & 3E — Entitlement Engine Summary

- Files: `lib/entitlements/registry.js`, `entitlement.service.js`, `storage.service.js`, `usage.service.js`, `access.js`.
- Precedence: `customLimitsOverride[key]` (non-null) → base plan + active recurring add-ons (`INT` sums `value * quantity` with `-1` unlimited sentinel; `BOOLEAN` any-true; `STRING_ARRAY` union) → registry default.
- Monthly usage windows (`getUsageWindow`) are anchored on `planPeriodStart` (end-exclusive, end-of-month clamped) so `extend` never resets usage.
- One-time top-ups increment `TenantCreditPool` (`granted`, `consumed`) and never expire; `consumeQuota` drains base monthly quota first, then spills into `TenantCreditPool`, using atomic conditional SQL `UPDATE`s.
- `maxStorageMb` sums distinct physical media files per tenant across `Message.mediaSize` (via `Conversation.tenantId`), `QuickReply.mediaSize`, and `MediaAsset.sizeBytes` (for flow and template header media).
- Static limits (`maxAgents`, `maxContacts`, `maxTags`, `maxAttributes`, `maxAutomations`) use check-then-create (slight overshoot under concurrency is accepted).

### Phase 3A–3D — SuperAdmin Modules Summary

- `/sradmin/plans`: full CRUD, status toggle, full-list reorder, registry metadata endpoint, `BILLING` audit logging.
- `/sradmin/addons`: full CRUD, status toggle, full-list reorder for `RECURRING` and `ONE_TIME_TOPUP` add-ons.
- `/sradmin/settings/subscription-policy`: `GET`/`PUT` for `defaultGraceDays`, `trialRetentionDays`, `paidRetentionDays`.
- `/sradmin/subscriptions`: list, detail (with effective entitlements + usage + credit pools), `extend`, `extend-trial`, `change-plan` (`IMMEDIATE | AT_PERIOD_END | CLEAR_PENDING`), `manual-activate` (with GST invoice + PDF + idempotency key `OFFLINE:<tenantId>:<ref>`), `pause`, `reactivate`, `expire`, `limits`, `grace`, `free-until`, `addons/grant` (recurring + top-up), `addons/:tenantAddOnId/revoke`.

### Phase 4A–4D — Tenant Billing & Webhook Summary

- `lib/billingPeriod.js`: shared cycle math (`MONTHLY`, `QUARTERLY`, `ANNUAL`), same-plan mid-cycle extension preservation (`planPeriodStart` kept), grace debt forgiveness/deduction, lazy Razorpay plan creation with stale-ID recovery.
- `/tenant/plans`: public/catalog listing, promo slug resolution (`HIDDEN_LINK_ONLY`), instant cardless trial (`TrialEmailRegistry`), scheduled period-end plan change, one-time order checkout + verification (with optional bundled signup add-ons), autopay subscription checkout + verification.
- `/tenant/billing/addons`: catalog + active/cancelled recurring add-ons + credit pools, one-time & recurring add-on order/autopay checkout, cancel-at-period-end (entitlements stay active until `expiresAt`).
- `/tenant/billing`: current subscription + effective entitlements + usage summary + credit pools, cancel/resume subscription, paginated invoices & payments, invoice PDF download.
- `razorpay.webhook.controller.js`: unified V2 webhook processor handling `order.paid`, `payment.failed`, `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted` (grace entry with `gracePeriodEnd` and `graceDebtPlanPrice`), `subscription.paused`, `subscription.resumed`, and `refund.processed` (`Invoice.status = "refunded"`).

### Phase 5A–5D — Enforcement, Lifecycle Cron & Storage Deletion Summary

- `middleware/subscriptionAccess.js`: attaches `req.entitlements` (from `getTenantEntitlements`) and `req.subscription = req.entitlements.subscription`; enforces `freeUntilDate` bypass, `trialing` / `active` / `cancel_at_period_end` date bounds, and `payment_failed` grace period access (`req.inGracePeriod = true`).
- `cron/workers/webhook.worker.js`: gates inbound WhatsApp webhooks by `isTenantEntitled` + `checkChannelAccess(tenantId, "WHATSAPP")`, and gates automation trigger dispatching via `enforceAndConsumeQuota(tenantId, "automationTriggersPerMonth", 1)`.
- Feature, static limit, metered quota, and storage checks wired across flows (`maxAutomations`), broadcasts (`broadcastEnabled`, `broadcastScheduleEnabled`, `clickTrackingEnabled`, `autoRetryEnabled`, `messagingSpeed`), team seats (`maxAgents`), contacts (`maxContacts`), tags (`maxTags`), custom attributes (`maxAttributes`), integrations (`integrationsEnabled`, `maxIntegrations`), enterprise leads (custom plan metadata), and media uploads (`maxStorageMb` + `MediaAsset` ledger for `flowMedia` and `template` headers + `message` attachments).
- Lifecycle cron jobs:
  - `expired-subscriptions.job.js`: executes scheduled `pendingPlanId` switches when autopay is enabled, transitions overdue `trialing` / `active` / `cancel_at_period_end` / `payment_failed` (past `gracePeriodEnd`) subscriptions to `expired`, computes `dataDeletionDate` (`trialRetentionDays` 7d vs `paidRetentionDays` 90d from `PlatformSettings`), and marks active recurring `TenantAddOn` rows as `cancel_at_period_end`.
  - `expiry-reminders.job.js`: sends 3-day / 1-day trial and paid plan expiry reminders, grace period ending reminders, and 2-day pre-deletion warnings.
  - `abandoned-accounts.job.js`: purges `none` / `pending_payment` accounts older than 7 days via `deleteTenantsCompletely` (preserving `TrialEmailRegistry`).
  - `data-deletion.job.js`: purges expired tenant workspace data & VPS media directories past `dataDeletionDate` (`purgeTenantWorkspaceData`, preserving tenant shell + billing/invoice history) and hard-deletes soft-deleted `Message` media and `MediaAsset` files older than 14 days.

### Phase 6 — V1 Purge & Verification Summary

- Deleted legacy V1 files (`backend/src/lib/plan.limits.js`, `backend/src/modules/plans/*`, `backend/src/modules/billing/*`, `backend/src/modules/admin-subscriptions/*`).
- Verified zero remaining V1 references across `backend/src` (`Select-String` case-sensitive sweep returned 0 matches).
- `npx prisma validate` and `npx prisma generate` verified clean.