// backend/src/modules/tickets/ticket.routes.js (do not remove this comment)
//ticket.routes.js (Tenant + User routes only)

import express from "express";
import {
  createTenantTicket,
  getTenantTickets,
  getTenantTicketDetail,
  tenantReplyTicket,
  closeTenantTicket,
  getTenantUserTickets,
  tenantReplyUserTicket,
  escalateTicket,
  resolveTenantUserTicket,
  createUserTicket,
  getUserTickets,
  getUserTicketDetail,
  userReplyTicket,
} from "./ticket.controller.js";

import { authenticate } from "../../middleware/authenticate.js";
import { requireTenantOrUser } from "../../middleware/requireTenantOrUser.js";
import { ticketUpload } from "../../config/upload.ticket.js";

const router = express.Router();

// ── Tenant own tickets ──
router.post(
  "/tickets",
  authenticate, requireTenantOrUser,
  ticketUpload.single("attachment"),
  createTenantTicket,
);
router.get("/tickets/my", authenticate, requireTenantOrUser, getTenantTickets);
router.get(
  "/tickets/user-tickets/all",
  authenticate, requireTenantOrUser,
  getTenantUserTickets,
);
router.get("/tickets/:ticketId", authenticate, requireTenantOrUser, getTenantTicketDetail);
router.post("/tickets/:ticketId/reply", authenticate, requireTenantOrUser, tenantReplyTicket);
router.patch("/tickets/:ticketId/close", authenticate, requireTenantOrUser, closeTenantTicket);
router.post(
  "/tickets/:ticketId/reply-user",
  authenticate, requireTenantOrUser,
  tenantReplyUserTicket,
);
router.patch("/tickets/:ticketId/escalate", authenticate, requireTenantOrUser, escalateTicket);
router.patch(
  "/tickets/:ticketId/resolve",
  authenticate, requireTenantOrUser,
  resolveTenantUserTicket,
);

// ── User tickets ──
router.post(
  "/user-tickets",
  authenticate, requireTenantOrUser,
  ticketUpload.single("attachment"),
  createUserTicket,
);
router.get("/user-tickets/my", authenticate, requireTenantOrUser, getUserTickets);
router.get("/user-tickets/:ticketId", authenticate, requireTenantOrUser, getUserTicketDetail);
router.post(
  "/user-tickets/:ticketId/reply",
  authenticate, requireTenantOrUser,
  userReplyTicket,
);

export default router;
