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

import { verifyTenantOrUser } from "../../middlewares/auth.verifyTenantOrUser.js";
import { ticketUpload } from "../../config/upload.ticket.js";

const router = express.Router();

// ── Tenant own tickets ──
router.post(  "/tickets",                       verifyTenantOrUser, ticketUpload.single("attachment"), createTenantTicket);
router.get(   "/tickets/my",                    verifyTenantOrUser, getTenantTickets);
router.get(   "/tickets/user-tickets/all",      verifyTenantOrUser, getTenantUserTickets);
router.get(   "/tickets/:ticketId",             verifyTenantOrUser, getTenantTicketDetail);
router.post(  "/tickets/:ticketId/reply",       verifyTenantOrUser, tenantReplyTicket);
router.patch( "/tickets/:ticketId/close",       verifyTenantOrUser, closeTenantTicket);
router.post(  "/tickets/:ticketId/reply-user",  verifyTenantOrUser, tenantReplyUserTicket);
router.patch( "/tickets/:ticketId/escalate",    verifyTenantOrUser, escalateTicket);
router.patch( "/tickets/:ticketId/resolve",     verifyTenantOrUser, resolveTenantUserTicket);

// ── User tickets ──
router.post(  "/user-tickets",                  verifyTenantOrUser, ticketUpload.single("attachment"), createUserTicket);
router.get(   "/user-tickets/my",               verifyTenantOrUser, getUserTickets);
router.get(   "/user-tickets/:ticketId",        verifyTenantOrUser, getUserTicketDetail);
router.post(  "/user-tickets/:ticketId/reply",  verifyTenantOrUser, userReplyTicket);

export default router;