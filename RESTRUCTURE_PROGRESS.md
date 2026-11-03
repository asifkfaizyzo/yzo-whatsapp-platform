# backend/RESTRUCTURE_PROGRESS.md (do not remove this comment)

# Sudo Reply Backend — Restructure Progress Guide

> **Last updated:** 2026-11-03
> **Lead:** Asif (dev)
> **Reference project:** Cureli ERP (`Q:\YourZeroesAndOnes\cureli\curely_erp\backend`)
> **Target project:** Sudo Reply (`Q:\YourZeroesAndOnes\SudoReply\yzo-whatsapp-platform\backend`)

---

## 1. Context

- Sudo Reply is a WhatsApp Business platform (multi-tenant SaaS).
- An intern built it while Asif was working on Cureli.
- The boss wants a proper review and restructure to match Cureli's standards.
- **Rule:** Restructure only — no logic changes unless fixing a clear bug that won't affect the current system.
- **Rule:** "When I say mirror Cureli, I mean just the structure" — don't overthink module separation.
- **Rule:** Backend must be finalized before any frontend planning.

---

## 2. Phases Overview

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Prisma schema split + @@map() | ✅ **DONE** | Split monolith into 20 files, snake_case all tables |
| 2. src/ folder restructure | ⏳ **NEXT** | Mirror Cureli's module pattern |
| 3. Tenant God Model normalization | ⏳ **PLANNED** | Break 80+ field Tenant into 1:1 related tables |
| 4. Frontend restructure | ⏳ **LATER** | After backend is stable |

### Deferred (NOT this sprint)
- `cuid()` vs `uuid()` ID standardization (requires data migration)
- Any logic refactors or API changes

---

## 3. Phase 1 — Prisma Schema Split (COMPLETED)

### What was done

#### 3.1 Split monolithic `schema.prisma` (~2k lines, ~57 models, ~35 enums) into 20 files:

| # | File | Contents |
|---|------|----------|
| 1 | `config.prisma` | generator + datasource |
| 2 | `enums.prisma` | ~32 enums (3 dead removed) |
| 3 | `auth.prisma` | SuperAdmin, User, RefreshToken, PasswordReset |
| 4 | `tenant.prisma` | Tenant (80+ field god model, unchanged for now) |
| 5 | `contacts.prisma` | Contact, Tag, ContactTagMapping, UserTagMapping, ContactProviderMapping |
| 6 | `conversations.prisma` | Conversation, Message, ConversationActivity, AutoReopenConfig |
| 7 | `templates.prisma` | Template |
| 8 | `broadcasts.prisma` | Broadcast, BroadcastTag, BroadcastRecipient |
| 9 | `notifications.prisma` | Notification, SuperAdminNotification |
| 10 | `tickets.prisma` | Ticket, TicketMessage |
| 11 | `quick-replies.prisma` | QuickReply |
| 12 | `automation.prisma` | Flow, FlowNode, KeywordTrigger, BotFaq |
| 13 | `orders.prisma` | Order, OrderItem |
| 14 | `billing.prisma` | SubscriptionPlan, Feature, PlanFeature, PlanIntegration, Payment, Invoice, SubscriptionReminder, CancellationSurvey, TenantDataDeletion |
| 15 | `shopify.prisma` | ShopifyConnection, ShopifyProduct, ShopifyProductVariant, ShopifyProductImage, BackInStockSubscription |
| 16 | `woocommerce.prisma` | WooCommerceConnection, EcommerceOrder |
| 17 | `integrations.prisma` | GoogleSheetConnection, SheetField, WebhookEvent |
| 18 | `calling.prisma` | WaPhoneCallSetting, WaCallPermission, WaCall, WaCallRecording, WaCallTranscript |
| 19 | `platform.prisma` | PlatformSettings, Enquiry, EnterpriseLead |
| 20 | `audit.prisma` | AuditLog |

All files live in `backend/prisma/schema/`.

#### 3.2 Config change
- `prisma.config.ts` line 5: `"prisma/schema.prisma"` → `"prisma/schema"` (points to directory)

#### 3.3 Dead enums removed
- `CompanySize` — not used by any model field
- `ContactTimeline` — not used by any model field
- `PreferredContact` — not used by any model field
- Verified safe: `tenant.validation.js` uses `companySize` as a Zod string field name, not the Prisma enum

#### 3.4 @@map() standardization
- 23 models already had `@@map()` → kept as-is
- 33 models had PascalCase table names → added `@@map("snake_case")` to all
- All DB tables now use snake_case names

#### 3.5 Migrations applied

**Migration 1:** `20261102120000_rename_tables_to_snake_case` (manual)
- 39 `ALTER TABLE RENAME` statements (PascalCase → snake_case)
- 3 `DROP TYPE` statements (dead enums)
- Written manually because Prisma's `migrate dev --create-only` generated DROP TABLE + CREATE TABLE instead of RENAME (couldn't detect @@map rename)

**Migration 2:** `20261102130000_check_no_drift` (auto-generated)
- RENAME CONSTRAINT + RENAME INDEX only (cosmetic, PascalCase → snake_case)
- Originally created as `20261102112739` but renamed to `130000` to fix shadow DB replay ordering (must come AFTER the table rename migration)

#### 3.6 Raw SQL fix
- `src/scripts/initQuickReplyIndexes.js` — two `$executeRawUnsafe()` calls referenced `"QuickReply"` (PascalCase)
- Fixed to `"quick_replies"` (lines 8 and 14, ON clause only)
- Index names left as-is (`QuickReply_tenant_shortcut_*`) since they already exist and `IF NOT EXISTS` checks by name
- Full grep confirmed: **zero other raw SQL references** to old PascalCase table names

### Prod Deployment Notes (CRITICAL)

- **Use `npx prisma migrate deploy`** on prod — it ignores old checksum drift and only runs new migrations
- **Do NOT use `npx prisma migrate dev`** on prod — local DB had 93 "modified after applied" checksum warnings from intern editing migration files, which blocks `migrate dev`
- Local was fixed with `npx prisma migrate reset --force` (acceptable for local, NEVER for prod)
- `migration_lock.toml` was corrupted after reset (`<PROVIDER NOT FOUND>`) — fixed by overwriting with `provider = "postgresql"`

---

## 4. Phase 2 — src/ Folder Restructure (NEXT)

### Goal
Mirror Cureli's module pattern. Mechanical change only — no logic changes.

### Cureli's structure (gold standard)
- Module-based: `src/modules/<module>/<entity>.controller.js`, `<entity>.routes.js`, `<entity>.schema.js`, `<entity>.service.js`
- Naming convention: `entity.type.js` (dots, not camelCase)
- Shared utilities in `src/lib/`, `src/middlewares/`, `src/config/`

### Files needed from Asif to plan this phase
- `src/app.js`
- `src/server.js`
- `src/lib/socket.js`
- `src/lib/rateLimiter.js`
- `src/queues/broadcastQueue.js`
- `src/workers/broadcastWorker.js`
- `src/modules/shopify/shopifyRoutes.js`
- `src/modules/auth/jwtservice.js`

### Key decisions pending
- Exact module groupings (which services go under which module)
- How to handle workers/queues (Cureli pattern vs current pattern)
- Import path updates across all files

---

## 5. Phase 3 — Tenant God Model Normalization (PLANNED)

### Current state
- `Tenant` model has 80+ fields covering: WhatsApp config, Razorpay billing, Shopify integration, WooCommerce, calling, general settings, onboarding state, etc.
- All in one table, all in one Prisma model

### Target state
- Split into 1:1 related tables by domain (e.g., `TenantWhatsappConfig`, `TenantBillingConfig`, `TenantShopifyConfig`, etc.)
- Keep core identity fields on Tenant (id, name, email, status, planId)
- Each config table has a `tenantId` FK with a unique constraint

### Why AFTER src/ restructure
- Normalization will touch many service files (every place that reads `tenant.whatsappPhoneId`, `tenant.razorpaySubscriptionId`, etc.)
- If src/ is already clean and modular, we know exactly which modules to update
- Doing both simultaneously = double churn, high merge conflict risk
- Easier to review logic changes when file structure is already stable

### Decisions not yet made
- Exact split boundaries (which fields go to which 1:1 table)
- Data migration strategy (SQL script to move columns to new tables)
- Backward compatibility (do we keep old columns temporarily with a deprecation period?)
- Whether to do it in one big migration or incrementally

---

## 6. Known Gotchas & Lessons Learned

1. **Prisma can't detect @@map renames** — `migrate dev --create-only` will generate DROP + CREATE instead of ALTER TABLE RENAME. Always write table rename migrations manually.
2. **Migration folder timestamps matter** — Prisma replays in chronological order in the shadow DB. If migration B depends on migration A, B's timestamp must be later.
3. **`migration_lock.toml` can corrupt** after `migrate reset` — check the `provider` field if you get weird errors.
4. **Raw SQL doesn't respect @@map()** — `$executeRawUnsafe()` and `$queryRawUnsafe()` use actual DB table names, not Prisma model names. Always grep for these after any table rename.
5. **Checksum drift from intern edits** — old migrations were modified after being applied. Prod uses `migrate deploy` which ignores this. Local was reset.
6. **Every new/modified file must have its exact project-relative path as a comment on the first line.**

---

## 7. How to Resume If You Lose Context

1. Read this file.
2. Check current phase status in the table above.
3. If Phase 2 (src/ restructure) is next, provide the files listed in Section 4 to your AI assistant.
4. Reference Cureli at `Q:\YourZeroesAndOnes\cureli\curely_erp\backend` for the target structure.
5. Remember: **restructure only, no logic changes** unless fixing a safe bug.

---

*This document should be updated as each phase completes.*