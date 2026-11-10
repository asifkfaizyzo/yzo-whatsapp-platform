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
} from "./sradmin.tenant.service.js";

// -- Error wrapper (same pattern as Phase 5) --
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const statusCode = err.status || 500;
    return res.status(statusCode).json(error(err.message, statusCode));
  }
};

// ---------------------------------------------------------------
// TENANT CRUD
// ---------------------------------------------------------------

export const getAllTenants = handle(async (req, res) => {
  const parsed = listTenantsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const result = await getAllTenantsService(parsed.data);
  return res.json(success("Tenants fetched", result));
});

export const getTenantById = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const tenant = await getTenantByIdService(parsed.data.id);
  return res.json(success("Tenant fetched", tenant));
});

export const updateTenant = handle(async (req, res) => {
  const paramParsed = tenantIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) return res.status(400).json(validationError(paramParsed.error));

  const bodyParsed = updateTenantSchema.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json(validationError(bodyParsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const updated = await updateTenantService(paramParsed.data.id, bodyParsed.data, actor, meta);
  return res.json(success("Tenant updated", updated));
});

export const approveTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await approveTenantService(parsed.data.id, actor, meta);
  return res.json(success("Tenant approved � moved to ONBOARDING", result));
});

export const blockTenant = handle(async (req, res) => {
  const paramParsed = tenantIdParamSchema.safeParse(req.params);
  if (!paramParsed.success) return res.status(400).json(validationError(paramParsed.error));

  const bodyParsed = blockTenantSchema.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json(validationError(bodyParsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await blockTenantService(paramParsed.data.id, bodyParsed.data.reason, actor, meta);
  return res.json(success("Tenant blocked and all sessions revoked", result));
});

export const unblockTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await unblockTenantService(parsed.data.id, actor, meta);
  return res.json(success("Tenant unblocked", result));
});

export const deactivateTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await deactivateTenantService(parsed.data.id, actor, meta);
  return res.json(success("Tenant deactivated", result));
});

export const reactivateTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await reactivateTenantService(parsed.data.id, actor, meta);
  return res.json(success("Tenant reactivated", result));
});

export const deleteTenant = handle(async (req, res) => {
  const parsed = tenantIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await deleteTenantService(parsed.data.id, actor, meta);
  return res.json(success("Tenant soft-deleted", result));
});

// ---------------------------------------------------------------
// USER (AGENT) MODERATION
// ---------------------------------------------------------------

export const deactivateUser = handle(async (req, res) => {
  const parsed = userIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await deactivateUserService(parsed.data.id, actor, meta);
  return res.json(success("Agent deactivated", result));
});

export const reactivateUser = handle(async (req, res) => {
  const parsed = userIdParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(validationError(parsed.error));

  const actor = req.srAdmin;
  const meta = extractRequestMeta(req);
  const result = await reactivateUserService(parsed.data.id, actor, meta);
  return res.json(success("Agent reactivated", result));
});