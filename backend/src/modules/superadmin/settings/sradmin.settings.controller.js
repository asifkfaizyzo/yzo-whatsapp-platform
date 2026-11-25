// backend/src/modules/superadmin/settings/sradmin.settings.controller.js (do not remove this comment)
import { extractRequestMeta } from "../../../lib/utils/request.meta.js";
import {
  getGSTSettingsService,
  updateGSTSettingsService,
} from "./sradmin.settings.service.js";

// ── GET GST Settings (SRAdmin only) ──
export const getGSTSettings = async (req, res) => {
  try {
    const settings = await getGSTSettingsService();
    return res.status(200).json({
      success: true,
      message: "GST settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE GST Settings (SRAdmin only) ──
export const updateGSTSettings = async (req, res) => {
  try {
    const actor = {
      id: req.srAdmin.id,
      name: req.srAdmin.name,
      email: req.srAdmin.email,
    };
    const meta = extractRequestMeta(req);
    const updated = await updateGSTSettingsService(req.body, actor, meta);

    return res.status(200).json({
      success: true,
      message: `GST settings updated — GST is now ${updated.gstEnabled ? "ENABLED" : "DISABLED"}`,
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ── PUBLIC GST Settings (for tenant checkout, no auth) ──
export const getPublicGSTSettings = async (req, res) => {
  try {
    const settings = await getGSTSettingsService();
    return res.status(200).json({
      success: true,
      data: {
        gstEnabled: settings.gstEnabled,
        gstPercent: settings.gstPercent,
        gstType: settings.gstType,
        pricingType: settings.pricingType,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};