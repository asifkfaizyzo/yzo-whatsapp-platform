import prisma from '../../config/prisma.js';
import { 
  sendEnterpriseLeadConfirmationEmail, 
  sendEnterpriseLeadNotificationEmail,
  sendEnterpriseAccountActivationEmail 
} from '../auth/emailService.js';
import { validationResult } from 'express-validator';

// Map UI display values to Prisma DB enum keys
const mapCompanySize = (size) => {
  if (size === '1-10') return 'size_1_10';
  if (size === '11-50') return 'size_11_50';
  if (size === '51-200') return 'size_51_200';
  if (size === '200+') return 'size_200_plus';
  return size;
};

const mapTimeline = (timeline) => {
  if (timeline === '1-3months') return 'months_1_3';
  return timeline; // 'urgent' or 'exploring'
};

// Map Prisma DB enum keys back to UI display values for API response
const unmapCompanySize = (size) => {
  if (size === 'size_1_10') return '1-10';
  if (size === 'size_11_50') return '11-50';
  if (size === 'size_51_200') return '51-200';
  if (size === 'size_200_plus') return '200+';
  return size;
};

const unmapTimeline = (timeline) => {
  if (timeline === 'months_1_3') return '1-3months';
  return timeline;
};

// ── Submit Enterprise Lead (Onboarding) ──
export const submitEnterpriseLead = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }

  const tenantId = req.tenantId; // From verifyOnboarding middleware
  const { 
    companyName, 
    contactName, 
    email, 
    phone, 
    role, 
    companySize, 
    estimatedUsers, 
    requirements, 
    timeline, 
    preferredContact 
  } = req.body;

  try {
    const sizeEnum = mapCompanySize(companySize);
    const timelineEnum = mapTimeline(timeline);

    // 1️⃣ Create the lead record
    const lead = await prisma.enterpriseLead.create({
      data: {
        tenantId,
        companyName,
        contactName,
        email,
        phone: phone || null,
        role: role || null,
        companySize: sizeEnum,
        estimatedUsers: estimatedUsers ? parseInt(estimatedUsers) : null,
        requirements: requirements || null,
        timeline: timelineEnum,
        preferredContact,
        status: 'pending',
        history: [
          {
            status: 'pending',
            timestamp: new Date().toISOString(),
            adminName: 'System',
            adminId: 'system',
            notes: 'Enterprise lead request submitted via onboarding flow.'
          }
        ]
      },
    });

    // 2️⃣ Update the Tenant: planStatus = 'enterprise_pending', onboardingStep = 6
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planStatus: 'enterprise_pending',
        onboardingStep: 6,
      },
    });

    // 3️⃣ Send Nodemailer emails (non-blocking)
    sendEnterpriseLeadConfirmationEmail(email, contactName).catch(console.error);
    
    const adminEmail = process.env.EMAIL_USER || 'admin@sudoreply.com';
    sendEnterpriseLeadNotificationEmail(adminEmail, {
      companyName,
      contactName,
      email,
      phone,
      role,
      companySize,
      estimatedUsers,
      requirements,
      timeline,
      preferredContact
    }).catch(console.error);

    return res.status(201).json({ 
      success: true, 
      status: 'enterprise_pending',
      data: lead 
    });
  } catch (error) {
    console.error('❌ Submit enterprise lead error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to submit enterprise request' 
    });
  }
};

// ── Reset Onboarding: Choose a different plan ──
export const resetEnterpriseLead = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    // 1️⃣ Delete any enterprise leads associated with this tenant
    await prisma.enterpriseLead.deleteMany({
      where: { tenantId, status: 'pending' },
    });

    // 2️⃣ Reset plan status to inactive or none
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planStatus: 'inactive', // or none, inactive is default in schema.prisma
      },
    });

    return res.json({ 
      success: true, 
      message: 'Onboarding reset successfully', 
      tenant: updatedTenant 
    });
  } catch (error) {
    console.error('❌ Reset enterprise lead error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to reset onboarding flow' 
    });
  }
};

// ── Admin: Get Paginated Leads ──
export const getLeads = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;
  const companySize = req.query.company_size;
  const timeline = req.query.timeline;
  const search = req.query.search;

  const skip = (page - 1) * limit;

  // Build where conditions
  const where = {};
  if (status) {
    where.status = status;
  }
  if (companySize) {
    where.companySize = mapCompanySize(companySize);
  }
  if (timeline) {
    where.timeline = mapTimeline(timeline);
  }
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { contactName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const [leads, total] = await Promise.all([
      prisma.enterpriseLead.findMany({
        where,
        skip,
        take: limit,
        include: {
          tenant: {
            select: {
              id: true,
              tenantName: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            }
          }
        },
        orderBy: [
          // Order pending first, then by date desc
          { status: 'asc' }, 
          { createdAt: 'desc' }
        ]
      }),
      prisma.enterpriseLead.count({ where }),
    ]);

    const formattedLeads = leads.map(lead => ({
      ...lead,
      companySize: unmapCompanySize(lead.companySize),
      timeline: unmapTimeline(lead.timeline)
    }));

    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: formattedLeads,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('❌ Get enterprise leads error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch enterprise leads' 
    });
  }
};

// ── Admin: Get Single Lead Details ──
export const getLead = async (req, res) => {
  const { id } = req.params;

  try {
    const lead = await prisma.enterpriseLead.findUnique({
      where: { id },
      include: {
        tenant: true
      }
    });

    if (!lead) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lead not found' 
      });
    }

    const formattedLead = {
      ...lead,
      companySize: unmapCompanySize(lead.companySize),
      timeline: unmapTimeline(lead.timeline)
    };

    return res.json({ 
      success: true, 
      data: formattedLead 
    });
  } catch (error) {
    console.error('❌ Get single lead error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch lead details' 
    });
  }
};

// ── Admin: Update Lead Status & History Log ──
export const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'contacted', 'negotiating', 'converted', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid status value' 
    });
  }

  try {
    const lead = await prisma.enterpriseLead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lead not found' 
      });
    }

    // Add status history entry
    const historyItem = {
      status,
      timestamp: new Date().toISOString(),
      adminName: req.superAdmin?.name || 'Admin',
      adminId: req.superAdminId || 'unknown',
      notes: `Status changed to '${status}'`
    };

    const currentHistory = Array.isArray(lead.history) ? lead.history : [];
    const updatedHistory = [...currentHistory, historyItem];

    const updatedLead = await prisma.enterpriseLead.update({
      where: { id },
      data: {
        status,
        history: updatedHistory
      }
    });

    return res.json({ 
      success: true, 
      data: updatedLead 
    });
  } catch (error) {
    console.error('❌ Update status error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update status' 
    });
  }
};

// ── Admin: Update Notes ──
export const updateNotes = async (req, res) => {
  const { id } = req.params;
  const { internal_notes } = req.body;

  try {
    const updated = await prisma.enterpriseLead.update({
      where: { id },
      data: {
        internalNotes: internal_notes
      }
    });

    return res.json({ 
      success: true, 
      data: updated 
    });
  } catch (error) {
    console.error('❌ Update notes error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to save notes' 
    });
  }
};

// ── Admin: Activate Enterprise Account ──
export const activateTenant = async (req, res) => {
  const { id } = req.params;
  const adminId = req.superAdminId; // From verifySuperAdmin middleware

  try {
    const lead = await prisma.enterpriseLead.findUnique({
      where: { id }
    });

    if (!lead) {
      return res.status(404).json({ 
        success: false, 
        message: 'Lead not found' 
      });
    }

    if (lead.status === 'converted') {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant account is already activated' 
      });
    }

    // Add status history entry
    const historyItem = {
      status: 'converted',
      timestamp: new Date().toISOString(),
      adminName: req.superAdmin?.name || 'Admin',
      adminId,
      notes: 'Enterprise account activated.'
    };

    const currentHistory = Array.isArray(lead.history) ? lead.history : [];
    const updatedHistory = [...currentHistory, historyItem];

    // Update records inside a transaction
    await prisma.$transaction([
      // 1️⃣ Update lead status
      prisma.enterpriseLead.update({
        where: { id },
        data: {
          status: 'converted',
          activatedAt: new Date(),
          activatedByAdminId: adminId,
          history: updatedHistory
        }
      }),
      // 2️⃣ Update tenant status and activation
      prisma.tenant.update({
        where: { id: lead.tenantId },
        data: {
          planStatus: 'enterprise_active',
          isActive: true,
          status: 'APPROVED' // Force APPROVED status so they can bypass restrictions
        }
      })
    ]);

    // 3️⃣ Send activation confirmation email to tenant (non-blocking)
    sendEnterpriseAccountActivationEmail(lead.email, lead.contactName).catch(console.error);

    return res.json({ 
      success: true, 
      message: 'Enterprise account activated successfully' 
    });
  } catch (error) {
    console.error('❌ Activate enterprise account error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to activate enterprise account' 
    });
  }
};

// ── Admin: Delete Lead ──
export const deleteLead = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.enterpriseLead.delete({
      where: { id },
    });

    return res.json({ 
      success: true, 
      message: 'Lead record deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Delete lead error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to delete lead record' 
    });
  }
};
