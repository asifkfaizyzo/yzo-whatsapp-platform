import prisma from '../../config/prisma.js';

// ─────────────────────────────────────────
// HOW MANY DAYS TO KEEP LOGS
// ─────────────────────────────────────────
const RETENTION_DAYS = 90;


// ─────────────────────────────────────────
// CREATE AUDIT LOG
// Call this after every important action
// ─────────────────────────────────────────
export const createAuditLog = async ({
  actorId,
  actorType,
  actorName,
  actorEmail,
  action,
  module,
  description,
  targetId   = null,
  targetType = null,
  targetName = null,
  ipAddress  = null,
  userAgent  = null,
  metadata   = null,
  tenantId   = null,
}) => {
  try {
    const log = await prisma.auditLog.create({  // ← added return
      data: {
        actorId,
        actorType,
        actorName,
        actorEmail,
        action,
        module,
        description,
        targetId,
        targetType,
        targetName,
        ipAddress,
        userAgent,
        metadata,
        tenantId,
      },
    });

    return log; // ← return so callers can confirm it was saved

  } catch (error) {
    // ⚠️ Never crash the main flow because of audit log failure
    console.error('[AuditLog] Failed to write log:', error.message);
    console.error('[AuditLog] Action:', action, '| Actor:', actorId); // ← better debug info
    return null; // ← explicit null so callers can check if needed
  }
};


// ─────────────────────────────────────────
// GET AUDIT LOGS
// SuperAdmin views logs with filters
// ─────────────────────────────────────────
export const getAuditLogsService = async (filters = {}) => {
  const {
    actorType,
    action,
    module,
    tenantId,
    search,
    dateFrom,
    dateTo,
    page  = 1,
    limit = 20,
  } = filters;

  // ── Build filter conditions ──
  const where = {};

  if (actorType && actorType !== 'ALL') where.actorType = actorType;
  if (action    && action    !== 'ALL') where.action    = action;
  if (module    && module    !== 'ALL') where.module    = module;
  if (tenantId)                         where.tenantId  = tenantId;

  // Date range filter
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999); // include full day
      where.createdAt.lte = end;
    }
  }

  // Search filter
  if (search) {
    where.OR = [
      { actorName:   { contains: search, mode: 'insensitive' } },
      { actorEmail:  { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { targetName:  { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  // ── Query ──
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
      include: {
        tenant: {
          select: {
            id:         true,
            tenantName: true,
            email:      true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};


// ─────────────────────────────────────────
// GET AUDIT LOG STATS
// For the stats strip on top of the page
// ─────────────────────────────────────────
export const getAuditLogStatsService = async () => {
  const now       = new Date();
  const last24h   = new Date(now - 24 * 60 * 60 * 1000);
  const last7days = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    last24hCount,
    last7daysCount,
    failedLogins24h,
    byModule,
  ] = await Promise.all([

    // Total logs
    prisma.auditLog.count(),

    // Last 24 hours
    prisma.auditLog.count({
      where: { createdAt: { gte: last24h } },
    }),

    // Last 7 days
    prisma.auditLog.count({
      where: { createdAt: { gte: last7days } },
    }),

    // Failed logins in last 24h (security alert)
    prisma.auditLog.count({
      where: {
        action:    'LOGIN_FAILED',
        createdAt: { gte: last24h },
      },
    }),

    // Count by module
    prisma.auditLog.groupBy({
      by:      ['module'],
      _count:  { module: true },
      orderBy: { _count: { module: 'desc' } },
    }),

  ]);

  return {
    total,
    last24hCount,
    last7daysCount,
    failedLogins24h,
    byModule: byModule.map(m => ({
      module: m.module,
      count:  m._count.module,
    })),
  };
};


// ─────────────────────────────────────────
// CLEANUP OLD AUDIT LOGS
// Called by cron job every day at 2AM
// ─────────────────────────────────────────
export const cleanupOldAuditLogsService = async () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  // 1️⃣ Delete old logs — EXCEPT SYSTEM_CLEANUP logs (keep forever)
  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      action:    { not: 'SYSTEM_CLEANUP' },
    },
  });

  console.log(`[AuditCleanup] Deleted ${result.count} logs older than ${RETENTION_DAYS} days`);

  // 2️⃣ Write SYSTEM_CLEANUP audit log — only if something was deleted
  if (result.count > 0) {
    await createAuditLog({
      actorId:     'SYSTEM',
      actorType:   'SUPER_ADMIN', // fallback until SYSTEM added to enum
      actorName:   'Automated System',
      actorEmail:  'system@platform.internal',
      action:      'SYSTEM_CLEANUP',
      module:      'SYSTEM',
      description: `Automated cleanup deleted ${result.count} audit logs older than ${RETENTION_DAYS} days`,
      tenantId:    null,
      metadata: {
        deletedCount:  result.count,
        retentionDays: RETENTION_DAYS,
        cutoffDate:    cutoffDate.toISOString(),
        runAt:         new Date().toISOString(),
      },
    });
  } else {
    console.log('[AuditCleanup] No old logs to delete — skipping audit entry');
  }

  return {
    deletedCount:  result.count,
    cutoffDate,
    retentionDays: RETENTION_DAYS,
  };
};