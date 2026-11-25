// backend/src/modules/zoho/zoho.routes.js (do not remove this comment)

import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTenant } from "../../middleware/requireTenant.js";
import * as zohoController from "./zoho.controller.js";

const router = express.Router();

// ── Connection Management ──
router.get(
  "/connect",
  authenticate, requireTenant,
  zohoController.getConnectUrl,
);
router.get("/status", authenticate, requireTenant, zohoController.getStatus);
router.get("/plan", authenticate, requireTenant, zohoController.getPlanInfo);
router.post(
  "/test",
  authenticate, requireTenant,
  zohoController.testConnection,
);
router.post(
  "/disconnect",
  authenticate, requireTenant,
  zohoController.disconnect,
);

// ── Contact Synchronization ──
router.post(
  "/sync/contacts",
  authenticate, requireTenant,
  zohoController.triggerContactSync,
);
router.post(
  "/sync/incremental",
  authenticate, requireTenant,
  zohoController.triggerIncrementalSync,
);
router.get("/sync/status", authenticate, requireTenant, zohoController.getSyncStatus);

// ── Preferences ──
router.get("/preferences", authenticate, requireTenant, zohoController.getPreferences);
router.put(
  "/preferences",
  authenticate, requireTenant,
  zohoController.updatePreferences,
);

// ── Phase 6 Advanced CRM Endpoints ──
router.get(
  "/products",
  authenticate, requireTenant,
  zohoController.listProducts,
);
router.post(
  "/events",
  authenticate, requireTenant,
  zohoController.bookEvent,
);
router.post(
  "/tickets/:ticketId/sync-case",
  authenticate, requireTenant,
  zohoController.syncTicketCase,
);
router.post(
  "/invoices/:invoiceId/send-whatsapp",
  authenticate, requireTenant,
  zohoController.dispatchInvoice,
);

router.post(
  "/sync/pull",
  authenticate, requireTenant,
  zohoController.triggerPullSync,
);

export default router;
