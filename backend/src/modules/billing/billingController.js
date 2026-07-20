import prisma from '../../config/prisma.js';
import { generateInvoicePDFFromModel } from '../plans/invoiceService.js';
import {
  sendCancellationConfirmedEmail,
  sendCancellationAdminAlertEmail,
  sendReactivationConfirmedEmail
} from '../auth/emailService.js';

export const cancelSubscription = async (req, res) => {
  const { reason, additionalComment } = req.body;

  if (!reason) {
    return res.status(400).json({ success: false, message: "Reason is required" });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    if (tenant.subscriptionStatus !== 'active') {
      return res.status(400).json({
        success: false,
        message: "No active subscription to cancel"
      });
    }

    // Calculate dynamic period end if missing
    let periodEnd = tenant.planPeriodEnd;
    if (!periodEnd && tenant.planActivatedAt) {
      const activatedAt = new Date(tenant.planActivatedAt);
      periodEnd = new Date(activatedAt);
      if (tenant.billingType === 'annual') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
    }
    if (!periodEnd) {
      // Fallback to 30 days from now if activation date is missing
      periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const updatedTenant = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionStatus: 'cancel_at_period_end',
          cancelRequestedAt: new Date(),
          planPeriodEnd: periodEnd,
          cancellationReason: reason
        }
      });

      await tx.cancellationSurvey.upsert({
        where: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          reason: reason,
          additionalComment: additionalComment || null
        },
        update: {
          reason: reason,
          additionalComment: additionalComment || null,
          createdAt: new Date()
        }
      });

      return updated;
    });

    // Send emails asynchronously
    const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';
    const reactivateLink = `${frontendUrl}/settings/billing`;
    const periodEndStr = updatedTenant.planPeriodEnd ? new Date(updatedTenant.planPeriodEnd).toLocaleDateString() : 'N/A';
    const deletionDate = updatedTenant.planPeriodEnd ? new Date(new Date(updatedTenant.planPeriodEnd).getTime() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString() : 'N/A';

    sendCancellationConfirmedEmail(tenant.email, {
      tenantName: tenant.tenantName || tenant.email,
      planName: tenant.currentPlan || (tenant.plan ? tenant.plan.name : "Pro"),
      periodEndDate: periodEndStr,
      dataDeletionDate: deletionDate,
      reactivateLink
    });

    sendCancellationAdminAlertEmail(process.env.ADMIN_EMAIL || 'admin@sudoreply.com', {
      companyName: tenant.tenantName || 'Tenant Company',
      email: tenant.email,
      planName: tenant.currentPlan || (tenant.plan ? tenant.plan.name : "Pro"),
      reason: reason,
      comment: additionalComment || "No comment",
      periodEndDate: periodEndStr
    });

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled",
      periodEndDate: updatedTenant.planPeriodEnd
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return res.status(500).json({ success: false, message: "Server error during cancellation" });
  }
};

export const reactivateSubscription = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    if (tenant.subscriptionStatus !== 'cancel_at_period_end') {
      return res.status(400).json({
        success: false,
        message: "Subscription is not scheduled for cancellation"
      });
    }

    const updatedTenant = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionStatus: 'active',
          cancelRequestedAt: null,
          cancellationReason: null,
          reactivatedAt: new Date()
        }
      });

      await tx.cancellationSurvey.delete({
        where: { tenantId: tenant.id }
      });

      return updated;
    });

    // Send reactivation confirmation email
    const nextBillingDateStr = updatedTenant.planPeriodEnd ? new Date(updatedTenant.planPeriodEnd).toLocaleDateString() : 'N/A';
    const frontendUrl = process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174';
    const dashboardLink = `${frontendUrl}/dashboard`;

    sendReactivationConfirmedEmail(tenant.email, {
      tenantName: tenant.tenantName || tenant.email,
      planName: tenant.currentPlan || "Pro",
      nextBillingDate: nextBillingDateStr,
      dashboardLink
    });

    return res.status(200).json({ success: true, message: "Reactivated" });
  } catch (error) {
    console.error("Reactivate subscription error:", error);
    return res.status(500).json({ success: false, message: "Server error during reactivation" });
  }
};

export const getBillingOverview = async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        subscriptionStatus: true,
        currentPlan: true,
        plan: {
          select: { name: true }
        },
        planPeriodStart: true,
        planPeriodEnd: true,
        cancelRequestedAt: true,
        dataDeletionDate: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            invoiceNumber: true,
            planName: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: "Tenant not found" });
    }

    let status = tenant.subscriptionStatus;
    let dataDeletionDate = tenant.dataDeletionDate;

    // Self-healing: if cancelled plan has reached its period end, expire it immediately
    if (status === 'cancel_at_period_end' && tenant.planPeriodEnd && new Date(tenant.planPeriodEnd) < new Date()) {
      const computedDeletionDate = new Date();
      computedDeletionDate.setDate(computedDeletionDate.getDate() + 90);

      await prisma.tenant.update({
        where: { id: req.tenantId },
        data: {
          subscriptionStatus: 'expired',
          planStatus: 'inactive',
          dataDeletionDate: computedDeletionDate
        }
      });
      status = 'expired';
      dataDeletionDate = computedDeletionDate;
    }

    const formattedTenant = {
      subscriptionStatus: status,
      currentPlan: tenant.currentPlan || (tenant.plan ? tenant.plan.name : "Starter"),
      planPeriodStart: tenant.planPeriodStart,
      planPeriodEnd: tenant.planPeriodEnd,
      cancelRequestedAt: tenant.cancelRequestedAt,
      dataDeletionDate: dataDeletionDate,
      invoices: tenant.invoices
    };

    return res.status(200).json({ success: true, data: formattedTenant });
  } catch (error) {
    console.error("Get billing overview error:", error);
    return res.status(500).json({ success: false, message: "Server error fetching billing details" });
  }
};

export const getInvoices = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where: { tenantId: req.tenantId },
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: limit,
        select: {
          id: true,
          invoiceNumber: true,
          planName: true,
          amount: true,
          currency: true,
          status: true,
          billingPeriodStart: true,
          billingPeriodEnd: true,
          paymentMethodLast4: true,
          paymentMethodBrand: true,
          createdAt: true
        }
      }),
      prisma.invoice.count({
        where: { tenantId: req.tenantId }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: {
        invoices,
        total,
        page,
        totalPages
      }
    });
  } catch (error) {
    console.error("Get invoices list error:", error);
    return res.status(500).json({ success: false, message: "Server error fetching invoices list" });
  }
};

export const downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { tenant: true }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    if (invoice.tenantId !== req.tenantId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const result = await generateInvoicePDFFromModel(invoice, invoice.tenant);
    res.download(result.filePath, `Invoice-${invoice.invoiceNumber}.pdf`);
  } catch (error) {
    console.error("Download invoice PDF error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Server error generating PDF invoice" });
    }
  }
};