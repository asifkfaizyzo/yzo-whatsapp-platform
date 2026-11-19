// backend/src/modules/superadmin/addons/sradmin.addons.controller.js (do not remove this comment)
import { extractRequestMeta } from "../../../lib/utils/request.meta.js";
import { parseOrThrow, sendError } from "../../../lib/utils/http.error.js";
import {
  createAddOnSchema,
  updateAddOnSchema,
  reorderAddOnsSchema,
  addOnIdParamSchema,
  listAddOnsQuerySchema,
} from "./sradmin.addons.schema.js";
import {
  listAddOnsService,
  getAddOnByIdService,
  createAddOnService,
  updateAddOnService,
  toggleAddOnStatusService,
  reorderAddOnsService,
  deleteAddOnService,
} from "./sradmin.addons.service.js";

const getActor = (req) => ({
  id: req.srAdmin.id,
  name: req.srAdmin.name,
  email: req.srAdmin.email,
});

// GET /sradmin/addons
export const listAddOns = async (req, res) => {
  try {
    const query = parseOrThrow(listAddOnsQuerySchema, req.query);
    const data = await listAddOnsService(query);
    return res.json({ success: true, message: "Add-ons fetched", data });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /sradmin/addons/:id
export const getAddOn = async (req, res) => {
  try {
    const { id } = parseOrThrow(addOnIdParamSchema, req.params);
    const data = await getAddOnByIdService(id);
    return res.json({ success: true, message: "Add-on fetched", data });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /sradmin/addons
export const createAddOn = async (req, res) => {
  try {
    const body = parseOrThrow(createAddOnSchema, req.body);
    const data = await createAddOnService(body, getActor(req), extractRequestMeta(req));
    return res.status(201).json({ success: true, message: "Add-on created", data });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /sradmin/addons/:id
export const updateAddOn = async (req, res) => {
  try {
    const { id } = parseOrThrow(addOnIdParamSchema, req.params);
    const body = parseOrThrow(updateAddOnSchema, req.body);
    const { addOn, impact } = await updateAddOnService(
      id,
      body,
      getActor(req),
      extractRequestMeta(req),
    );

    let message = impact.changed ? "Add-on updated" : "No changes detected";
    if (impact.changed && impact.entitlementChanged && impact.activeSubscribers > 0) {
      message += ` — entitlement change applies immediately to ${impact.activeSubscribers} active holder(s)`;
    }
    return res.json({ success: true, message, data: addOn, impact });
  } catch (error) {
    return sendError(res, error);
  }
};

// PATCH /sradmin/addons/:id/toggle-status
export const toggleAddOnStatus = async (req, res) => {
  try {
    const { id } = parseOrThrow(addOnIdParamSchema, req.params);
    const { addOn, impact } = await toggleAddOnStatusService(
      id,
      getActor(req),
      extractRequestMeta(req),
    );
    return res.json({
      success: true,
      message: addOn.isActive
        ? "Add-on activated — available for purchase"
        : `Add-on deactivated — hidden from purchase; ${impact.activeSubscribers} existing holder(s) keep it until their period ends`,
      data: addOn,
      impact,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// PATCH /sradmin/addons/reorder
export const reorderAddOns = async (req, res) => {
  try {
    const { orderedIds } = parseOrThrow(reorderAddOnsSchema, req.body);
    const data = await reorderAddOnsService(orderedIds, getActor(req), extractRequestMeta(req));
    return res.json({ success: true, message: "Add-ons reordered", data });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /sradmin/addons/:id
export const deleteAddOn = async (req, res) => {
  try {
    const { id } = parseOrThrow(addOnIdParamSchema, req.params);
    const data = await deleteAddOnService(id, getActor(req), extractRequestMeta(req));
    return res.json({ success: true, message: "Add-on deleted", data });
  } catch (error) {
    return sendError(res, error);
  }
};