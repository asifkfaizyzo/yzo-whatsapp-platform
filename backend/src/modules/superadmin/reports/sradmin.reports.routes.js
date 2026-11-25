// backend/src/modules/superadmin/reports/sradmin.reports.routes.js
import express from "express";
import * as reportsController from "./sradmin.reports.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireSRAdmin } from "../../../middleware/requireSRAdmin.js";

const router = express.Router();

router.get("/reports/kpis", authenticate, requireSRAdmin, reportsController.getReportKPIs);
router.get("/reports/messages", authenticate, requireSRAdmin, reportsController.getReportMessages);
router.get("/reports/delivery", authenticate, requireSRAdmin, reportsController.getReportDelivery);
router.get("/reports/tenants", authenticate, requireSRAdmin, reportsController.getReportTenants);
router.get("/reports/system-health", authenticate, requireSRAdmin, reportsController.getReportSystemHealth);

export default router;