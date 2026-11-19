// backend/src/utils/tenantDeletion.js (do not remove this comment)
import fs from "fs/promises";
import path from "path";
import prisma from "../config/prisma.js";

/**
 * Removes all physical media directories belonging to a tenant from disk.
 * Safe and non-throwing if directories do not exist.
 */
export const removeTenantMediaDirectories = async (tenantId) => {
  if (!tenantId) return;
  const dirs = [
    path.resolve("uploads", "tenants", tenantId),
    path.resolve("uploads", "calls", tenantId),
  ];

  for (const dir of dirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (err) {
      console.warn(
        `[TenantDeletion] Warning removing directory ${dir}: ${err.message}`,
      );
    }
  }
};

/**
 * Purges a list of tenants' operational workspace data (messages, conversations,
 * contacts, broadcasts, campaigns, flows, templates, quick replies, e-commerce
 * orders/products/customers, call logs, AI docs, media assets, usage rows) and
 * deletes their physical media directories from disk, while keeping the Tenant
 * account shell, billing history (Invoices/Payments), and TenantDataDeletion audit log.
 *
 * Used by data-deletion.job.js when an expired tenant reaches dataDeletionDate.
 */
export const purgeTenantWorkspaceData = async (
  tenantIds,
  { deletedBy = "system", note = "Automatic retention purge" } = {},
) => {
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) return { purged: 0 };

  await prisma.$transaction(async (tx) => {
    // 1. Calling & Campaign child records
    await tx.callStatusHistory.deleteMany({
      where: { callLog: { tenantId: { in: tenantIds } } },
    });
    await tx.callLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.campaignVariant.deleteMany({
      where: { campaignExperiment: { tenantId: { in: tenantIds } } },
    });
    await tx.campaignExperiment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 2. Broadcasts, Messages & Conversations
    await tx.broadcastLog.deleteMany({
      where: { broadcast: { tenantId: { in: tenantIds } } },
    });
    await tx.broadcast.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.message.deleteMany({
      where: { conversation: { tenantId: { in: tenantIds } } },
    });
    await tx.conversation.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 3. Contacts, Segments, Lists, Tags, Custom Attributes & Zoho mappings
    await tx.contactListMember.deleteMany({
      where: { contactList: { tenantId: { in: tenantIds } } },
    });
    await tx.contactList.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.audienceSegment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.contactTag.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactActivity.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactNote.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactSheetValue.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.zohoSyncTask.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.zohoLeadMapping.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 4. E-Commerce (Orders, Transactions, Products, Customers)
    await tx.orderItem.deleteMany({
      where: { order: { tenantId: { in: tenantIds } } },
    });
    await tx.paymentTransaction.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.order.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.product.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.customer.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 5. Contacts, Tags & SheetFields
    await tx.contact.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tag.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.sheetField.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 6. Automation Flows, Templates, Quick Replies, AI & Labels
    await tx.flowSession.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flowEdge.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flowNode.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flow.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.template.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.quickReply.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.knowledgeDocument.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.aiConfiguration.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.chatLabel.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 7. MediaAssets & Usage Metering
    await tx.mediaAsset.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantUsage.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 8. Clear dataDeletionDate so the tenant is not repeatedly purged, and record audit log
    await tx.tenantSubscription.updateMany({
      where: { tenantId: { in: tenantIds } },
      data: { dataDeletionDate: null },
    });

    await tx.tenantDataDeletion.createMany({
      data: tenantIds.map((tenantId) => ({
        tenantId,
        deletedBy,
        note,
      })),
    });
  });

  // 9. Remove physical files from disk outside the DB transaction
  for (const tenantId of tenantIds) {
    await removeTenantMediaDirectories(tenantId);
  }

  return { purged: tenantIds.length };
};

/**
 * Completely and permanently deletes tenant accounts and all dependent records
 * (used for abandoned unverified/rejected accounts).
 */
export const deleteTenantsCompletely = async (tenantIds) => {
  if (!Array.isArray(tenantIds) || tenantIds.length === 0) return { deleted: 0 };

  await prisma.$transaction(async (tx) => {
    // 1. Operational workspace data
    await tx.callStatusHistory.deleteMany({
      where: { callLog: { tenantId: { in: tenantIds } } },
    });
    await tx.callLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.campaignVariant.deleteMany({
      where: { campaignExperiment: { tenantId: { in: tenantIds } } },
    });
    await tx.campaignExperiment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.broadcastLog.deleteMany({
      where: { broadcast: { tenantId: { in: tenantIds } } },
    });
    await tx.broadcast.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.message.deleteMany({
      where: { conversation: { tenantId: { in: tenantIds } } },
    });
    await tx.conversation.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.contactListMember.deleteMany({
      where: { contactList: { tenantId: { in: tenantIds } } },
    });
    await tx.contactList.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.audienceSegment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.contactTag.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactActivity.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactNote.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.contactSheetValue.deleteMany({
      where: { contact: { tenantId: { in: tenantIds } } },
    });
    await tx.zohoSyncTask.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.zohoLeadMapping.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.orderItem.deleteMany({
      where: { order: { tenantId: { in: tenantIds } } },
    });
    await tx.paymentTransaction.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.order.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.product.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.customer.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.contact.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tag.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.sheetField.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.flowSession.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flowEdge.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flowNode.deleteMany({
      where: { flow: { tenantId: { in: tenantIds } } },
    });
    await tx.flow.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.template.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.quickReply.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.knowledgeDocument.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.aiConfiguration.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.chatLabel.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.mediaAsset.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 2. Users, Roles, Invites & Logs
    await tx.userSession.deleteMany({
      where: { user: { tenantId: { in: tenantIds } } },
    });
    await tx.userInvite.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.user.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.customRole.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.webhookLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.auditLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 3. Billing, Subscriptions, Add-Ons, Usage & Reminders
    await tx.subscriptionReminder.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.cancellationSurvey.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantDataDeletion.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.invoice.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.payment.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantAddOn.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantCreditPool.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantUsage.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantSubscription.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });

    // 4. Tenant Satellite Tables & Tenant Root
    await tx.enterpriseLead.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantWhatsApp.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantCatalog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantMetaAds.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantShopify.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantWooCommerce.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantZoho.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantSocial.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantWebhook.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenantSettings.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await tx.tenant.deleteMany({
      where: { id: { in: tenantIds } },
    });
  });

  for (const tenantId of tenantIds) {
    await removeTenantMediaDirectories(tenantId);
  }

  return { deleted: tenantIds.length };
};
