import prisma from '../../config/prisma.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendStatusUpdateEmail = async (email, companyName, status, extraNote = "") => {
  try {
    await transporter.sendMail({
      from: `"SudoReply System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Subscription status updated: ${status}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
          <h2>Subscription Notification</h2>
          <p>Hi ${companyName},</p>
          <p>We are writing to notify you that your subscription status on SudoReply has been updated to: <strong>${status}</strong>.</p>
          ${extraNote ? `<p>${extraNote}</p>` : ''}
          <p>If you have any questions, please reach out to support@sudoreply.com.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Error sending admin action status email:", err);
  }
};

export const getSubscriptions = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const { status, plan, search } = req.query;

  const where = {};
  if (status) where.subscriptionStatus = status;
  if (plan) {
    where.OR = [
      { currentPlan: plan },
      { plan: { name: plan } }
    ];
  }
  if (search) {
    where.OR = [
      { tenantName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  try {
    const [tenants, total] = await prisma.$transaction([
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantName: true,
          email: true,
          currentPlan: true,
          plan: {
            select: { name: true }
          },
          subscriptionStatus: true,
          planPeriodEnd: true,
          cancelRequestedAt: true,
          cancellationReason: true,
          dataDeletionDate: true
        }
      }),
      prisma.tenant.count({ where })
    ]);

    const formattedTenants = tenants.map(t => ({
      id: t.id,
      tenantName: t.tenantName,
      email: t.email,
      currentPlan: t.currentPlan || (t.plan ? t.plan.name : "Starter"),
      subscriptionStatus: t.subscriptionStatus,
      planPeriodEnd: t.planPeriodEnd,
      cancelRequestedAt: t.cancelRequestedAt,
      cancellationReason: t.cancellationReason,
      dataDeletionDate: t.dataDeletionDate
    }));

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: {
        tenants: formattedTenants,
        total,
        page,
        totalPages
      }
    });
  } catch (error) {
    console.error("Get admin subscriptions error:", error);
    return res.status(500).json({ success: false, message: "Server error fetching subscriptions" });
  }
};

export const updateSubscription = async (req, res) => {
  const { tenantId } = req.params;
  const { action, extendDays, planId, billingType } = req.body;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    let updatedData = {};
    let notificationNote = "";

    switch (action) {
      case 'pause':
        updatedData = { 
          subscriptionStatus: 'paused',
          planStatus: 'inactive'
        };
        notificationNote = "Your account is paused. Please reach out to customer support to reactivate.";
        break;

      case 'reactivate':
        updatedData = { 
          subscriptionStatus: 'active',
          planStatus: 'active',
          reactivatedAt: new Date()
        };
        notificationNote = "Your account is now active again. Enjoy full access!";
        break;

      case 'expire':
        updatedData = { 
          subscriptionStatus: 'expired',
          planStatus: 'expired',
          dataDeletionDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        };
        notificationNote = "Your subscription has been terminated and set to expired. Your configuration data is retained for 90 days.";
        break;

      case 'extend':
        if (!extendDays || isNaN(extendDays)) {
          return res.status(400).json({ success: false, message: "extendDays must be a valid integer" });
        }
        const currentEnd = tenant.planPeriodEnd ? new Date(tenant.planPeriodEnd) : new Date();
        const newEnd = new Date(currentEnd.getTime() + extendDays * 24 * 60 * 60 * 1000);
        updatedData = { 
          planPeriodEnd: newEnd,
          subscriptionStatus: 'active',
          planStatus: 'active'
        };
        notificationNote = `Your plan active period has been extended by ${extendDays} days. It is now active until ${newEnd.toLocaleDateString()}.`;
        break;

      case 'change_plan':
        if (!planId) {
          return res.status(400).json({ success: false, message: "planId is required to change plan" });
        }
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan) {
          return res.status(404).json({ success: false, message: "Plan not found" });
        }
        const durationDays = extendDays && !isNaN(extendDays) ? parseInt(extendDays) : 30;
        const periodEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        updatedData = {
          planId: plan.id,
          currentPlan: plan.name,
          planStatus: 'active',
          subscriptionStatus: 'active',
          billingType: billingType || tenant.billingType || 'monthly',
          planActivatedAt: new Date(),
          planPeriodStart: new Date(),
          planPeriodEnd: periodEnd,
        };
        notificationNote = `Your plan has been updated to ${plan.name}, active until ${periodEnd.toLocaleDateString()}.`;
        break;

      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: updatedData
    });

    sendStatusUpdateEmail(tenant.email, tenant.tenantName || tenant.email, updated.subscriptionStatus, notificationNote);

    return res.status(200).json({ success: true, message: "Action completed", data: updated });
  } catch (error) {
    console.error("Admin update subscription error:", error);
    return res.status(500).json({ success: false, message: "Server error updating subscription" });
  }
};