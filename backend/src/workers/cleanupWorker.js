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
        prisma.refreshToken.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Tag mappings ──
        prisma.userTagMapping.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Users ──
        prisma.user.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Contacts ──
        prisma.contact.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Templates ──
        prisma.template.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Broadcasts ──
        prisma.broadcast.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Tags (must come after mappings) ──
        prisma.tag.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Tickets ──
        prisma.ticket.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Flows ──
        prisma.keywordTrigger.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.flow.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Enterprise leads ──
        prisma.enterpriseLead.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Subscription related ──
        prisma.subscriptionReminder.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.cancellationSurvey.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),
        prisma.tenantDataDeletion.deleteMany({ 
          where: { tenantId: { in: tenantIds } } 
        }),

        // ── Audit logs → unlink but preserve ──
        prisma.auditLog.updateMany({
          where: { tenantId: { in: tenantIds } },
          data:  { tenantId: null }
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