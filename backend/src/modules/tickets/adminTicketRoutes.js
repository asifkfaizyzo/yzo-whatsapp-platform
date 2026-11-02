// backend/src/modules/tickets/adminTicketRoutes.js (do not remove this comment)
// adminTicketRoutes.js (SuperAdmin routes only)

import express from "express";
import {
  getAllTickets,
  getAdminTicketDetail,
  adminReplyTicket,
  updateTicketStatus,
  updateTicketPriority,
} from "./ticketController.js";

import { verifySuperAdmin } from "../../middlewares/authSuperAdmin.js";

const router = express.Router();

router.get(   "/tickets",                    verifySuperAdmin, getAllTickets);
router.get(   "/tickets/:ticketId",          verifySuperAdmin, getAdminTicketDetail);
router.post(  "/tickets/:ticketId/reply",    verifySuperAdmin, adminReplyTicket);
router.patch( "/tickets/:ticketId/status",   verifySuperAdmin, updateTicketStatus);
router.patch( "/tickets/:ticketId/priority", verifySuperAdmin, updateTicketPriority);

export default router;