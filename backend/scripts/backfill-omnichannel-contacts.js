// backend/scripts/backfill-omnichannel-contacts.js

import prisma from '../src/config/prisma.js';

async function backfill() {
  console.log('🔄 Starting backfill of existing WhatsApp contacts...');

  try {
    // 1. Backfill Contact records
    const contactsUpdated = await prisma.$executeRawUnsafe(`
      UPDATE "Contact"
      SET "channelId" = "phone", "channel" = 'WHATSAPP'
      WHERE "channelId" IS NULL AND "phone" IS NOT NULL;
    `);

    console.log(`✅ Backfilled ${contactsUpdated} contacts with channel='WHATSAPP' and channelId=phone.`);

    // 2. Backfill Conversation records
    const conversationsUpdated = await prisma.$executeRawUnsafe(`
      UPDATE "Conversation"
      SET "channel" = 'WHATSAPP'
      WHERE "channel" IS NULL;
    `);

    console.log(`✅ Backfilled ${conversationsUpdated} conversations with channel='WHATSAPP'.`);
  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

backfill();
