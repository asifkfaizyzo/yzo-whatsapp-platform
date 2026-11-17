// backend/src/modules/superadmin/tenant/sradmin.tenant.controller.js (do not remove this comment)

import { success, error, validationError } from "../../../utils/response.js";
import { extractRequestMeta } from "../../../lib/utils/request.meta.js";
import {
  listTenantsSchema,
  tenantIdParamSchema,
  updateTenantSchema,
  blockTenantSchema,
  userIdParamSchema,
} from "./sradmin.tenant.schema.js";
import {
  getAllTenantsService,
  getTenantByIdService,
  updateTenantService,
  approveTenantService,
  blockTenantService,
  unblockTenantService,
  deactivateTenantService,
  reactivateTenantService,
  deleteTenantService,
  deactivateUserService,
  reactivateUserService,
  registerTenantService,
} from "./sradmin.tenant.service.js";

// -- Error wrapper --
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const statusCode = err.status || 500;
    return error(res, err.message, statusCode);
  }
};

// ---------------------------------------------------------------
// TENANT CRUD
// ---------------------------------------------------------------

export const getAllTenants = handle(async (req, res) => {
  const parsed = listTenantsSchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);

  const result = await getAllTenantsService(parsed.data);
  return success(res, result, "Tenants fetched");
});

export const getTenantById = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);

  const tenant = await getTenantByIdService(parsed.data.id);
  return success(res, tenant, "Tenant fetched");
});

export const updateTenant = handle(async (req, res) => {
  const paramParsed = tenantIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) return validationError(res, paramParsed.error);

  const bodyParsed = updateTenantSchema.safeParse(req.body);
  if (!bodyParsed.success) return validationError(res, bodyParsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const updated = await updateTenantService(paramParsed.data.id, bodyParsed.data, actor, meta);
  return success(res, updated, "Tenant updated");
});

export const approveTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await approveTenantService(parsed.data.id, actor, meta);
  return success(res, result, "Tenant approved");
});

export const blockTenant = handle(async (req, res) => {
  const paramParsed = tenantIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) return validationError(res, paramParsed.error);

  const bodyParsed = blockTenantSchema.safeParse(req.body);
  if (!bodyParsed.success) return validationError(res, bodyParsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await blockTenantService(paramParsed.data.id, bodyParsed.data.reason, actor, meta);
  return success(res, result, "Tenant blocked and all sessions revoked");
});

export const unblockTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await unblockTenantService(parsed.data.id, actor, meta);
  return success(res, result, "Tenant unblocked");
});

export const deactivateTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await deactivateTenantService(parsed.data.id, actor, meta);
  return success(res, result, "Tenant deactivated");
});

export const reactivateTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await reactivateTenantService(parsed.data.id, actor, meta);
  return success(res, result, "Tenant reactivated");
});

export const deleteTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await deleteTenantService(parsed.data.id, actor, meta);
  return success(res, result, "Tenant soft-deleted");
});

// ---------------------------------------------------------------
// USER (AGENT) MODERATION
// ---------------------------------------------------------------

export const deactivateUser = handle(async (req, res) => {
  const parsed = userIdParamSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await deactivateUserService(parsed.data.id, actor, meta);
  return success(res, result, "Agent deactivated");
});

export const reactivateUser = handle(async (req, res) => {
  const parsed = userIdParamSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await reactivateUserService(parsed.data.id, actor, meta);
  return success(res, result, "Agent reactivated");
});

export const registerTenant = handle(async (req, res) => {
  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await registerTenantService(req.body, actor, meta);
  return success(res, result, "Tenant registered successfully", 201);
});