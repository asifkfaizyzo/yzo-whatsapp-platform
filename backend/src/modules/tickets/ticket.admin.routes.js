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

import { authenticate } from "../../middleware/authenticate.js";
import { requireSRAdmin } from "../../middleware/requireSRAdmin.js";

const router = express.Router();

router.get("/tickets", authenticate, requireSRAdmin, getAllTickets);
router.get("/tickets/:ticketId", authenticate, requireSRAdmin, getAdminTicketDetail);
router.post("/tickets/:ticketId/reply", authenticate, requireSRAdmin, adminReplyTicket);
router.patch("/tickets/:ticketId/status", authenticate, requireSRAdmin, updateTicketStatus);
router.patch(
  "/tickets/:ticketId/priority",
  authenticate, requireSRAdmin,
  updateTicketPriority,
);

export default router;
