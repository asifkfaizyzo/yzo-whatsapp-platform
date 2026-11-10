// backend/src/modules/superadmin/tenant/sradmin.tenant.service.js (do not remove this comment)

import prisma from "../../../config/prisma.js";
import { createAuditLog } from "../../audit/audit.service.js";
import { revokeAllTenantTokens, revokeAllTokens } from "../../../services/session.service.js";
import { createSuperAdminNotification } from "../../superadmin-notifications/superadminNotification.service.js";

// -- Safe select: never leak passwords or tokens --
const SAFE_TENANT_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  businessName: true,
  phone: true,
  address: true,
  logo: true,
  status: true,
  isActive: true,
  onboardingStep: true,
  planId: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: { id: true, name: true, price: true, isActive: true } },
  _count: { select: { users: true } },
};

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  isActive: true,
  availabilityStatus: true,
  tenantId: true,
  createdAt: true,
};

// ---------------------------------------------------------------
// LIST TENANTS (paginated, filterable)
// ---------------------------------------------------------------
export const getAllTenantsService = async ({ page, limit, search, status, isActive }) => {
  const where = {};

  if (status) where.status = status;
  if (typeof isActive === "boolean") where.isActive = isActive;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { businessName: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: SAFE_TENANT_SELECT,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.tenant.count({ where }),
  ]);

  return {
    tenants,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ---------------------------------------------------------------
// GET TENANT BY ID (detailed view)
// ---------------------------------------------------------------
export const getTenantByIdService = async (id) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      ...SAFE_TENANT_SELECT,
      users: {
        select: SAFE_USER_SELECT,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!tenant) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  return tenant;
};

// ---------------------------------------------------------------
// UPDATE TENANT
// ---------------------------------------------------------------
export const updateTenantService = async (id, data, actor, meta) => {
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  // If changing username, check global uniqueness
  if (data.username && data.username !== existing.username) {
    const usernameTaken = await prisma.$queryRaw`
      SELECT 1 FROM (
        SELECT username FROM tenants WHERE username = ${data.username} AND id != ${id}
        UNION ALL
        SELECT username FROM users WHERE username = ${data.username}
        UNION ALL
        SELECT username FROM super_admins WHERE username = ${data.username}
      ) t LIMIT 1
    `;
    if (usernameTaken.length > 0) {
      const err = new Error("Username already taken");
      err.status = 409;
      throw err;
    }
  }

  // If changing email, check uniqueness
  if (data.email && data.email !== existing.email) {
    const emailExists = await prisma.tenant.findFirst({
      where: { email: data.email, id: { not: id } },
    });
    if (emailExists) {
      const err = new Error("Email already in use");
      err.status = 409;
      throw err;
    }
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data,
    select: SAFE_TENANT_SELECT,
  });

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "UPDATE_TENANT",
    module: "TENANT_MANAGEMENT",
    description: `Updated tenant "${existing.name}" (${id}). Fields: ${Object.keys(data).join(", ")}`,
    targetId: id,
    targetType: "TENANT",
    targetName: existing.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { changes: data },
  });

  return updated;
};

// ---------------------------------------------------------------
// APPROVE TENANT (PENDING ? ONBOARDING)
// ---------------------------------------------------------------
export const approveTenantService = async (id, actor, meta) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  if (tenant.status !== "PENDING") {
    const err = new Error(`Cannot approve tenant with status "${tenant.status}". Only PENDING tenants can be approved.`);
    err.status = 400;
    throw err;
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { status: "ONBOARDING" },
    select: SAFE_TENANT_SELECT,
  });

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "APPROVE_TENANT",
    module: "TENANT_MANAGEMENT",
    description: `Approved tenant "${tenant.name}" � status changed PENDING ? ONBOARDING`,
    targetId: id,
    targetType: "TENANT",
    targetName: tenant.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return updated;
};

// ---------------------------------------------------------------
// BLOCK TENANT (any status ? BLOCKED + revoke all sessions)
// ---------------------------------------------------------------
export const blockTenantService = async (id, reason, actor, meta) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  if (tenant.status === "BLOCKED") {
    const err = new Error("Tenant is already blocked");
    err.status = 400;
    throw err;
  }

  // Block + revoke all sessions (tenant + all agents) in a transaction
  const [updated, revoked] = await prisma.$transaction(async (tx) => {
    const u = await tx.tenant.update({
      where: { id },
      data: { status: "BLOCKED", isActive: false },
      select: SAFE_TENANT_SELECT,
    });

    // Revoke all refresh tokens for this tenant and their agents
    await tx.refreshToken.updateMany({
      where: {
        OR: [{ tenantId: id }, { user: { tenantId: id } }],
        isRevoked: false,
      },
      data: { isRevoked: true },
    });

    return [u, true];
  });

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "BLOCK_TENANT",
    module: "TENANT_MANAGEMENT",
    description: `Blocked tenant "${tenant.name}". Reason: ${reason}`,
    targetId: id,
    targetType: "TENANT",
    targetName: tenant.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { reason, previousStatus: tenant.status },
  });

  // Notify other SRAdmins
  await createSuperAdminNotification({
    type: "TENANT_BLOCKED",
    title: "Tenant Blocked",
    message: `Tenant "${tenant.name}" (${tenant.email}) has been blocked by ${actor.name}. Reason: ${reason}`,
    metadata: { tenantId: id, reason },
  });

  return updated;
};

// ---------------------------------------------------------------
// UNBLOCK TENANT (BLOCKED ? ACTIVE or ONBOARDING)
// ---------------------------------------------------------------
export const unblockTenantService = async (id, actor, meta) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  if (tenant.status !== "BLOCKED") {
    const err = new Error("Tenant is not blocked");
    err.status = 400;
    throw err;
  }

  // Determine correct status to restore:
  // If onboarding was never completed ? ONBOARDING
  // If onboarding was complete ? ACTIVE
  const restoredStatus = tenant.onboardingStep >= 5 ? "ACTIVE" : "ONBOARDING";

  const updated = await prisma.tenant.update({
    where: { id },
    data: { status: restoredStatus, isActive: true },
    select: SAFE_TENANT_SELECT,
  });

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "UNBLOCK_TENANT",
    module: "TENANT_MANAGEMENT",
    description: `Unblocked tenant "${tenant.name}" � status restored to ${restoredStatus}`,
    targetId: id,
    targetType: "TENANT",
    targetName: tenant.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { restoredStatus },
  });

  return updated;
};

// ---------------------------------------------------------------
// DEACTIVATE TENANT (soft disable, keeps status)
// ---------------------------------------------------------------
export const deactivateTenantService = async (id, actor, meta) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  if (!tenant.isActive) {
    const err = new Error("Tenant is already inactive");
    err.status = 400;
    throw err;
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { isActive: false },
    select: SAFE_TENANT_SELECT,
  });

  // Revoke sessions so they can't stay logged in
  await revokeAllTenantTokens(id);

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "DEACTIVATE_TENANT",
    module: "TENANT_MANAGEMENT",
    description: `Deactivated tenant "${tenant.name}"`,
    targetId: id,
    targetType: "TENANT",
    targetName: tenant.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return updated;
};

// ---------------------------------------------------------------
// REACTIVATE TENANT
// ---------------------------------------------------------------
export const reactivateTenantService = async (id, actor, meta) => {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  if (tenant.isActive) {
    const err = new Error("Tenant is already active");
    err.status = 400;
    throw err;
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { isActive: true },
    select: SAFE_TENANT_SELECT,
  });

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "REACTIVATE_TENANT",
    module: "TENANT_MANAGEMENT",
    description: `Reactivated tenant "${tenant.name}"`,
    targetId: id,
    targetType: "TENANT",
    targetName: tenant.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return updated;
};

// ---------------------------------------------------------------
// DELETE TENANT (soft delete � cascade deactivation)
// ---------------------------------------------------------------
export const deleteTenantService = async (id, actor, meta) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!tenant) {
    const err = new Error("Tenant not found");
    err.status = 404;
    throw err;
  }

  // Soft delete: deactivate + block + revoke all sessions
  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id },
      data: { isActive: false, status: "BLOCKED" },
    });

    // Deactivate all agents under this tenant
    await tx.user.updateMany({
      where: { tenantId: id },
      data: { isActive: false },
    });

    // Revoke all tokens
    await tx.refreshToken.updateMany({
      where: {
        OR: [{ tenantId: id }, { user: { tenantId: id } }],
        isRevoked: false,
      },
      data: { isRevoked: true },
    });
  });

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "DELETE_TENANT",
    module: "TENANT_MANAGEMENT",
    description: `Soft-deleted tenant "${tenant.name}" with ${tenant._count.users} agents`,
    targetId: id,
    targetType: "TENANT",
    targetName: tenant.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return { id, deleted: true };
};

// ---------------------------------------------------------------
// DEACTIVATE USER (SRAdmin moderation on a specific agent)
// ---------------------------------------------------------------
export const deactivateUserService = async (id, actor, meta) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...SAFE_USER_SELECT, tenant: { select: { id: true, name: true } } },
  });

  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error("User is already inactive");
    err.status = 400;
    throw err;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: SAFE_USER_SELECT,
  });

  // Revoke this user's sessions
  await revokeAllTokens(id, "USER");

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "DEACTIVATE_USER",
    module: "USER_MANAGEMENT",
    description: `Deactivated agent "${user.name}" under tenant "${user.tenant?.name}"`,
    targetId: id,
    targetType: "USER",
    targetName: user.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    tenantId: user.tenantId,
  });

  return updated;
};

// ---------------------------------------------------------------
// REACTIVATE USER
// ---------------------------------------------------------------
export const reactivateUserService = async (id, actor, meta) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...SAFE_USER_SELECT, tenant: { select: { id: true, name: true, status: true } } },
  });

  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  if (user.isActive) {
    const err = new Error("User is already active");
    err.status = 400;
    throw err;
  }

  // Don't reactivate if parent tenant is blocked
  if (user.tenant?.status === "BLOCKED") {
    const err = new Error("Cannot reactivate agent � parent tenant is blocked");
    err.status = 400;
    throw err;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: true },
    select: SAFE_USER_SELECT,
  });

  await createAuditLog({
    actorId: actor.id,
    actorType: "SUPERADMIN",
    actorName: actor.name,
    actorEmail: actor.email,
    action: "REACTIVATE_USER",
    module: "USER_MANAGEMENT",
    description: `Reactivated agent "${user.name}" under tenant "${user.tenant?.name}"`,
    targetId: id,
    targetType: "USER",
    targetName: user.name,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    tenantId: user.tenantId,
  });

  return updated;
};