// backend/src/modules/tickets/ticket.admin.routes.js (do not remove this comment)
// ticket.admin.routes.js (SuperAdmin routes only)

import express from "express";
import {
  getAllTickets,
  getAdminTicketDetail,
  adminReplyTicket,
  updateTicketStatus,
  updateTicketPriority,
} from "./ticket.controller.js";

import { verifySuperAdmin } from "../../middlewares/auth.superAdmin.js";

const router = express.Router();

router.get(   "/tickets",                    verifySuperAdmin, getAllTickets);
router.get(   "/tickets/:ticketId",          verifySuperAdmin, getAdminTicketDetail);
router.post(  "/tickets/:ticketId/reply",    verifySuperAdmin, adminReplyTicket);
router.patch( "/tickets/:ticketId/status",   verifySuperAdmin, updateTicketStatus);
router.patch( "/tickets/:ticketId/priority", verifySuperAdmin, updateTicketPriority);

export default router;