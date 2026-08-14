// backend/src/modules/analytics/analyticsService.js

import prisma from '../../config/prisma.js';

/**
 * Helper to build date range filter for Prisma queries
 */
const buildDateFilter = (startDate, endDate) => {
  const filter = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate)   filter.lte = new Date(endDate);
  return Object.keys(filter).length > 0 ? filter : undefined;
};

/**
 * Helper to format duration in seconds to human readable string (e.g. 2m 14s or 1h 12m)
 */
const formatDuration = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0s';
  const sec = Math.round(totalSeconds);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m ${remSec}s`;
  const hrs = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hrs}h ${remMin}m`;
};

// ─────────────────────────────────────────────────────────────
// 1. OVERVIEW KPIS WITH PREVIOUS PERIOD COMPARISON
// ─────────────────────────────────────────────────────────────
export const getOverviewStatsService = async (tenantId, { startDate, endDate, campaignId, agentId }) => {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end   = endDate   ? new Date(endDate)   : new Date();
  const durationMs = end.getTime() - start.getTime();

  const prevStart = new Date(start.getTime() - durationMs);
  const prevEnd   = new Date(start.getTime());

  // If a specific campaign is selected
  if (campaignId && campaignId !== 'all') {
    const campaign = await prisma.broadcast.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        recipients: {
          select: { contactId: true, status: true }
        }
      }
    });

    if (campaign) {
      const sent = campaign.sent || campaign.totalRecipients || 0;
      const delivered = campaign.delivered || 0;
      const read = campaign.read || 0;
      const failed = campaign.failed || 0;

      const recipientContactIds = campaign.recipients.map(r => r.contactId);
      const replied = recipientContactIds.length > 0 ? await prisma.message.count({
        where: {
          conversation: { tenantId, contactId: { in: recipientContactIds } },
          direction: 'INBOUND',
          createdAt: { gte: campaign.createdAt }
        }
      }) : 0;

      const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
      const readRate = delivered > 0 ? (read / delivered) * 100 : 0;
      const replyRate = read > 0 ? (replied / read) * 100 : (delivered > 0 ? (replied / delivered) * 100 : (sent > 0 ? (replied / sent) * 100 : 0));
      const failureRate = sent > 0 ? (failed / sent) * 100 : 0;

      return {
        totalSent: { value: sent.toLocaleString(), change: '0.0%', type: 'positive' },
        deliveryRate: { value: `${deliveryRate.toFixed(1)}%`, change: '0.0%', type: 'positive' },
        readRate: { value: `${readRate.toFixed(1)}%`, change: '0.0%', type: 'positive' },
        replyRate: { value: `${replyRate.toFixed(1)}%`, change: '0.0%', type: 'positive' },
        failureRate: { value: `${failureRate.toFixed(1)}%`, change: '0.0%', type: failureRate === 0 ? 'positive' : 'negative' }
      };
    }
  }

  // Base conversation filter for tenant
  const convWhere = { tenantId };
  if (agentId && agentId !== 'all') convWhere.assignedTo = agentId;

  const convs = await prisma.conversation.findMany({
    where: convWhere,
    select: { id: true }
  });
  const conversationIds = convs.map(c => c.id);

  // Helper for counting messages by status & direction in a date range
  const countMessages = async (dateRange, statusCondition = {}) => {
    return prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        ...statusCondition
      }
    });
  };

  // Status conditions matching uppercase/lowercase strings as well as explicit timestamp fields
  const deliveredCondition = {
    direction: 'OUTBOUND',
    OR: [
      { status: { in: ['delivered', 'DELIVERED', 'read', 'READ'] } },
      { deliveredAt: { not: null } },
      { readAt: { not: null } }
    ]
  };

  const readCondition = {
    direction: 'OUTBOUND',
    OR: [
      { status: { in: ['read', 'READ'] } },
      { readAt: { not: null } }
    ]
  };

  const failedCondition = {
    direction: 'OUTBOUND',
    OR: [
      { status: { in: ['failed', 'FAILED'] } },
      { failedAt: { not: null } }
    ]
  };

  // Current period counts
  const sent = await countMessages({ start, end }, { direction: 'OUTBOUND' });
  const delivered = await countMessages({ start, end }, deliveredCondition);
  const read = await countMessages({ start, end }, readCondition);
  const replied = await countMessages({ start, end }, { direction: 'INBOUND' });
  const failed = await countMessages({ start, end }, failedCondition);

  // Previous period counts
  const prevSent = await countMessages({ start: prevStart, end: prevEnd }, { direction: 'OUTBOUND' });
  const prevDelivered = await countMessages({ start: prevStart, end: prevEnd }, deliveredCondition);
  const prevRead = await countMessages({ start: prevStart, end: prevEnd }, readCondition);
  const prevReplied = await countMessages({ start: prevStart, end: prevEnd }, { direction: 'INBOUND' });
  const prevFailed = await countMessages({ start: prevStart, end: prevEnd }, failedCondition);

  // Also include BroadcastRecipient status if not filtering by agent
  let finalDelivered = delivered;
  let finalRead = read;
  let finalFailed = failed;
  let finalPrevDelivered = prevDelivered;
  let finalPrevRead = prevRead;
  let finalPrevFailed = prevFailed;

  if (!agentId || agentId === 'all') {
    const [bDelivered, bRead, bFailed, prevBDelivered, prevBRead, prevBFailed] = await Promise.all([
      prisma.broadcastRecipient.count({ where: { broadcast: { tenantId }, createdAt: { gte: start, lte: end }, status: { in: ['DELIVERED', 'READ'] } } }),
      prisma.broadcastRecipient.count({ where: { broadcast: { tenantId }, createdAt: { gte: start, lte: end }, status: 'READ' } }),
      prisma.broadcastRecipient.count({ where: { broadcast: { tenantId }, createdAt: { gte: start, lte: end }, status: 'FAILED' } }),
      prisma.broadcastRecipient.count({ where: { broadcast: { tenantId }, createdAt: { gte: prevStart, lte: prevEnd }, status: { in: ['DELIVERED', 'READ'] } } }),
      prisma.broadcastRecipient.count({ where: { broadcast: { tenantId }, createdAt: { gte: prevStart, lte: prevEnd }, status: 'READ' } }),
      prisma.broadcastRecipient.count({ where: { broadcast: { tenantId }, createdAt: { gte: prevStart, lte: prevEnd }, status: 'FAILED' } }),
    ]);

    finalDelivered = Math.max(delivered, bDelivered);
    finalRead = Math.max(read, bRead);
    finalFailed = Math.max(failed, bFailed);
    finalPrevDelivered = Math.max(prevDelivered, prevBDelivered);
    finalPrevRead = Math.max(prevRead, prevBRead);
    finalPrevFailed = Math.max(prevFailed, prevBFailed);
  }

  // Rates calculation
  const deliveryRate = sent > 0 ? (finalDelivered / sent) * 100 : 0;
  const readRate = finalDelivered > 0 ? (finalRead / finalDelivered) * 100 : 0;
  const rawReplyRate = finalRead > 0 ? (replied / finalRead) * 100 : (finalDelivered > 0 ? (replied / finalDelivered) * 100 : (sent > 0 ? (replied / sent) * 100 : 0));
  const replyRate = Math.min(100, rawReplyRate);
  const failureRate = sent > 0 ? (finalFailed / sent) * 100 : 0;

  const prevDeliveryRate = prevSent > 0 ? (finalPrevDelivered / prevSent) * 100 : 0;
  const prevReadRate = finalPrevDelivered > 0 ? (finalPrevRead / finalPrevDelivered) * 100 : 0;
  const prevRawReplyRate = finalPrevRead > 0 ? (prevReplied / finalPrevRead) * 100 : (finalPrevDelivered > 0 ? (prevReplied / finalPrevDelivered) * 100 : (prevSent > 0 ? (prevReplied / prevSent) * 100 : 0));
  const prevReplyRate = Math.min(100, prevRawReplyRate);
  const prevFailureRate = prevSent > 0 ? (finalPrevFailed / prevSent) * 100 : 0;

  const calcDiff = (curr, prev) => {
    const diff = curr - prev;
    return {
      value: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
      type: diff >= 0 ? 'positive' : 'negative'
    };
  };

  return {
    totalSent: {
      value: sent.toLocaleString(),
      change: `${sent >= prevSent ? '+' : ''}${prevSent > 0 ? (((sent - prevSent) / prevSent) * 100).toFixed(1) : 0}%`,
      type: sent >= prevSent ? 'positive' : 'negative'
    },
    deliveryRate: {
      value: `${deliveryRate.toFixed(1)}%`,
      change: calcDiff(deliveryRate, prevDeliveryRate).value,
      type: calcDiff(deliveryRate, prevDeliveryRate).type
    },
    readRate: {
      value: `${readRate.toFixed(1)}%`,
      change: calcDiff(readRate, prevReadRate).value,
      type: calcDiff(readRate, prevReadRate).type
    },
    replyRate: {
      value: `${replyRate.toFixed(1)}%`,
      change: calcDiff(replyRate, prevReplyRate).value,
      type: calcDiff(replyRate, prevReplyRate).type
    },
    failureRate: {
      value: `${failureRate.toFixed(1)}%`,
      change: calcDiff(failureRate, prevFailureRate).value,
      type: failureRate <= prevFailureRate ? 'positive' : 'negative' // Lower failure rate is good (positive)
    }
  };
};

// ─────────────────────────────────────────────────────────────
// 2. CONVERSION FUNNEL
// ─────────────────────────────────────────────────────────────
export const getFunnelDataService = async (tenantId, { startDate, endDate, campaignId, agentId }) => {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end   = endDate   ? new Date(endDate)   : new Date();

  // If a specific campaign is selected
  if (campaignId && campaignId !== 'all') {
    const campaign = await prisma.broadcast.findFirst({
      where: { id: campaignId, tenantId },
      include: { recipients: { select: { contactId: true } } }
    });
    if (campaign) {
      const sent = campaign.sent || campaign.totalRecipients || 0;
      const delivered = campaign.delivered || 0;
      const read = campaign.read || 0;
      const recipientContactIds = campaign.recipients.map(r => r.contactId);
      const replied = recipientContactIds.length > 0 ? await prisma.message.count({
        where: {
          conversation: { tenantId, contactId: { in: recipientContactIds } },
          direction: 'INBOUND',
          createdAt: { gte: campaign.createdAt }
        }
      }) : 0;

      const sentPct = 100;
      const deliveredPct = sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0;
      const readPct = sent > 0 ? Number(((read / sent) * 100).toFixed(1)) : 0;
      const repliedPct = sent > 0 ? Number((Math.min(100, (replied / sent) * 100)).toFixed(1)) : 0;

      return [
        { phase: '1. Sent', count: sent.toLocaleString(), rawCount: sent, percent: sentPct, dropoff: `${(100 - deliveredPct).toFixed(1)}% drop-off`, color: 'bg-slate-500' },
        { phase: '2. Delivered', count: delivered.toLocaleString(), rawCount: delivered, percent: deliveredPct, dropoff: `${(deliveredPct - readPct).toFixed(1)}% drop-off`, color: 'bg-blue-600' },
        { phase: '3. Read', count: read.toLocaleString(), rawCount: read, percent: readPct, dropoff: `${(readPct - repliedPct).toFixed(1)}% drop-off`, color: 'bg-indigo-600' },
        { phase: '4. Replied', count: replied.toLocaleString(), rawCount: replied, percent: repliedPct, dropoff: 'Final stage', color: 'bg-emerald-600' }
      ];
    }
  }

  const convs = await prisma.conversation.findMany({
    where: { tenantId, ...(agentId && agentId !== 'all' ? { assignedTo: agentId } : {}) },
    select: { id: true }
  });
  const conversationIds = convs.map(c => c.id);

  const sent = await prisma.message.count({
    where: { conversationId: { in: conversationIds }, createdAt: { gte: start, lte: end }, direction: 'OUTBOUND' }
  });
  const delivered = await prisma.message.count({
    where: {
      conversationId: { in: conversationIds },
      createdAt: { gte: start, lte: end },
      direction: 'OUTBOUND',
      OR: [
        { status: { in: ['delivered', 'DELIVERED', 'read', 'READ'] } },
        { deliveredAt: { not: null } },
        { readAt: { not: null } }
      ]
    }
  });
  const read = await prisma.message.count({
    where: {
      conversationId: { in: conversationIds },
      createdAt: { gte: start, lte: end },
      direction: 'OUTBOUND',
      OR: [
        { status: { in: ['read', 'READ'] } },
        { readAt: { not: null } }
      ]
    }
  });
  const replied = await prisma.message.count({
    where: { conversationId: { in: conversationIds }, createdAt: { gte: start, lte: end }, direction: 'INBOUND' }
  });

  let finalDelivered = delivered;
  let finalRead = read;

  if (!agentId || agentId === 'all') {
    const [bDelivered, bRead] = await Promise.all([
      prisma.broadcastRecipient.count({ where: { broadcast: { tenantId }, createdAt: { gte: start, lte: end }, status: { in: ['DELIVERED', 'READ'] } } }),
      prisma.broadcastRecipient.count({ where: { broadcast: { tenantId }, createdAt: { gte: start, lte: end }, status: 'READ' } })
    ]);
    finalDelivered = Math.max(delivered, bDelivered);
    finalRead = Math.max(read, bRead);
  }

  const sentPct = 100;
  const deliveredPct = sent > 0 ? Number(((finalDelivered / sent) * 100).toFixed(1)) : 0;
  const readPct = sent > 0 ? Number(((finalRead / sent) * 100).toFixed(1)) : 0;
  const repliedPct = sent > 0 ? Number((Math.min(100, (replied / sent) * 100)).toFixed(1)) : 0;

  return [
    { phase: '1. Sent', count: sent.toLocaleString(), rawCount: sent, percent: sentPct, dropoff: `${(100 - deliveredPct).toFixed(1)}% drop-off`, color: 'bg-slate-500' },
    { phase: '2. Delivered', count: finalDelivered.toLocaleString(), rawCount: finalDelivered, percent: deliveredPct, dropoff: `${(deliveredPct - readPct).toFixed(1)}% drop-off`, color: 'bg-blue-600' },
    { phase: '3. Read', count: finalRead.toLocaleString(), rawCount: finalRead, percent: readPct, dropoff: `${(readPct - repliedPct).toFixed(1)}% drop-off`, color: 'bg-indigo-600' },
    { phase: '4. Replied', count: replied.toLocaleString(), rawCount: replied, percent: repliedPct, dropoff: 'Final stage', color: 'bg-emerald-600' }
  ];
};

// ─────────────────────────────────────────────────────────────
// 3. MESSAGE VOLUME TRAFFIC (HOURLY / DAILY)
// ─────────────────────────────────────────────────────────────
export const getTrafficDataService = async (tenantId, { startDate, endDate, granularity = 'daily' }) => {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end   = endDate   ? new Date(endDate)   : new Date();

  const convs = await prisma.conversation.findMany({
    where: { tenantId },
    select: { id: true }
  });
  const conversationIds = convs.map(c => c.id);

  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
      createdAt: { gte: start, lte: end }
    },
    select: { createdAt: true, direction: true }
  });

  const trafficMap = {};

  if (granularity === 'hourly') {
    for (let i = 0; i < 24; i++) {
      const label = `${String(i).padStart(2, '0')}:00`;
      trafficMap[label] = { period: label, outgoing: 0, incoming: 0 };
    }
    messages.forEach(m => {
      const hour = `${String(new Date(m.createdAt).getHours()).padStart(2, '0')}:00`;
      if (trafficMap[hour]) {
        if (m.direction === 'OUTBOUND') trafficMap[hour].outgoing += 1;
        else trafficMap[hour].incoming += 1;
      }
    });
  } else {
    // Daily
    const curr = new Date(start);
    while (curr <= end) {
      const key = curr.toISOString().split('T')[0];
      const label = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trafficMap[key] = { period: label, outgoing: 0, incoming: 0 };
      curr.setDate(curr.getDate() + 1);
    }
    messages.forEach(m => {
      const key = new Date(m.createdAt).toISOString().split('T')[0];
      if (trafficMap[key]) {
        if (m.direction === 'OUTBOUND') trafficMap[key].outgoing += 1;
        else trafficMap[key].incoming += 1;
      }
    });
  }

  return Object.values(trafficMap);
};

// ─────────────────────────────────────────────────────────────
// 4. BROADCAST CAMPAIGN TABLE
// ─────────────────────────────────────────────────────────────
export const getCampaignsDataService = async (tenantId, { page = 1, limit = 8, sortColumn = 'sentDate', sortOrder = 'desc' }) => {
  const skip = (Number(page) - 1) * Number(limit);

  const total = await prisma.broadcast.count({ where: { tenantId } });

  const broadcasts = await prisma.broadcast.findMany({
    where: { tenantId },
    orderBy: { createdAt: sortOrder },
    skip,
    take: Number(limit),
    select: {
      id: true,
      name: true,
      createdAt: true,
      totalRecipients: true,
      sent: true,
      delivered: true,
      read: true,
      failed: true,
      status: true,
    }
  });

  const items = await Promise.all(broadcasts.map(async b => {
    const totalSent = b.sent || b.totalRecipients || 0;
    const deliveredPct = totalSent > 0 ? ((b.delivered / totalSent) * 100).toFixed(1) : '0.0';
    const readPct = b.delivered > 0 ? ((b.read / b.delivered) * 100).toFixed(1) : '0.0';

    // Check replies from recipients of this campaign
    let replyPct = '0.0';
    const recipientContactIds = (await prisma.broadcastRecipient.findMany({
      where: { broadcastId: b.id },
      select: { contactId: true }
    })).map(r => r.contactId);

    if (recipientContactIds.length > 0) {
      const repliedCount = await prisma.message.count({
        where: {
          conversation: { tenantId, contactId: { in: recipientContactIds } },
          direction: 'INBOUND',
          createdAt: { gte: b.createdAt }
        }
      });
      const baseForReply = b.read > 0 ? b.read : (b.delivered > 0 ? b.delivered : totalSent);
      replyPct = baseForReply > 0 ? ((repliedCount / baseForReply) * 100).toFixed(1) : '0.0';
    }

    return {
      id: b.id,
      name: b.name,
      sentDate: new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      recipients: b.totalRecipients || 0,
      deliveredPct: `${deliveredPct}%`,
      readPct: `${readPct}%`,
      replyPct: `${replyPct}%`,
      failed: b.failed || 0,
      status: b.status,
    };
  }));

  return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
};

// ─────────────────────────────────────────────────────────────
// 5. AGENT PERFORMANCE LEADERBOARD
// ─────────────────────────────────────────────────────────────
export const getAgentPerformanceDataService = async (tenantId, { startDate, endDate }) => {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end   = endDate   ? new Date(endDate)   : new Date();

  // Load all agents/users belonging to tenant
  const agents = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true }
  });

  // Calculate team total conversations & resolved
  const totalConvs = await prisma.conversation.count({
    where: { tenantId, createdAt: { gte: start, lte: end } }
  });
  const totalResolved = await prisma.conversation.count({
    where: { tenantId, status: { in: ['RESOLVED', 'CLOSED'] }, createdAt: { gte: start, lte: end } }
  });

  const leaderboard = await Promise.all(
    agents.map(async (agent, idx) => {
      const convs = await prisma.conversation.findMany({
        where: { tenantId, assignedTo: agent.id, createdAt: { gte: start, lte: end } },
        select: { incomingAt: true, firstResponseAt: true, closedAt: true, resolvedAt: true, status: true }
      });

      const handledCount = convs.length;
      const resolvedCount = convs.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length;

      // Calculate average FRT (seconds)
      let totalFrtSec = 0;
      let frtCount = 0;
      convs.forEach(c => {
        if (c.incomingAt && c.firstResponseAt) {
          const diffSec = (new Date(c.firstResponseAt).getTime() - new Date(c.incomingAt).getTime()) / 1000;
          if (diffSec > 0) {
            totalFrtSec += diffSec;
            frtCount += 1;
          }
        }
      });
      const avgFrtSec = frtCount > 0 ? totalFrtSec / frtCount : 0;

      // Calculate average ART (seconds)
      let totalArtSec = 0;
      let artCount = 0;
      convs.forEach(c => {
        const closeTime = c.closedAt || c.resolvedAt;
        if (c.incomingAt && closeTime) {
          const diffSec = (new Date(closeTime).getTime() - new Date(c.incomingAt).getTime()) / 1000;
          if (diffSec > 0) {
            totalArtSec += diffSec;
            artCount += 1;
          }
        }
      });
      const avgArtSec = artCount > 0 ? totalArtSec / artCount : 0;

      return {
        rank: idx + 1,
        agentId: agent.id,
        agentName: agent.name,
        avatarInitial: agent.name ? agent.name.charAt(0).toUpperCase() : 'A',
        conversations: handledCount,
        resolved: resolvedCount,
        frt: formatDuration(avgFrtSec),
        art: formatDuration(avgArtSec),
        csat: '—' // CSAT placeholder
      };
    })
  );

  // Sort leaderboard by conversations handled descending
  leaderboard.sort((a, b) => b.conversations - a.conversations);
  leaderboard.forEach((item, index) => { item.rank = index + 1; });

  return {
    summary: {
      totalConversations: totalConvs,
      resolvedConversations: totalResolved,
      totalMessages: await prisma.message.count({
        where: { conversation: { tenantId }, createdAt: { gte: start, lte: end } }
      })
    },
    leaderboard
  };
};

// ─────────────────────────────────────────────────────────────
// 6. FILTER OPTIONS (CAMPAIGNS + AGENTS)
// ─────────────────────────────────────────────────────────────
export const getFilterOptionsService = async (tenantId) => {
  const campaigns = await prisma.broadcast.findMany({
    where: { tenantId },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });

  const agents = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  return {
    campaigns: campaigns.map(c => ({ id: c.id, name: c.name })),
    agents: agents.map(a => ({ id: a.id, name: a.name }))
  };
};

// ─────────────────────────────────────────────────────────────
// 7. CSV EXPORTER BUILDER
// ─────────────────────────────────────────────────────────────
export const exportAnalyticsDataService = async (tenantId, filters) => {
  const overview = await getOverviewStatsService(tenantId, filters);
  const campaigns = await getCampaignsDataService(tenantId, { ...filters, limit: 100 });
  const agents = await getAgentPerformanceDataService(tenantId, filters);

  let csv = `ANALYTICS REPORT - ${new Date().toISOString().split('T')[0]}\n\n`;

  csv += `SECTION 1: OVERVIEW METRICS\n`;
  csv += `Metric,Value,Change vs Previous\n`;
  csv += `Total Sent,${overview.totalSent.value},${overview.totalSent.change}\n`;
  csv += `Delivery Rate,${overview.deliveryRate.value},${overview.deliveryRate.change}\n`;
  csv += `Read Rate,${overview.readRate.value},${overview.readRate.change}\n`;
  csv += `Reply Rate,${overview.replyRate.value},${overview.replyRate.change}\n`;
  csv += `Failure Rate,${overview.failureRate.value},${overview.failureRate.change}\n\n`;

  csv += `SECTION 2: CAMPAIGN PERFORMANCE\n`;
  csv += `Campaign Name,Sent Date,Recipients,Delivered %,Read %,Reply %,Failed,Status\n`;
  campaigns.items.forEach(c => {
    csv += `"${c.name}",${c.sentDate},${c.recipients},${c.deliveredPct},${c.readPct},${c.replyPct},${c.failed},${c.status}\n`;
  });

  csv += `\nSECTION 3: AGENT PERFORMANCE\n`;
  csv += `Rank,Agent Name,Conversations,Resolved,FRT,ART,CSAT\n`;
  agents.leaderboard.forEach(a => {
    csv += `${a.rank},"${a.agentName}",${a.conversations},${a.resolved},${a.frt},${a.art},${a.csat}\n`;
  });

  return csv;
};