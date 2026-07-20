// backend/src/modules/contacts/queueService.js
import prisma from '../../config/prisma.js';
import { isUserOnline, emitToUser, emitToTenant } from '../../lib/socket.js';

/**
 * ═══════════════════════════════════════════════════════════
 * Process ALL queued conversations for a tenant.
 * Called when a user comes online (from socket.js).
 * ═══════════════════════════════════════════════════════════
 */
export const processQueuedConversations = async (tenantId) => {
  console.log(`\n🔄 Processing queued conversations for tenant: ${tenantId}`);

  // Fetch all queued conversations (oldest first — FIFO)
  const queued = await prisma.conversation.findMany({
    where: {
      tenantId,
      mode: 'QUEUED'
    },
    include: {
      contact: true
    },
    orderBy: { createdAt: 'asc' }
  });

  if (queued.length === 0) {
    console.log(`✅ No queued conversations for tenant: ${tenantId}\n`);
    return { processed: 0, assigned: 0 };
  }

  console.log(`📋 Found ${queued.length} queued conversation(s)`);

  let assignedCount = 0;

  for (const conv of queued) {
    const assigned = await assignQueuedConversation(conv);
    if (assigned) assignedCount++;
  }

  // 🆕 Emit updated queue count to tenant
  const remainingQueueCount = await prisma.conversation.count({
    where: {
      tenantId,
      mode: 'QUEUED'
    }
  });

  emitToTenant(tenantId, 'queue_updated', {
    queueCount: remainingQueueCount
  });

  console.log(`✅ Queue processing done. Assigned: ${assignedCount}/${queued.length}, Remaining: ${remainingQueueCount}\n`);
  return { processed: queued.length, assigned: assignedCount };
};

/**
 * ═══════════════════════════════════════════════════════════
 * Try to assign ONE queued conversation to an available agent.
 * Uses same tag-priority logic as first-touch assignment.
 * ═══════════════════════════════════════════════════════════
 */
const assignQueuedConversation = async (conversation) => {
  const contact = conversation.contact;
  const tenantId = conversation.tenantId;

  console.log(`\n  ── Processing queued: ${contact.name} (${contact.phone}) ──`);

  // ── Step 1: Get contact tags ──
  const contactTags = await prisma.contactTagMapping.findMany({
    where: { contactId: contact.id },
    select: { tagId: true }
  });
  const contactTagIds = contactTags.map(ct => ct.tagId);
  console.log(`  🏷️  Contact tags: ${contactTagIds.length}`);

  let agent = null;

  // ── Step 2: Try tag-matched online agents first ──
  if (contactTagIds.length > 0) {
    agent = await findLeastBusyOnlineAgentByTags(tenantId, contactTagIds);
    if (agent) {
      console.log(`  ✅ Tag match → ${agent.name}`);
    }
  }

  // ── Step 3: Fallback to any online agent ──
  if (!agent) {
    console.log(`  ⚠️  No tag match. Trying fallback (any online agent)...`);
    agent = await findLeastBusyOnlineAgent(tenantId);
    if (agent) {
      console.log(`  ✅ Fallback → ${agent.name}`);
    }
  }

  // ── Step 4: Still no agent? Keep in queue ──
  if (!agent) {
    console.log(`  ⏳ Still no agent available. Conversation stays queued.`);
    return false;
  }

  // ── Step 5: Assign ──
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      mode: 'AGENT',
      botPaused: true,
      assignedTo: agent.id
    }
  });

  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      assignedTo: agent.id,
      assignedAt: new Date()
    }
  });

  console.log(`  ✅ Assigned queued conversation to ${agent.name}`);

  // 🆕 Notify customer via WhatsApp that agent is now assigned
  try {
    const { default: flowEngine } = await import('../automation/flowEngineService.js');
    const queueAssignedText = `✅ Great news! Our agent *${agent.name}* is now available and will assist you shortly. 💬`;

    await flowEngine.sendWhatsAppMessage(
      tenantId,
      contact.phone,
      queueAssignedText
    );

    await flowEngine.saveBotMessage(
      conversation.id,
      queueAssignedText
    );

    console.log(`  📤 Notified customer about agent assignment`);
  } catch (err) {
    console.error('  ❌ Failed to notify customer:', err.message);
  }

  // ── Step 6: Notify agent directly (badge/toast on dashboard) ──
  emitToUser(agent.id, 'new_assignment', {
    conversationId: conversation.id,
    contact: {
      id: contact.id,
      name: contact.name,
      phone: contact.phone
    },
    fromQueue: true  // flag so frontend can say "waiting chat now assigned"
  });

  // 🆕 Emit notification event (for bell icon in TopNavBar)
  emitToUser(agent.id, 'new_notification', {
    notification: {
      id: `assign_${conversation.id}_${Date.now()}`,
      type: 'contact_assigned',
      title: '🎯 New chat assigned',
      message: `${contact.name} has been assigned to you (from queue)`,
      isRead: false,
      createdAt: new Date(),
      metadata: {
        contactId: contact.id,
        conversationId: conversation.id,
      }
    }
  });

  // ── Step 7: Broadcast to tenant (for admin dashboard) ──
  emitToTenant(tenantId, 'conversation_assigned', {
    conversationId: conversation.id,
    agentId: agent.id,
    contact: {
      name: contact.name,
      phone: contact.phone
    },
    fromQueue: true
  });

  return true;
};

/**
 * ═══════════════════════════════════════════════════════════
 * Find least busy ONLINE agent matching contact tags.
 * Returns null if none available.
 * ═══════════════════════════════════════════════════════════
 */
const findLeastBusyOnlineAgentByTags = async (tenantId, contactTagIds) => {
  const matchingAgents = await prisma.userTagMapping.findMany({
    where: {
      tenantId,
      tagId: { in: contactTagIds }
    },
    include: { user: true }
  });

  // Filter: active + online + unique
  const eligibleAgents = matchingAgents
    .filter(m => m.user.isActive && isUserOnline(tenantId, m.user.id))
    .map(m => m.user)
    .filter((user, index, self) =>
      index === self.findIndex(u => u.id === user.id)
    );

  if (eligibleAgents.length === 0) return null;

  return await pickLeastBusyAgent(tenantId, eligibleAgents);
};

/**
 * ═══════════════════════════════════════════════════════════
 * Find least busy ONLINE agent (any tag).
 * Returns null if nobody online.
 * ═══════════════════════════════════════════════════════════
 */
const findLeastBusyOnlineAgent = async (tenantId) => {
  const allAgents = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true
    }
  });

  const onlineAgents = allAgents.filter(a => isUserOnline(tenantId, a.id));

  if (onlineAgents.length === 0) return null;

  return await pickLeastBusyAgent(tenantId, onlineAgents);
};

/**
 * ═══════════════════════════════════════════════════════════
 * From a list of eligible agents, pick the one with the
 * least assigned contacts (round-robin by load).
 * ═══════════════════════════════════════════════════════════
 */
const pickLeastBusyAgent = async (tenantId, agents) => {
  const agentCounts = await Promise.all(
    agents.map(async (a) => {
      const count = await prisma.contact.count({
        where: {
          tenantId,
          assignedTo: a.id
        }
      });
      return { agent: a, count };
    })
  );

  agentCounts.sort((a, b) => a.count - b.count);
  return agentCounts[0].agent;
};