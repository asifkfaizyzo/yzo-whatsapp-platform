// backend/src/modules/public/public.routes.js (do not remove this comment)
import express from "express";
import { getPublicGSTSettings } from "../superadmin/superadmin.controller.js";

const router = express.Router();

// ══════════════════════════════════════════
// PUBLIC ROUTES — Accessible without auth
// Used by tenant checkout, landing pages etc.
// ══════════════════════════════════════════

// ── GST / Tax Settings (for checkout) ──
router.get("/settings/tax/public", getPublicGSTSettings);

// ── Add more public routes here in future ──
// router.get('/company-info', getCompanyInfo);
// router.get('/features', getPublicFeatures);

export default router;
