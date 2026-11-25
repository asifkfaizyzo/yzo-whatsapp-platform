// backend/src/modules/superadmin/plans/sradmin.plans.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";
import {
  listPlans,
  getRegistry,
  getPlan,
  createPlan,
  updatePlan,
  togglePlanStatus,
  reorderPlans,
  deletePlan,
} from "./sradmin.plans.controller.js";

const router = express.Router();

// Static paths first (must precede "/:id")
router.get("/registry", authenticate, requireSRAdmin, getRegistry);
router.patch("/reorder", authenticate, requireSRAdmin, reorderPlans);

router.get("/", authenticate, requireSRAdmin, listPlans);
router.post("/", authenticate, requireSRAdmin, createPlan);

router.get("/:id", authenticate, requireSRAdmin, getPlan);
router.put("/:id", authenticate, requireSRAdmin, updatePlan);
router.patch("/:id/toggle-status", authenticate, requireSRAdmin, togglePlanStatus);
router.delete("/:id", authenticate, requireSRAdmin, deletePlan);

export default router;