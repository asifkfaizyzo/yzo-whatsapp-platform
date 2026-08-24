import prisma from '../../config/prisma.js';
import { processBroadcastCampaign } from './broadcastService.js';
import { checkFeatureAccess, checkLimitAccess } from '../../lib/planLimits.js';
import { parseMetaError } from '../../lib/metaErrorCodes.js';
import { emitToTenant } from '../../lib/socket.js';

// 1. GET: Fetch all broadcasts history for the logged-in tenant
export const getBroadcasts = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const campaigns = await prisma.broadcast.findMany({
      where: { tenantId },
      include: {
        template: { select: { name: true, category: true } },
        tags: { include: { tag: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Error fetching broadcasts list:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch broadcasts.' });
  }
};

// 2. GET: Fetch detailed recipient stats for a campaign (Summary / Basic)
export const getBroadcastStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const { id } = req.params;

    const campaign = await prisma.broadcast.findFirst({
      where: { id, tenantId },
      include: {
        template: { select: { name: true, category: true, language: true } },
        tags: { include: { tag: { select: { name: true } } } }
      }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    return res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    console.error('Error fetching broadcast stats:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch broadcast stats.' });
  }
};

// 3. GET: Paginated & Filterable Recipient Delivery Logs with Search
export const getBroadcastRecipients = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const status = req.query.status ? String(req.query.status).toUpperCase() : 'ALL';
    const search = req.query.search ? String(req.query.search).trim() : '';

    // Verify campaign belongs to tenant
    const campaign = await prisma.broadcast.findFirst({
      where: { id, tenantId },
      include: { template: { select: { name: true, language: true, category: true } } }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    // Build recipient filter
    const where = { broadcastId: id };

    if (status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.contact = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    // Fetch total matching and paginated items in parallel
    const [recipients, totalCount, statusCounts] = await Promise.all([
      prisma.broadcastRecipient.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        include: {
          contact: { select: { id: true, name: true, phone: true } }
        }
      }),
      prisma.broadcastRecipient.count({ where }),
      prisma.broadcastRecipient.groupBy({
        by: ['status'],
        where: { broadcastId: id },
        _count: { status: true }
      })
    ]);

    // Format status breakdown
    const counts = {
      all: campaign.totalRecipients || 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0
    };

    statusCounts.forEach(sc => {
      const st = String(sc.status).toLowerCase();
      if (counts[st] !== undefined) {
        counts[st] = sc._count.status;
      }
    });

    // Enrich recipients with structured Meta diagnostic metadata
    const enrichedRecipients = recipients.map(r => {
      let errorDiagnostic = null;
      if (r.status === 'FAILED') {
        errorDiagnostic = parseMetaError(r.errorCode, r.errorMessage);
      }
      return {
        id: r.id,
        contactId: r.contactId,
        contactName: r.contact?.name || 'Unknown Contact',
        contactPhone: r.contact?.phone || '-',
        status: r.status,
        wamid: r.wamid,
        sentAt: r.sentAt,
        deliveredAt: r.deliveredAt,
        readAt: r.readAt,
        failedAt: r.failedAt,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        errorDiagnostic
      };
    });

    // Calculate precision funnel rates
    const total = campaign.totalRecipients || 1;
    const sentCount = campaign.sent || 0;
    const deliveredCount = campaign.delivered || 0;
    const readCount = campaign.read || 0;
    const failedCount = campaign.failed || 0;

    const deliveryRate = sentCount > 0 ? ((deliveredCount / sentCount) * 100).toFixed(1) : '0.0';
    const readRate = deliveredCount > 0 ? ((readCount / deliveredCount) * 100).toFixed(1) : '0.0';
    const failureRate = total > 0 ? ((failedCount / total) * 100).toFixed(1) : '0.0';

    return res.status(200).json({
      success: true,
      data: {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          createdAt: campaign.createdAt,
          scheduledAt: campaign.scheduledAt,
          startedAt: campaign.startedAt,
          completedAt: campaign.completedAt,
          templateName: campaign.template?.name,
          templateCategory: campaign.template?.category,
          rates: {
            deliveryRate,
            readRate,
            failureRate
          }
        },
        counts,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1
        },
        recipients: enrichedRecipients
      }
    });
  } catch (error) {
    console.error('Error fetching broadcast recipients:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch broadcast recipient logs.' });
  }
};

// 4. GET: Export Recipient Delivery Report to CSV
export const exportBroadcastRecipients = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const campaign = await prisma.broadcast.findFirst({
      where: { id, tenantId },
      include: {
        template: { select: { name: true } },
        recipients: {
          include: { contact: { select: { name: true, phone: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    const safeCampaignName = (campaign.name || 'broadcast').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `broadcast_${safeCampaignName}_report_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // CSV Header row
    let csvContent = 'Contact Name,Phone Number,Status,Sent At,Delivered At,Read At,Failed At,Error Code,Error Description,Action Suggestion\n';

    campaign.recipients.forEach(r => {
      const name = `"${(r.contact?.name || '').replace(/"/g, '""')}"`;
      const phone = `"${(r.contact?.phone || '').replace(/"/g, '""')}"`;
      const status = r.status;
      const sentAt = r.sentAt ? new Date(r.sentAt).toISOString() : '';
      const deliveredAt = r.deliveredAt ? new Date(r.deliveredAt).toISOString() : '';
      const readAt = r.readAt ? new Date(r.readAt).toISOString() : '';
      const failedAt = r.failedAt ? new Date(r.failedAt).toISOString() : '';
      const errorCode = r.errorCode || '';

      const diag = r.status === 'FAILED' ? parseMetaError(r.errorCode, r.errorMessage) : null;
      const errorDesc = diag ? `"${diag.title.replace(/"/g, '""')}"` : '';
      const action = diag ? `"${diag.action.replace(/"/g, '""')}"` : '';

      csvContent += `${name},${phone},${status},${sentAt},${deliveredAt},${readAt},${failedAt},${errorCode},${errorDesc},${action}\n`;
    });

    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting broadcast recipients CSV:', error);
    return res.status(500).json({ success: false, message: 'Failed to export broadcast report.' });
  }
};

// 5. POST: Smart "Retry Failed" Recipients for a Campaign
export const retryFailedBroadcast = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tenant = req.tenant;
    const { id } = req.params;

    const campaign = await prisma.broadcast.findFirst({
      where: { id, tenantId },
      include: {
        template: true,
        recipients: {
          where: { status: 'FAILED' },
          include: { contact: true }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    if (campaign.recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'No failed recipients found to retry.' });
    }

    // Filter out non-recoverable failures (e.g. invalid phone number 131026)
    const retryableRecipients = campaign.recipients.filter(r => {
      const diag = parseMetaError(r.errorCode, r.errorMessage);
      return diag.isRecoverable !== false;
    });

    if (retryableRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All failed contacts have permanent errors (e.g. invalid numbers not registered on WhatsApp) and cannot be retried.'
      });
    }

    const recipientIds = retryableRecipients.map(r => r.id);
    const retryContacts = retryableRecipients.map(r => r.contact);

    // Reset status to PENDING
    await prisma.broadcastRecipient.updateMany({
      where: { id: { in: recipientIds } },
      data: {
        status: 'PENDING',
        failedAt: null,
        errorCode: null,
        errorMessage: null
      }
    });

    // Update campaign stats
    const updatedCampaign = await prisma.broadcast.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        failed: { decrement: retryableRecipients.length }
      }
    });

    // Re-queue to BullMQ
    processBroadcastCampaign(
      campaign.id,
      tenant,
      retryContacts,
      campaign.template,
      campaign.defaultParams,
      0
    );

    emitToTenant(tenantId, 'broadcast_update', {
      broadcastId: campaign.id,
      sent: updatedCampaign.sent,
      delivered: updatedCampaign.delivered,
      read: updatedCampaign.read,
      failed: updatedCampaign.failed,
      status: updatedCampaign.status
    });

    return res.status(200).json({
      success: true,
      message: `Re-queued ${retryableRecipients.length} retryable failed contacts for delivery.`,
      retriedCount: retryableRecipients.length,
      skippedPermanentCount: campaign.recipients.length - retryableRecipients.length
    });
  } catch (error) {
    console.error('Error retrying failed broadcast recipients:', error);
    return res.status(500).json({ success: false, message: 'Failed to retry failed broadcast recipients.' });
  }
};

// 6. POST: Pause an active sending campaign
export const pauseBroadcast = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const campaign = await prisma.broadcast.findFirst({
      where: { id, tenantId }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    if (campaign.status !== 'PROCESSING') {
      return res.status(400).json({ success: false, message: `Cannot pause campaign in ${campaign.status} state.` });
    }

    const updated = await prisma.broadcast.update({
      where: { id },
      data: { status: 'PAUSED' }
    });

    emitToTenant(tenantId, 'broadcast_update', {
      broadcastId: id,
      sent: updated.sent,
      delivered: updated.delivered,
      read: updated.read,
      failed: updated.failed,
      status: 'PAUSED'
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign has been paused.',
      data: updated
    });
  } catch (error) {
    console.error('Error pausing broadcast:', error);
    return res.status(500).json({ success: false, message: 'Failed to pause campaign.' });
  }
};

// 7. POST: Resume a paused campaign
export const resumeBroadcast = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const campaign = await prisma.broadcast.findFirst({
      where: { id, tenantId }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    if (campaign.status !== 'PAUSED') {
      return res.status(400).json({ success: false, message: `Cannot resume campaign in ${campaign.status} state.` });
    }

    const updated = await prisma.broadcast.update({
      where: { id },
      data: { status: 'PROCESSING' }
    });

    emitToTenant(tenantId, 'broadcast_update', {
      broadcastId: id,
      sent: updated.sent,
      delivered: updated.delivered,
      read: updated.read,
      failed: updated.failed,
      status: 'PROCESSING'
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign has been resumed.',
      data: updated
    });
  } catch (error) {
    console.error('Error resuming broadcast:', error);
    return res.status(500).json({ success: false, message: 'Failed to resume campaign.' });
  }
};

// 8. POST: Create and launch a new Broadcast Campaign
export const launchBroadcast = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tenant = req.tenant;
    const { name, templateId, targetType, tagIds, defaultParams, scheduledAt } = req.body;

    // Check if Tenant has WhatsApp Credentials & Phone Number configured
    if (!tenant.whatsappPhoneId || !tenant.whatsappWabaId || !tenant.whatsappAccessToken) {
      return res.status(400).json({
        success: false,
        requiresWhatsApp: true,
        message: 'Please connect your WhatsApp Business Account and Phone Number in Settings before launching broadcast campaigns.',
      });
    }

    if (!name || !templateId || !targetType) {
      return res.status(400).json({ success: false, message: 'Name, Template ID, and Target Type are required.' });
    }

    // Check scheduler feature
    if (scheduledAt) {
      const targetTime = new Date(scheduledAt).getTime();
      if (!isNaN(targetTime) && targetTime > Date.now()) {
        const featureCheck = await checkFeatureAccess(tenantId, 'Campaign Scheduler');
        if (!featureCheck.allowed) {
          return res.status(featureCheck.status).json({
            success: false,
            code: featureCheck.code,
            message: featureCheck.message
          });
        }
      }
    }

    // Check campaign limit
    const campaignCheck = await checkLimitAccess(tenantId, 'maxCampaigns');
    if (!campaignCheck.allowed) {
      return res.status(campaignCheck.status).json({
        success: false,
        code: campaignCheck.code,
        message: campaignCheck.message
      });
    }

    let delayMs = 0;
    let campaignStatus = 'PROCESSING';
    let scheduledDate = null;

    if (scheduledAt) {
      const targetTime = new Date(scheduledAt).getTime();
      if (!isNaN(targetTime) && targetTime > Date.now()) {
        delayMs = targetTime - Date.now();
        campaignStatus = 'SCHEDULED';
        scheduledDate = new Date(scheduledAt);
      }
    }

    // Fetch the template record
    const template = await prisma.template.findFirst({
      where: { id: templateId, tenantId }
    });

    if (!template || template.status === 'DELETED') {
      return res.status(404).json({ success: false, message: 'Template not found or deleted.' });
    }

    // 1. Identify recipient contacts
    let contacts = [];
    if (targetType === 'ALL') {
      contacts = await prisma.contact.findMany({
        where: { tenantId, isActive: true }
      });
    } else if (targetType === 'TAGS') {
      if (!tagIds || tagIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Target Tag IDs are required for TAGS targeting.' });
      }

      contacts = await prisma.contact.findMany({
        where: {
          tenantId,
          isActive: true,
          contactTags: {
            some: { tagId: { in: tagIds } }
          }
        }
      });
    }

    if (contacts.length === 0) {
      return res.status(400).json({ success: false, message: 'No active contacts matched the targeting criteria.' });
    }

    // Check broadcast recipients limit
    const broadcastCheck = await checkLimitAccess(tenantId, 'maxBroadcasts', contacts.length);
    if (!broadcastCheck.allowed) {
      return res.status(broadcastCheck.status).json({
        success: false,
        code: broadcastCheck.code,
        message: broadcastCheck.message
      });
    }

    // 2. Create the Broadcast record
    const campaign = await prisma.broadcast.create({
      data: {
        tenantId,
        name,
        templateId,
        targetType,
        defaultParams: defaultParams || {},
        status: campaignStatus,
        scheduledAt: scheduledDate,
        totalRecipients: contacts.length,
        createdById: null
      }
    });

    // Save Selected Tags mapping if applicable
    if (targetType === 'TAGS') {
      await prisma.broadcastTag.createMany({
        data: tagIds.map(tId => ({ broadcastId: campaign.id, tagId: tId }))
      });
    }

    // 3. Create placeholder records for recipients in PENDING state
    await prisma.broadcastRecipient.createMany({
      data: contacts.map(c => ({
        broadcastId: campaign.id,
        contactId: c.id,
        status: 'PENDING',
        params: defaultParams || {}
      }))
    });

    // 4. Trigger asynchronous campaign processing
    processBroadcastCampaign(campaign.id, tenant, contacts, template, defaultParams, delayMs);

    return res.status(201).json({
      success: true,
      message: campaignStatus === 'SCHEDULED'
        ? `Broadcast scheduled for ${scheduledDate.toISOString()} (${contacts.length} recipients).`
        : `Broadcast launched to ${contacts.length} recipients.`,
      campaignId: campaign.id,
      scheduledAt: scheduledDate
    });
  } catch (error) {
    console.error('Error launching broadcast:', error);
    return res.status(500).json({ success: false, message: 'Failed to launch broadcast.' });
  }
};

// 9. POST: Cancel a scheduled or processing campaign
export const cancelBroadcast = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const campaign = await prisma.broadcast.findFirst({
      where: { id, tenantId }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: `Campaign is already ${campaign.status.toLowerCase()}.` });
    }

    const updated = await prisma.broadcast.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    console.log(`🚫 Campaign ${id} was CANCELLED by tenant admin.`);

    emitToTenant(tenantId, 'broadcast_update', {
      broadcastId: id,
      sent: updated.sent,
      delivered: updated.delivered,
      read: updated.read,
      failed: updated.failed,
      status: 'CANCELLED'
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign has been cancelled successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Error cancelling broadcast campaign:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel campaign.' });
  }
};