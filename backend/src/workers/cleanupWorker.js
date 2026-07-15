import prisma from '../config/prisma.js';

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export const startCleanupWorker = () => {
    const cleanAbandonedAccounts = async () => {
        try {
            console.log('🧹 Running abandoned accounts cleanup worker...');
            const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            
            // 1️⃣ Find all tenant IDs matching the criteria
            const abandonedTenants = await prisma.tenant.findMany({
                where: {
                    onboardingCompleted: false,
                    createdAt: { lt: cutoffDate }
                },
                select: { id: true }
            });

            const tenantIds = abandonedTenants.map(t => t.id);

            if (tenantIds.length === 0) {
                console.log('🧹 No abandoned onboarding accounts to delete.');
                return;
            }

            console.log(`🧹 Found ${tenantIds.length} abandoned onboarding accounts. Deleting dependent records...`);

            // 2️⃣ Delete all dependent records in a transaction to satisfy foreign key constraints
            await prisma.$transaction([
                prisma.refreshToken.deleteMany({ where: { tenantId: { in: tenantIds } } }),
                prisma.userTagMapping.deleteMany({ where: { tenantId: { in: tenantIds } } }),
                prisma.tag.deleteMany({ where: { tenantId: { in: tenantIds } } }),
                prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } }),
                prisma.contact.deleteMany({ where: { tenantId: { in: tenantIds } } }),
                prisma.template.deleteMany({ where: { tenantId: { in: tenantIds } } }),
                prisma.broadcast.deleteMany({ where: { tenantId: { in: tenantIds } } }),
                prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })
            ]);
            
            console.log(`🗑️ Successfully deleted ${tenantIds.length} abandoned onboarding accounts and their dependents.`);
        } catch (error) {
            console.error('❌ Failed to clean abandoned accounts:', error.message);
        }
    };

    // Run every 24 hours
    setInterval(cleanAbandonedAccounts, CLEANUP_INTERVAL);
    
    // Also run once shortly after startup (after 5 seconds)
    setTimeout(cleanAbandonedAccounts, 5000);
};
