// backend/src/modules/tickets/ticketService.js

import prisma from "../../config/prisma.js";
import { sendTicketEmail } from "../auth/emailService.js";
import { emitToTenant, emitToSuperAdmin, emitToUser } from "../../lib/socket.js";
import { createAuditLog } from '../audit/auditLogService.js';

// ── Generate Ticket Number ──
const generateTicketNumber = async () => {
  const count = await prisma.ticket.count();
  const number = String(count + 1).padStart(4, "0");
  return `TKT-${number}`;
};

// ══════════════════════════════════════════
// TENANT SERVICES
// ══════════════════════════════════════════

// ── Create Ticket (Tenant → SuperAdmin) ──
export const createTenantTicketService = async (tenantId, data) => {
  const ticketNumber = await generateTicketNumber();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantName: true, email: true },
  });

  const superAdmin = await prisma.superAdmin.findFirst({
    select: { email: true },
  });

  // ✅ Log what we found — helps debug missing emails
  console.log("📧 Tenant ticket — SuperAdmin email:", superAdmin?.email);

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      title:         data.title,
      description:   data.description,
      category:      data.category    || "GENERAL",
      priority:      data.priority    || "LOW",
      raisedBy:      "TENANT",
      tenantId,
      isEscalated:   true,
      attachmentUrl: data.attachmentUrl || null,
    },
  });

   // ✅ ADD audit log
  await createAuditLog({
    actorId:     tenantId,
    actorType:   'TENANT',
    actorName:   tenant.tenantName,
    actorEmail:  tenant.email,
    action:      'TICKET_CREATED',
    module:      'TICKET',
    description: `Tenant "${tenant.tenantName}" created ticket ${ticketNumber}: "${data.title}"`,
    targetId:    ticket.id,
    targetType:  'TICKET',
    targetName:  ticket.ticketNumber,
    tenantId:    tenantId,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      category:     ticket.category,
      priority:     ticket.priority,
      title:        ticket.title,
    },
  });

  // ── Notify SuperAdmin ──
  const notification = await prisma.superAdminNotification.create({
    data: {
      type:    "new_ticket",
      title:   "🎫 New Ticket Raised",
      message: `${tenant.tenantName} raised a ticket: "${data.title}"`,
      metadata: {
        ticketId:     ticket.id,
        ticketNumber: ticket.ticketNumber,
        tenantId,
        tenantName:   tenant.tenantName,
      },
    },
  });

  emitToSuperAdmin("superadmin_notification", { notification });

  // ── Email SuperAdmin ──
  await sendTicketEmail({
    to:          superAdmin?.email,
    subject:     `New Ticket ${ticketNumber} — ${data.title}`,
    ticketNumber,
    title:       data.title,
    description: data.description,
    raisedBy:    tenant.tenantName,
    category:    data.category,
    priority:    data.priority,
  });

  return ticket;
};

// ── Get All Tickets for Tenant (own tickets) ──
export const getTenantTicketsService = async (tenantId) => {
  return await prisma.ticket.findMany({
    where:   { tenantId, raisedBy: "TENANT" },
    orderBy: { createdAt: "desc" },
    select: {
      id:           true,
      ticketNumber: true,
      title:        true,
      category:     true,
      priority:     true,
      status:       true,
      isEscalated:  true,
      createdAt:    true,
      updatedAt:    true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { message: true, sentBy: true, createdAt: true },
      },
    },
  });
};

// ── Get Single Ticket Detail (Tenant own ticket) ──
export const getTenantTicketDetailService = async (ticketId, tenantId) => {
  return await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
    include: {
      tenant:   { select: { id: true, tenantName: true, email: true } },
      user:     { select: { id: true, name: true,       email: true } },
      messages: {
        where:   { isInternal: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });
};

// ── Tenant Reply to Own Ticket (→ SuperAdmin) ──
export const tenantReplyTicketService = async (ticketId, tenantId, message) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
  });
  if (!ticket) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantName: true, email: true },
  });

  const superAdmin = await prisma.superAdmin.findFirst({
    select: { email: true },
  });

  console.log("📧 Tenant reply — SuperAdmin email:", superAdmin?.email);

  const ticketMessage = await prisma.ticketMessage.create({
    data: {
      ticketId,
      message,
      sentBy:     "TENANT",
      tenantId,
      isInternal: false,
    },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data:  { status: "IN_PROGRESS", updatedAt: new Date() },
  });

  const notification = await prisma.superAdminNotification.create({
    data: {
      type:    "ticket_reply",
      title:   "💬 Ticket Reply",
      message: `${tenant.tenantName} replied on ticket ${ticket.ticketNumber}`,
      metadata: { ticketId, ticketNumber: ticket.ticketNumber, tenantId },
    },
  });

  emitToSuperAdmin("superadmin_notification", { notification });

  await sendTicketEmail({
    to:          superAdmin?.email,
    subject:     `Reply on Ticket ${ticket.ticketNumber}`,
    ticketNumber: ticket.ticketNumber,
    title:       ticket.title,
    description: message,
    raisedBy:    tenant.tenantName,
  });

  return ticketMessage;
};

// ── Tenant Close Own Ticket ──
export const closeTenantTicketService = async (ticketId, tenantId) => {
  return await prisma.ticket.updateMany({
    where: { id: ticketId, tenantId },
    data:  { status: "CLOSED" },
  });
};

// ══════════════════════════════════════════
// USER SERVICES
// ══════════════════════════════════════════

// ── Create Ticket (User → Tenant) ──
export const createUserTicketService = async (userId, tenantId, data) => {
  console.log("🎫 createUserTicket called:", { userId, tenantId, data });

  const ticketNumber = await generateTicketNumber();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantName: true, email: true },
  });

  // ✅ Critical log — if tenant.email is null, email will silently skip
  console.log("📧 User ticket — Tenant email:", tenant?.email);
  console.log("👤 User found:", user);

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      title:         data.title,
      description:   data.description,
      category:      data.category    || "GENERAL",
      priority:      data.priority    || "LOW",
      raisedBy:      "USER",
      tenantId,
      userId,
      isEscalated:   false,
      attachmentUrl: data.attachmentUrl || null,
    },
  });

    // ✅ ADD audit log
  await createAuditLog({
    actorId:     userId,
    actorType:   'USER',
    actorName:   user.name,
    actorEmail:  user.email,
    action:      'TICKET_CREATED',
    module:      'TICKET',
    description: `User "${user.name}" created ticket ${ticketNumber}: "${data.title}"`,
    targetId:    ticket.id,
    targetType:  'TICKET',
    targetName:  ticket.ticketNumber,
    tenantId:    tenantId,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      category:     ticket.category,
      priority:     ticket.priority,
      title:        ticket.title,
    },
  });

  // ── Notify Tenant (DB + Socket) ──
  await prisma.notification.create({
    data: {
      tenantId,
      userId:  null,
      type:    "new_ticket",
      title:   "🎫 New Ticket Raised",
      message: `${user.name} raised a ticket: "${data.title}"`,
      metadata: {
        ticketId:     ticket.id,
        ticketNumber: ticket.ticketNumber,
        raisedBy:     user.name,
      },
      isRead: false,
    },
  });

  emitToTenant(tenantId, "new_ticket", {
    ticketId:     ticket.id,
    ticketNumber: ticket.ticketNumber,
    title:        data.title,
    raisedBy:     user.name,
  });

  // ── Email Tenant ──
  await sendTicketEmail({
    to:          tenant?.email,
    subject:     `New Ticket ${ticketNumber} from ${user.name}`,
    ticketNumber,
    title:       data.title,
    description: data.description,
    raisedBy:    user.name,
    category:    data.category,
    priority:    data.priority,
  });

  return ticket;
};

// ── Get All Tickets for User ──
export const getUserTicketsService = async (userId) => {
  return await prisma.ticket.findMany({
    where:   { userId, raisedBy: "USER" },
    orderBy: { createdAt: "desc" },
    select: {
      id:           true,
      ticketNumber: true,
      title:        true,
      category:     true,
      priority:     true,
      status:       true,
      createdAt:    true,
      updatedAt:    true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { message: true, sentBy: true, createdAt: true },
      },
    },
  });
};

// ── Get Single Ticket Detail (User) ──
export const getUserTicketDetailService = async (ticketId, userId) => {
  return await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
    include: {
      tenant:   { select: { id: true, tenantName: true } },
      user:     { select: { id: true, name: true, email: true } },
      messages: {
        where:   { isInternal: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });
};

// ── User Reply to Ticket (→ Tenant) ──
export const userReplyTicketService = async (ticketId, userId, tenantId, message) => {
  console.log("💬 userReply:", { ticketId, userId, tenantId, message });

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
  });
  if (!ticket) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { email: true, tenantName: true },
  });

  console.log("📧 User reply — Tenant email:", tenant?.email);

  const ticketMessage = await prisma.ticketMessage.create({
    data: {
      ticketId,
      message,
      sentBy:     "USER",
      userId,
      isInternal: false,
    },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data:  { status: "IN_PROGRESS", updatedAt: new Date() },
  });

  // ── Notify Tenant (DB + Socket) ──
  await prisma.notification.create({
    data: {
      tenantId,
      userId:  null,
      type:    "ticket_reply",
      title:   "💬 Ticket Reply",
      message: `${user.name} replied on ticket ${ticket.ticketNumber}`,
      metadata: { ticketId, ticketNumber: ticket.ticketNumber },
      isRead: false,
    },
  });

  emitToTenant(tenantId, "ticket_reply", {
    ticketId,
    ticketNumber: ticket.ticketNumber,
    message,
    from: user.name,
  });

  // ── Email Tenant ──
  await sendTicketEmail({
    to:          tenant?.email,
    subject:     `Reply on Ticket ${ticket.ticketNumber} from ${user.name}`,
    ticketNumber: ticket.ticketNumber,
    title:       ticket.title,
    description: message,
    raisedBy:    user.name,
  });

  return ticketMessage;
};

// ══════════════════════════════════════════
// TENANT MANAGING USER TICKETS
// ══════════════════════════════════════════

// ── Get All User Tickets for Tenant ──
export const getTenantUserTicketsService = async (tenantId) => {
  return await prisma.ticket.findMany({
    where:   { tenantId, raisedBy: "USER" },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { message: true, sentBy: true, createdAt: true },
      },
    },
  });
};

// ── Tenant Reply to User Ticket (→ User) ──
export const tenantReplyUserTicketService = async (ticketId, tenantId, message) => {
  const ticket = await prisma.ticket.findFirst({
    where:   { id: ticketId, tenantId, raisedBy: "USER" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!ticket) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantName: true },
  });

  console.log("📧 Tenant reply to user — User email:", ticket.user?.email);

  const ticketMessage = await prisma.ticketMessage.create({
    data: {
      ticketId,
      message,
      sentBy:     "TENANT",
      tenantId,
      isInternal: false,
    },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data:  { status: "IN_PROGRESS", updatedAt: new Date() },
  });

  // ── Notify User (DB + Socket) ──
  await prisma.notification.create({
    data: {
      tenantId,
      userId:  ticket.user.id,
      type:    "ticket_reply",
      title:   "💬 Reply on Your Ticket",
      message: `${tenant.tenantName} replied on ticket ${ticket.ticketNumber}`,
      metadata: { ticketId, ticketNumber: ticket.ticketNumber },
      isRead: false,
    },
  });

  emitToUser(ticket.user.id, "ticket_reply_to_user", {
    ticketId,
    ticketNumber: ticket.ticketNumber,
    message,
    from: tenant.tenantName,
  });

  // ── Email User ──
  await sendTicketEmail({
    to:          ticket.user?.email,
    subject:     `Reply on your Ticket ${ticket.ticketNumber}`,
    ticketNumber: ticket.ticketNumber,
    title:       ticket.title,
    description: message,
    raisedBy:    tenant.tenantName,
  });

  return ticketMessage;
};

// ── Tenant Escalate User Ticket to SuperAdmin ──
export const escalateTicketService = async (ticketId, tenantId) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
  });
  if (!ticket) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantName: true },
  });

  const superAdmin = await prisma.superAdmin.findFirst({
    select: { email: true },
  });

  console.log("📧 Escalate — SuperAdmin email:", superAdmin?.email);

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data:  { isEscalated: true, updatedAt: new Date() },
  });

   // ✅ ADD audit log
  await createAuditLog({
    actorId:     tenantId,
    actorType:   'TENANT',
    actorName:   tenant.tenantName,
    actorEmail:  tenant.email,
    action:      'TICKET_ESCALATED',
    module:      'TICKET',
    description: `Tenant "${tenant.tenantName}" escalated ticket ${ticket.ticketNumber} to SuperAdmin`,
    targetId:    ticket.id,
    targetType:  'TICKET',
    targetName:  ticket.ticketNumber,
    tenantId:    tenantId,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      title:        ticket.title,
    },
  });

  const notification = await prisma.superAdminNotification.create({
    data: {
      type:    "ticket_escalated",
      title:   "⚠️ Ticket Escalated",
      message: `${tenant.tenantName} escalated ticket ${ticket.ticketNumber} to SuperAdmin`,
      metadata: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        tenantId,
        tenantName: tenant.tenantName,
      },
    },
  });

  emitToSuperAdmin("superadmin_notification", { notification });

  // ── Confirm to Tenant (DB + Socket) ──
  await prisma.notification.create({
    data: {
      tenantId,
      userId:  null,
      type:    "ticket_escalated",
      title:   "⚠️ Ticket Escalated",
      message: `Ticket ${ticket.ticketNumber} has been escalated to SuperAdmin successfully`,
      metadata: { ticketId, ticketNumber: ticket.ticketNumber },
      isRead: false,
    },
  });

  emitToTenant(tenantId, "ticket_escalated_confirmation", {
    ticketId,
    ticketNumber: ticket.ticketNumber,
    message: "Your ticket has been escalated to SuperAdmin successfully",
  });

  // ── Email SuperAdmin ──
  await sendTicketEmail({
    to:          superAdmin?.email,
    subject:     `⚠️ Escalated Ticket ${ticket.ticketNumber}`,
    ticketNumber: ticket.ticketNumber,
    title:       ticket.title,
    description: `Ticket escalated by ${tenant.tenantName}`,
    raisedBy:    tenant.tenantName,
  });

  return updated;
};

// ── Tenant Resolve User Ticket ──
export const resolveTenantUserTicketService = async (ticketId, tenantId) => {
  const ticket = await prisma.ticket.findFirst({
    where:   { id: ticketId, tenantId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!ticket) return null;

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data:  { status: "RESOLVED", updatedAt: new Date() },
  });

  if (ticket.user) {
    console.log("📧 Resolve — User email:", ticket.user?.email);

    await prisma.notification.create({
      data: {
        tenantId,
        userId:  ticket.user.id,
        type:    "ticket_resolved",
        title:   "✅ Ticket Resolved",
        message: `Your ticket ${ticket.ticketNumber} has been resolved`,
        metadata: { ticketId, ticketNumber: ticket.ticketNumber },
        isRead: false,
      },
    });

    emitToUser(ticket.user.id, "ticket_resolved", {
      ticketId,
      ticketNumber: ticket.ticketNumber,
      status:  "RESOLVED",
      message: "Your ticket has been resolved.",
    });

    await sendTicketEmail({
      to:          ticket.user?.email,
      subject:     `✅ Ticket ${ticket.ticketNumber} Resolved`,
      ticketNumber: ticket.ticketNumber,
      title:       ticket.title,
      description: "Your ticket has been resolved by the support team.",
      raisedBy:    "Support Team",
    });
  }

  return updated;
};

// ══════════════════════════════════════════
// SUPERADMIN SERVICES
// ══════════════════════════════════════════

// ── Get All Tickets (SuperAdmin) ──
export const getAllTicketsService = async (filters = {}) => {
  const where = {};
  if (filters.status)               where.status      = filters.status;
  if (filters.priority)             where.priority    = filters.priority;
  if (filters.category)             where.category    = filters.category;
  if (filters.tenantId)             where.tenantId    = filters.tenantId;
  if (filters.escalated === "true") where.isEscalated = true;

  return await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      tenant:   { select: { id: true, tenantName: true, email: true } },
      user:     { select: { id: true, name: true,       email: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { message: true, sentBy: true, createdAt: true },
      },
    },
  });
};

// ── Get Single Ticket Detail (SuperAdmin) ──
export const getAdminTicketDetailService = async (ticketId) => {
  return await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      tenant:   { select: { id: true, tenantName: true, email: true } },
      user:     { select: { id: true, name: true,       email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
};

// ── SuperAdmin Reply ──
export const adminReplyTicketService = async (
  ticketId,
  superAdminId,
  message,
  isInternal = false
) => {
  const ticket = await prisma.ticket.findUnique({
    where:   { id: ticketId },
    include: {
      tenant: { select: { email: true, tenantName: true, id: true } },
      user:   { select: { id: true,   email: true,       name: true } },
    },
  });
  if (!ticket) return null;

  const ticketMessage = await prisma.ticketMessage.create({
    data: {
      ticketId,
      message,
      sentBy:      "SUPER_ADMIN",
      superAdminId,
      isInternal,
    },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data:  { status: "IN_PROGRESS", updatedAt: new Date() },
  });

  if (!isInternal) {
    console.log("📧 Admin reply — Tenant email:", ticket.tenant?.email);

    // ── Notify + Email Tenant ──
    await prisma.notification.create({
      data: {
        tenantId: ticket.tenant.id,
        userId:   null,
        type:     "ticket_reply",
        title:    "💬 Ticket Reply from Support",
        message:  `Support Team replied on ticket ${ticket.ticketNumber}`,
        metadata: { ticketId, ticketNumber: ticket.ticketNumber },
        isRead: false,
      },
    });

    emitToTenant(ticket.tenant.id, "ticket_reply", {
      ticketId,
      ticketNumber: ticket.ticketNumber,
      message,
      from: "Support Team",
    });

    await sendTicketEmail({
      to:          ticket.tenant?.email,
      subject:     `Reply on Ticket ${ticket.ticketNumber}`,
      ticketNumber: ticket.ticketNumber,
      title:       ticket.title,
      description: message,
      raisedBy:    "Support Team",
    });

    // ── If raised by USER → also notify + email User ──
    if (ticket.raisedBy === "USER" && ticket.user) {
      console.log("📧 Admin reply — User email:", ticket.user?.email);

      await prisma.notification.create({
        data: {
          tenantId: ticket.tenant.id,
          userId:   ticket.user.id,
          type:     "ticket_reply",
          title:    "💬 Reply on Your Ticket",
          message:  `Support Team replied on ticket ${ticket.ticketNumber}`,
          metadata: { ticketId, ticketNumber: ticket.ticketNumber },
          isRead: false,
        },
      });

      emitToUser(ticket.user.id, "ticket_reply", {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        message,
        from: "Support Team",
      });

      await sendTicketEmail({
        to:          ticket.user?.email,
        subject:     `Update on your Ticket ${ticket.ticketNumber}`,
        ticketNumber: ticket.ticketNumber,
        title:       ticket.title,
        description: message,
        raisedBy:    "Support Team",
      });
    }
  }

  return ticketMessage;
};

// ── SuperAdmin Change Status ──
export const updateTicketStatusService = async (ticketId, status) => {
  const ticket = await prisma.ticket.findUnique({
    where:   { id: ticketId },
    include: {
      tenant: { select: { email: true, tenantName: true, id: true } },
      user:   { select: { id: true,   email: true,       name: true } },
    },
  });
  if (!ticket) return null;

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data:  { status, updatedAt: new Date() },
  });

  if (status === "RESOLVED" || status === "CLOSED") {
    console.log("📧 Status update — Tenant email:", ticket.tenant?.email);

    await prisma.notification.create({
      data: {
        tenantId: ticket.tenant.id,
        userId:   null,
        type:     "ticket_status_updated",
        title:    `🔄 Ticket ${status}`,
        message:  `Ticket ${ticket.ticketNumber} is now ${status.toLowerCase()}`,
        metadata: { ticketId, ticketNumber: ticket.ticketNumber, status },
        isRead: false,
      },
    });

    emitToTenant(ticket.tenant.id, "ticket_status_updated", {
      ticketId,
      ticketNumber: ticket.ticketNumber,
      status,
    });

    await sendTicketEmail({
      to:          ticket.tenant?.email,
      subject:     `Ticket ${ticket.ticketNumber} — ${status}`,
      ticketNumber: ticket.ticketNumber,
      title:       ticket.title,
      description: `Your ticket status has been updated to ${status}.`,
      raisedBy:    "Support Team",
    });

    if (ticket.raisedBy === "USER" && ticket.user) {
      console.log("📧 Status update — User email:", ticket.user?.email);

      await prisma.notification.create({
        data: {
          tenantId: ticket.tenant.id,
          userId:   ticket.user.id,
          type:     "ticket_status_updated",
          title:    `🔄 Ticket ${status}`,
          message:  `Your ticket ${ticket.ticketNumber} is now ${status.toLowerCase()}`,
          metadata: { ticketId, ticketNumber: ticket.ticketNumber, status },
          isRead: false,
        },
      });

      emitToUser(ticket.user.id, "ticket_status_updated", {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        status,
      });

      await sendTicketEmail({
        to:          ticket.user?.email,
        subject:     `Your Ticket ${ticket.ticketNumber} — ${status}`,
        ticketNumber: ticket.ticketNumber,
        title:       ticket.title,
        description: `Your ticket has been ${status.toLowerCase()} by the support team.`,
        raisedBy:    "Support Team",
      });
    }
  }

  return updated;
};

// ── SuperAdmin Change Priority ──
export const updateTicketPriorityService = async (ticketId, priority) => {
  return await prisma.ticket.update({
    where: { id: ticketId },
    data:  { priority, updatedAt: new Date() },
  });
};