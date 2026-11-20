// backend/src/modules/audit/tenant.audit.js (do not remove this comment)
import { createAuditLog } from "./audit.service.js";

/**
 * Helper to log tenant-scoped audit entries.
 * Wraps createAuditLog to handle targetRef and tenant metadata consistently.
 */
export async function logTenantAudit(params = {}) {
  const {
    tenantId,
    actorType = "TENANT",
    actorId = null,
    actorName = null,
    actorEmail = null,
    action,
    module,
    description = "",
    targetId = null,
    targetType = null,
    targetName = null,
    targetRef = null,
    ipAddress = null,
    userAgent = null,
    metadata = null,
    ...rest
  } = params;

  // Preserve targetRef inside metadata if supplied
  const mergedMetadata = {
    ...(metadata || {}),
    ...(targetRef ? { targetRef } : {}),
    ...rest,
  };

  return createAuditLog({
    tenantId,
    actorType,
    actorId: actorId ? String(actorId) : null,
    actorName,
    actorEmail,
    action,
    module,
    description: description || `${action} on ${module}`,
    targetId: targetId ? String(targetId) : null,
    targetType,
    targetName,
    ipAddress,
    userAgent,
    metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : null,
  });
}