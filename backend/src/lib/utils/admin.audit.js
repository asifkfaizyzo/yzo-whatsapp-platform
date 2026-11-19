// backend/src/lib/utils/admin.audit.js (do not remove this comment)
import { createAuditLog } from "../../modules/audit/audit.service.js";

/**
 * Thin SuperAdmin wrapper over createAuditLog (never throws — createAuditLog swallows errors).
 * Mirrors the existing settings-service pattern: skipped when no actor is present.
 *
 * entry: { action, module, description, targetId?, targetType?, targetName?, tenantId?, metadata? }
 */
export const logAdminAction = async (actor, meta = {}, entry) => {
  if (!actor?.id) return null;

  return createAuditLog({
    actorId: actor.id,
    actorType: "SUPER_ADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: entry.action,
    module: entry.module,
    description: entry.description,
    targetId: entry.targetId ?? null,
    targetType: entry.targetType ?? null,
    targetName: entry.targetName ?? null,
    tenantId: entry.tenantId ?? null,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
    metadata: entry.metadata ?? null,
  });
};

/**
 * Field-level diff for audit metadata → { field: { from, to } } for changed fields only.
 */
export const buildChangeSet = (before, after, fields) => {
  const changes = {};
  for (const field of fields) {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[field] = { from, to };
    }
  }
  return changes;
};