import prisma from '../config/prisma.js';

export const initQuickReplyIndexes = async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "QuickReply_tenant_shortcut_global_unique" 
        ON "QuickReply" ("tenantId", "shortcut") 
        WHERE "scope" = 'GLOBAL';
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "QuickReply_tenant_shortcut_personal_unique" 
        ON "QuickReply" ("tenantId", "shortcut", "userId") 
        WHERE "scope" = 'PERSONAL';
    `);

    console.log('✅ QuickReply partial unique indexes verified.');
  } catch (err) {
    console.error('⚠️ Warning: Failed to ensure QuickReply partial indexes:', err.message);
  }
};
