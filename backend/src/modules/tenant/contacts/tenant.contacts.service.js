// backend/src/modules/tenant/contacts/tenant.contacts.service.js (do not remove this comment)
import prisma from '../../../config/prisma.js';
import { emitToTenant, emitToUser } from '../../../lib/socket.js';
import { createNotification } from '../../notifications/notification.service.js';

export const getUnassignedContacts = async (tenantId) => {
  return await prisma.contact.findMany({
    where: { tenantId, assignedTo: null },
    orderBy: { createdAt: 'desc' }
  });
};

export const assignContactService = async (contactId, userId, tenantId) => {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
  });
  if (!contact) throw new Error("Contact not found");

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true, name: true },
  });
  if (!user) throw new Error("User not found");

  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: { assignedTo: userId, assignedAt: new Date() },
  });

  const conversation = await prisma.conversation.findUnique({
    where: { contactId },
  });

  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedTo: userId },
    });
  }

  try {
    const notification = await createNotification({
      tenantId, userId, type: "contact_assigned",
      title: "Contact Assigned",
      message: `${contact.name || contact.phone} has been assigned to you`,
      metadata: { contactId, contactName: contact.name || contact.phone },
    });

    const notifPayload = {
      id: notification.id, type: notification.type, title: notification.title,
      message: notification.message, isRead: notification.isRead,
      createdAt: notification.createdAt, metadata: notification.metadata,
    };

    emitToTenant(tenantId, "new_notification", { notification: notifPayload });
    emitToUser(userId, "new_notification", { notification: notifPayload });

    if (conversation) {
      if (conversation.unreadCount > 0) {
        emitToUser(userId, 'unread_count_update', {
          conversationId: conversation.id, unreadCount: conversation.unreadCount,
          contactId: contact.id, contactName: contact.name || contact.phone,
        });
      }

      emitToUser(userId, 'conversation_assigned', {
        conversationId: conversation.id, contactId: contact.id,
        contactName: contact.name || contact.phone,
      });
    }

    const unassignedCount = await prisma.contact.count({
      where: { tenantId, assignedTo: null, isActive: true }
    });

    emitToTenant(tenantId, 'unassigned_contact_update', {
      unassignedCount, isNew: false,
      contact: { id: contact.id, name: contact.name, phone: contact.phone },
      conversationId: conversation?.id,
    });

    try {
      const flowEngineModule = await import('../../automation/flowEngine.service.js');
      const flowEngine = flowEngineModule.default;

      const customerMsg =
        `👋 Hi ${contact.name || 'there'}!\n\n` +
        `You've been connected with *${user.name}*.\n` +
        `They will respond to you shortly. 💬`;

      await flowEngine.sendWhatsAppMessage(tenantId, contact.phone, customerMsg);

      if (conversation) {
        await flowEngine.saveBotMessage(conversation.id, customerMsg);
      }
    } catch (waError) {
      console.error('WhatsApp notify failed:', waError.message);
    }

  } catch (err) {
    console.error('Assignment notification error:', err.message);
  }

  return updatedContact;
};

export const reassignContactService = async (contactId, newUserId, tenantId) => {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
  });
  if (!contact) throw new Error('Contact not found');

  const user = await prisma.user.findFirst({
    where: { id: newUserId, tenantId },
    select: { id: true, name: true },
  });
  if (!user) throw new Error('User not found');

  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: { assignedTo: newUserId, assignedAt: new Date() },
  });

  const conversation = await prisma.conversation.findUnique({
    where: { contactId },
  });

  if (conversation) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedTo: newUserId },
    });
  }

  try {
    const notification = await createNotification({
      tenantId, userId: newUserId, type: 'contact_assigned',
      title: 'Contact Reassigned',
      message: `${contact.name || contact.phone} has been assigned to you`,
      metadata: { contactId, contactName: contact.name || contact.phone },
    });

    const notifPayload = {
      id: notification.id, type: notification.type, title: notification.title,
      message: notification.message, isRead: notification.isRead,
      createdAt: notification.createdAt, metadata: notification.metadata,
    };

    emitToTenant(tenantId, 'new_notification', { notification: notifPayload });
    emitToUser(newUserId, 'new_notification', { notification: notifPayload });

    if (conversation) {
      if (conversation.unreadCount > 0) {
        emitToUser(newUserId, 'unread_count_update', {
          conversationId: conversation.id, unreadCount: conversation.unreadCount,
          contactId: contact.id, contactName: contact.name || contact.phone,
        });
      }

      emitToUser(newUserId, 'conversation_assigned', {
        conversationId: conversation.id, contactId: contact.id,
        contactName: contact.name || contact.phone,
      });
    }

    try {
      const flowEngineModule = await import('../../automation/flowEngine.service.js');
      const flowEngine = flowEngineModule.default;

      const customerMsg =
        `👋 Hi ${contact.name || 'there'}!\n\n` +
        `Your conversation has been transferred to *${user.name}*.\n` +
        `They will help you from here. 💬`;

      await flowEngine.sendWhatsAppMessage(tenantId, contact.phone, customerMsg);

      if (conversation) {
        await flowEngine.saveBotMessage(conversation.id, customerMsg);
      }
    } catch (waError) {
      console.error('WhatsApp notify failed:', waError.message);
    }

  } catch (err) {
    console.error('Reassign notification error:', err.message);
  }

  return updatedContact;
};

export const unassignContactService = async (contactId, tenantId) => {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
  });

  if (!contact) throw new Error("Contact not found");
  if (!contact.assignedTo) throw new Error("Contact is already unassigned");

  const updatedContact = await prisma.contact.update({
    where: { id: contactId },
    data: { assignedTo: null, assignedAt: null },
  });

  return updatedContact;
};