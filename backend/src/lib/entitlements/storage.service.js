// backend/src/lib/entitlements/storage.service.js (do not remove this comment)
import prisma from "../../config/prisma.js";

export const BYTES_PER_MB = 1024 * 1024;

/** "uploads\\tenants\\x" and "/uploads/tenants/x" both become "uploads/tenants/x". */
export const normalizeMediaUrl = (url) =>
  String(url ?? "").replace(/\\/g, "/").replace(/^\/+/, "");

/**
 * Physical footprint of a tenant's media, in bytes.
 *
 * Sources: Message.mediaSize (via conversation.tenantId), QuickReply.mediaSize, MediaAsset.sizeBytes.
 * - Deduplicated by normalised URL: a broadcast sending ONE file to N contacts, or a template header
 *   also referenced by messages, counts once.
 * - Only files under ".../tenants/<tenantId>/" count (keeps external CDN URLs out; also works with S3 keys).
 * - Soft-deleted media still counts until the purge job nulls mediaSize / removes the row.
 * Reads DB rows, never the disk, so moving uploads to S3 does not affect it.
 */
export const getStorageUsedBytes = async (tenantId) => {
  const marker = `tenants/${tenantId}/`;
  const rows = await prisma.$queryRaw`
    SELECT COALESCE(SUM(f."size"), 0)::float8 AS "bytes"
    FROM (
      SELECT DISTINCT ON (u."url") u."size"
      FROM (
        SELECT LTRIM(REPLACE(m."mediaUrl", CHR(92), '/'), '/') AS "url", m."mediaSize"::bigint AS "size"
        FROM "messages" m
        JOIN "conversations" c ON c."id" = m."conversationId"
        WHERE c."tenantId" = ${tenantId}
          AND m."mediaUrl" IS NOT NULL AND m."mediaSize" IS NOT NULL
        UNION ALL
        SELECT LTRIM(REPLACE(q."mediaUrl", CHR(92), '/'), '/'), q."mediaSize"::bigint
        FROM "quick_replies" q
        WHERE q."tenantId" = ${tenantId}
          AND q."mediaUrl" IS NOT NULL AND q."mediaSize" IS NOT NULL
        UNION ALL
        SELECT LTRIM(REPLACE(a."url", CHR(92), '/'), '/'), a."sizeBytes"::bigint
        FROM "media_assets" a
        WHERE a."tenantId" = ${tenantId}
      ) u
      WHERE POSITION(${marker}::text IN u."url") > 0
      ORDER BY u."url"
    ) f
  `;
  return Number(rows?.[0]?.bytes ?? 0);
};

/** Records (or refreshes) a ledger row for an uploaded file. Call right after the upload succeeds. */
export const registerMediaAsset = async (
  { tenantId, kind, url, fileName, mimeType, sizeBytes },
  db = prisma
) => {
  if (!tenantId || !url) throw new Error("registerMediaAsset: tenantId and url are required");
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0) {
    throw new Error("registerMediaAsset: sizeBytes must be a non-negative integer");
  }
  const normalized = normalizeMediaUrl(url);
  const name = fileName || normalized.split("/").pop() || "file";
  const mime = mimeType || "application/octet-stream";
  return db.mediaAsset.upsert({
    where: { tenantId_url: { tenantId, url: normalized } },
    create: { tenantId, kind, url: normalized, fileName: name, mimeType: mime, sizeBytes },
    update: { sizeBytes, fileName: name, mimeType: mime, deletedAt: null },
  });
};

/** Starts the 14-day purge clock. The P5 job removes the file and the row afterwards. */
export const markMediaAssetDeleted = (tenantId, url, db = prisma) =>
  db.mediaAsset.updateMany({
    where: { tenantId, url: normalizeMediaUrl(url), deletedAt: null },
    data: { deletedAt: new Date() },
  });

/** Use after the physical file has been removed immediately (hard delete). */
export const removeMediaAssetRow = (tenantId, url, db = prisma) =>
  db.mediaAsset.deleteMany({ where: { tenantId, url: normalizeMediaUrl(url) } });