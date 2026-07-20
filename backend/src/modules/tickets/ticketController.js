import {
  createTenantTicketService,
  getTenantTicketsService,
  getTenantTicketDetailService,
  tenantReplyTicketService,
  closeTenantTicketService,
  createUserTicketService,
  getUserTicketsService,
  getUserTicketDetailService,
  userReplyTicketService,
  getTenantUserTicketsService,
  tenantReplyUserTicketService,
  escalateTicketService,
  resolveTenantUserTicketService,
  getAllTicketsService,
  getAdminTicketDetailService,
  adminReplyTicketService,
  updateTicketStatusService,
  updateTicketPriorityService,
} from "./ticketService.js";

// ══════════════════════════════════════════
// TENANT CONTROLLERS
// ══════════════════════════════════════════

export const createTenantTicket = async (req, res) => {
  try {
      const attachmentUrl = req.file
      ? `/uploads/tickets/${req.file.filename}`
      : null;
      
    const ticket = await createTenantTicketService(req.tenantId, { ...req.body, attachmentUrl });
    return res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    console.error("Create tenant ticket error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTenantTickets = async (req, res) => {
  try {
    const tickets = await getTenantTicketsService(req.tenantId);
    return res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTenantTicketDetail = async (req, res) => {
  try {
    const ticket = await getTenantTicketDetailService(
      req.params.ticketId,
      req.tenantId
    );
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const tenantReplyTicket = async (req, res) => {
  try {
    const message = await tenantReplyTicketService(
      req.params.ticketId,
      req.tenantId,
      req.body.message
    );
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const closeTenantTicket = async (req, res) => {
  try {
    await closeTenantTicketService(req.params.ticketId, req.tenantId);
    return res.status(200).json({ success: true, message: "Ticket closed" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTenantUserTickets = async (req, res) => {
  try {
    const tickets = await getTenantUserTicketsService(req.tenantId);
    return res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const tenantReplyUserTicket = async (req, res) => {
  try {
    const message = await tenantReplyUserTicketService(
      req.params.ticketId,
      req.tenantId,
      req.body.message
    );
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const escalateTicket = async (req, res) => {
  try {
    const ticket = await escalateTicketService(
      req.params.ticketId,
      req.tenantId
    );
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveTenantUserTicket = async (req, res) => {
  try {
    const ticket = await resolveTenantUserTicketService(
      req.params.ticketId,
      req.tenantId
    );
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ══════════════════════════════════════════
// USER CONTROLLERS
// ══════════════════════════════════════════

export const createUserTicket = async (req, res) => {
  try {
    // ✅ FIXED - use resolved userId variable
    const userId = req.userId || req.user?.id;

    
    const attachmentUrl = req.file
      ? `/uploads/tickets/${req.file.filename}`
      : null;
      
    console.log("req.user:", req.user);
    console.log("req.userId:", req.userId);

    const ticket = await createUserTicketService(
      userId,
      req.tenantId,
      { ...req.body, attachmentUrl }
    );
    return res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserTickets = async (req, res) => {
  try {
    // ✅ FIXED - use resolved userId variable
    const userId = req.userId || req.user?.id;
    const tickets = await getUserTicketsService(userId);
    return res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserTicketDetail = async (req, res) => {
  try {
    // ✅ FIXED - use resolved userId variable
    const userId = req.userId || req.user?.id;
    const ticket = await getUserTicketDetailService(
      req.params.ticketId,
      userId
    );
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const userReplyTicket = async (req, res) => {
  try {
    // ✅ FIXED - use resolved userId variable
    const userId = req.userId || req.user?.id;
    const message = await userReplyTicketService(
      req.params.ticketId,
      userId,
      req.tenantId,
      req.body.message
    );
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ══════════════════════════════════════════
// SUPERADMIN CONTROLLERS
// ══════════════════════════════════════════

export const getAllTickets = async (req, res) => {
  try {
    const tickets = await getAllTicketsService(req.query);
    return res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminTicketDetail = async (req, res) => {
  try {
    const ticket = await getAdminTicketDetailService(req.params.ticketId);
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const adminReplyTicket = async (req, res) => {
  try {
    const { message, isInternal } = req.body;
    const reply = await adminReplyTicketService(
      req.params.ticketId,
      req.superAdminId,
      message,
      isInternal || false
    );
    if (!reply) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(201).json({ success: true, data: reply });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    const ticket = await updateTicketStatusService(
      req.params.ticketId,
      req.body.status
    );
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTicketPriority = async (req, res) => {
  try {
    const ticket = await updateTicketPriorityService(
      req.params.ticketId,
      req.body.priority
    );
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};