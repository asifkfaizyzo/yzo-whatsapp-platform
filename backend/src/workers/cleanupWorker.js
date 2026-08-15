// src/workers/cleanupWorker.js

import prisma from '../config/prisma.js';

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const ABANDONMENT_THRESHOLD_HOURS = 24;

export const startCleanupWorker = () => {
  const cleanAbandonedAccounts = async () => {
    try {
      console.log('🧹 Running abandoned accounts cleanup worker...');

      const cutoffDate = new Date(
        Date.now() - ABANDONMENT_THRESHOLD_HOURS * 60 * 60 * 1000
      );

      // ═══════════════════════════════════════════
      // 1️⃣ Find TRULY abandoned tenants
      //    ✅ Onboarding not completed
      //    ✅ Older than 24 hours
      //    ✅ ZERO payments (SAFETY)
      //    ✅ ZERO invoices (SAFETY)
      // ═══════════════════════════════════════════
      const abandonedTenants = await prisma.tenant.findMany({
        where: {
          onboardingCompleted: false,
          createdAt: { lt: cutoffDate },

          // 🛡️ Safety filters — protect paying customers
          payments: { none: {} },
          invoices: { none: {} },
        },
        select: {
          id:         true,
          email:      true,
          tenantName: true,
          createdAt:  true,
        }
      });

      if (abandonedTenants.length === 0) {
        console.log('✅ No abandoned onboarding accounts to delete.');
        return;
      }

      const tenantIds = abandonedTenants.map(t => t.id);

      console.log(
        `🧹 Found ${tenantIds.length} truly abandoned accounts. ` +
        `Deleting dependent records...`
      );

      // ═══════════════════════════════════════════
      // 2️⃣ Delete in correct order to satisfy 
      //    foreign key constraints
      //    (matches YOUR schema exactly)
      // ═══════════════════════════════════════════
      await prisma.$transaction([
        // ── Auth ──
        prisma.userTagMapping.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.refreshToken.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Conversations & Messages ──
        prisma.message.deleteMany({ 
          where: { 
            OR: [
              { conversation: { tenantId: { in: tenantIds } } },
              { conversation: { contact: { tenantId: { in: tenantIds } } } },
            ]
          } 
        }),
        prisma.conversationActivity.deleteMany({ 
          where: { 
            OR: [
              { conversation: { tenantId: { in: tenantIds } } },
              { conversation: { contact: { tenantId: { in: tenantIds } } } },
            ]
          } 
        }),
        prisma.conversation.deleteMany({ 
          where: { 
            OR: [
              { tenantId: { in: tenantIds } },
              { contact: { tenantId: { in: tenantIds } } },
            ]
          } 
        }),

        // ── Broadcasts & Recipients ──
        prisma.broadcastRecipient.deleteMany({ 
          where: { 
            OR: [
              { broadcast: { tenantId: { in: tenantIds } } },
              { contact: { tenantId: { in: tenantIds } } },
            ]
          } 
        }),
        prisma.broadcastTag.deleteMany({ 
          where: { 
            OR: [
              { broadcast: { tenantId: { in: tenantIds } } },
              { tag: { tenantId: { in: tenantIds } } },
            ]
          } 
        }),
        prisma.broadcast.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Templates ──
        prisma.template.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Contacts & Tags ──
        prisma.contactTagMapping.deleteMany({ 
          where: { OR: [{ contact: { tenantId: { in: tenantIds } } }, { tag: { tenantId: { in: tenantIds } } }] } 
        }),
        prisma.contact.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.tag.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Chat Automation & Flows ──
        prisma.flowNode.deleteMany({ 
          where: { flow: { tenantId: { in: tenantIds } } } 
        }),
        prisma.keywordTrigger.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.flow.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.autoReopenConfig.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Support Tickets ──
        prisma.ticketMessage.deleteMany({ 
          where: { OR: [{ ticket: { tenantId: { in: tenantIds } } }, { tenantId: { in: tenantIds } }] } 
        }),
        prisma.ticket.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Notifications ──
        prisma.notification.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Enterprise leads ──
        prisma.enterpriseLead.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Subscription, Invoices & Payments ──
        prisma.subscriptionReminder.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.cancellationSurvey.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.tenantDataDeletion.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.invoice.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.payment.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Audit logs → unlink but preserve ──
        prisma.auditLog.updateMany({
          where: { tenantId: { in: tenantIds } },
          data:  { tenantId: null }
        }),

        // ── Users ──
        prisma.user.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Finally delete tenants ──
        prisma.tenant.deleteMany({ 
          where: { id: { in: tenantIds } } 
        })
      ]);

      // ═══════════════════════════════════════════
      // 3️⃣ Log what was deleted
      // ═══════════════════════════════════════════
      console.log(
        `🗑️ Successfully deleted ${tenantIds.length} abandoned accounts:`
      );
      abandonedTenants.forEach(t => {
        const email  = t.email || 'no-email';
        const name   = t.tenantName || 'no-name';
        console.log(`   ├─ ${email} (${name}) — ${t.id}`);
      });

    } catch (error) {
      console.error('❌ Failed to clean abandoned accounts:');
      console.error('   Error:', error.message);
    }
  };

  // Run every 24 hours
  setInterval(cleanAbandonedAccounts, CLEANUP_INTERVAL);

  // Run once after startup (5 seconds delay)
  setTimeout(cleanAbandonedAccounts, 5000);
};