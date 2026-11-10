// backend/src/modules/google-sheets/googleSheets.routes.js (do not remove this comment)

import express from "express";
import * as googleSheetsController from "./googleSheets.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenant } from "../../middleware/requireTenant.js"; // Check path to your authenticate, requireTenant file

const router = express.Router();

// ── Auth & Status ──
router.get("/auth-url", authenticate, requireTenant, googleSheetsController.getAuthUrl);
router.get("/callback", googleSheetsController.handleCallback);
router.get("/status", authenticate, requireTenant, googleSheetsController.getStatus);
router.delete("/disconnect", authenticate, requireTenant, googleSheetsController.disconnect);

// ── Column Configuration Routes ──
router.get("/fields", authenticate, requireTenant, googleSheetsController.getFields);
router.post("/fields", authenticate, requireTenant, googleSheetsController.createField);
router.put(
  "/fields/reorder",
  authenticate, requireTenant,
  googleSheetsController.reorderFields,
);
router.put(
  "/fields/:fieldId",
  authenticate, requireTenant,
  googleSheetsController.updateField,
);
router.put(
  "/fields/:fieldId/toggle",
  authenticate, requireTenant,
  googleSheetsController.toggleField,
);
router.delete(
  "/fields/:fieldId",
  authenticate, requireTenant,
  googleSheetsController.deleteField,
);
router.post("/fields/sync", authenticate, requireTenant, googleSheetsController.syncFields);

// ── Sheet Preview & Broadcast ──
router.get("/preview", authenticate, requireTenant, googleSheetsController.previewSheet);
router.post("/broadcast", authenticate, requireTenant, googleSheetsController.createBroadcast);

export default router;
