// backend/src/modules/superadmin/settings/sradmin.settings.routes.js (do not remove this comment)
import express from "express";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";
import {
  getGSTSettings,
  updateGSTSettings,
} from "./sradmin.settings.controller.js";

const router = express.Router();

router.get("/tax", authenticate, requireSRAdmin, getGSTSettings);
router.put("/tax", authenticate, requireSRAdmin, updateGSTSettings);

export default router;