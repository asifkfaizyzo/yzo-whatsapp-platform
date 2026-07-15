//ticketRoutes.js (Tenant + User routes only)
// backend/src/modules/tickets/ticketRoutes.js

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
} from "./ticketController.js";

import { verifyTenantOrUser } from "../../middlewares/authVerfyTenOrUser.js";

const router = express.Router();

// ── Tenant own tickets ──
router.post(  "/tickets",                       verifyTenantOrUser, createTenantTicket);
router.get(   "/tickets/my",                    verifyTenantOrUser, getTenantTickets);
router.get(   "/tickets/user-tickets/all",      verifyTenantOrUser, getTenantUserTickets);
router.get(   "/tickets/:ticketId",             verifyTenantOrUser, getTenantTicketDetail);
router.post(  "/tickets/:ticketId/reply",       verifyTenantOrUser, tenantReplyTicket);
router.patch( "/tickets/:ticketId/close",       verifyTenantOrUser, closeTenantTicket);
router.post(  "/tickets/:ticketId/reply-user",  verifyTenantOrUser, tenantReplyUserTicket);
router.patch( "/tickets/:ticketId/escalate",    verifyTenantOrUser, escalateTicket);
router.patch( "/tickets/:ticketId/resolve",     verifyTenantOrUser, resolveTenantUserTicket);

// ── User tickets ──
router.post(  "/user-tickets",                  verifyTenantOrUser, createUserTicket);
router.get(   "/user-tickets/my",               verifyTenantOrUser, getUserTickets);
router.get(   "/user-tickets/:ticketId",        verifyTenantOrUser, getUserTicketDetail);
router.post(  "/user-tickets/:ticketId/reply",  verifyTenantOrUser, userReplyTicket);

export default router;