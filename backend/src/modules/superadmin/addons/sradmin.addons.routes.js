// backend/src/modules/superadmin/addons/sradmin.addons.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";
import {
  listAddOns,
  getAddOn,
  createAddOn,
  updateAddOn,
  toggleAddOnStatus,
  reorderAddOns,
  deleteAddOn,
} from "./sradmin.addons.controller.js";

const router = express.Router();

// Static paths BEFORE "/:id"
router.patch("/reorder", authenticate, requireSRAdmin, reorderAddOns);

router.get("/", authenticate, requireSRAdmin, listAddOns);
router.post("/", authenticate, requireSRAdmin, createAddOn);

router.get("/:id", authenticate, requireSRAdmin, getAddOn);
router.put("/:id", authenticate, requireSRAdmin, updateAddOn);
router.delete("/:id", authenticate, requireSRAdmin, deleteAddOn);
router.patch("/:id/toggle-status", authenticate, requireSRAdmin, toggleAddOnStatus);

export default router;