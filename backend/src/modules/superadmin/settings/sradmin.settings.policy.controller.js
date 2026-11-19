// backend/src/modules/superadmin/settings/sradmin.settings.policy.controller.js (do not remove this comment)
import { extractRequestMeta } from "../../../lib/utils/request.meta.js";
import { parseOrThrow, sendError } from "../../../lib/utils/http.error.js";
import { updateSubscriptionPolicySchema } from "./sradmin.settings.policy.schema.js";
import {
  getSubscriptionPolicyService,
  updateSubscriptionPolicyService,
} from "./sradmin.settings.policy.service.js";

// GET /sradmin/settings/subscription-policy
export const getSubscriptionPolicy = async (req, res) => {
  try {
    const data = await getSubscriptionPolicyService();
    return res.json({ success: true, message: "Subscription policy fetched", data });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /sradmin/settings/subscription-policy
export const updateSubscriptionPolicy = async (req, res) => {
  try {
    const body = parseOrThrow(updateSubscriptionPolicySchema, req.body);
    const actor = { id: req.srAdmin.id, name: req.srAdmin.name, email: req.srAdmin.email };
    const data = await updateSubscriptionPolicyService(body, actor, extractRequestMeta(req));
    return res.json({
      success: true,
      message:
        "Subscription policy updated — applies to future grace periods and deletion schedules only; already-scheduled deletions are unchanged",
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
};