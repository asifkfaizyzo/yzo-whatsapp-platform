// backend/src/modules/tenant/tenant.schema.js (do not remove this comment)
// Barrel re-export — schemas now live in their sub-module folders.
// This file exists for backward compatibility only.

export { step1Schema, step2Schema, step3Schema, step4Schema, step5Schema } from './auth/tenant.auth.schema.js';
export { updateTenantProfileSchema } from './profile/tenant.profile.schema.js';
export { updateAutoReopenSchema } from './conversations/tenant.conversations.schema.js';