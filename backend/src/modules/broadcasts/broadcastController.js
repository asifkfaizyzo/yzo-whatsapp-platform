import prisma from '../../config/prisma.js';
import { processBroadcastCampaign } from './broadcastService.js';

// 1. GET: Fetch all broadcasts history for the logged-in tenant
export const getBroadcasts = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const campaigns = await prisma.broadcast.findMany({
      where: { tenantId },
      include: {
        template: { select: { name: true } },
        tags: { include: { tag: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Error fetching broadcasts list:', error);
    return res.status(550).json({ success: false, message: 'Failed to fetch broadcasts.' });
  }
};

// 2. GET: Fetch detailed recipient stats for a campaign
export const getBroadcastStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const campaign = await prisma.broadcast.findFirst({
      where: { id, tenantId },
      include: {
        recipients: {
          include: { contact: { select: { name: true, phone: true } } }
        }
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

// 3. POST: Create and launch a new Broadcast Campaign
export const launchBroadcast = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tenant = req.tenant;
    const { name, templateId, targetType, tagIds, defaultParams, scheduledAt } = req.body;

    if (!name || !templateId || !targetType) {
      return res.status(400).json({ success: false, message: 'Name, Template ID, and Target Type are required.' });
    }

    // Check if campaign is scheduled for a future date/time
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

      // Fetch contacts that have at least one of the selected tags
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

    // Fetch User creator record
    const user = await prisma.user.findFirst({ where: { tenantId } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Need at least one agent user registered under tenant.' });
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
        createdById: user.id
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

    // 4. Trigger asynchronous campaign processing (non-blocking) with delayMs if scheduled
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

// 4. POST: Cancel a scheduled or processing campaign
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

    // Update campaign status to CANCELLED
    const updated = await prisma.broadcast.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    console.log(`🚫 Campaign ${id} was CANCELLED by tenant admin.`);

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