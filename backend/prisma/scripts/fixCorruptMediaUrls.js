// backend/prisma/migrations/scripts/fixCorruptMediaUrls.js

import prisma from '../../src/config/prisma.js';
import fs from 'fs';
import path from 'path';

const fixMediaUrls = async () => {
  console.log('🔧 Starting mediaUrl cleanup migration...\n');

  const messages = await prisma.message.findMany({
    where: {
      mediaUrl:  { not: null },
      isDeleted: false,
    },
    select: {
      id:        true,
      mediaUrl:  true,
      mediaName: true,
    },
  });

  console.log(`📊 Total messages with mediaUrl: ${messages.length}\n`);

  let stats = {
    total:        messages.length,
    fixed:        0,
    alreadyValid: 0,
    fileNotFound: 0,
    invalid:      0,
    errors:       0,
  };

  const brokenIds = [];

  for (const msg of messages) {
    try {
      let originalUrl = msg.mediaUrl;
      let cleanPath   = originalUrl;

      // 1. Convert full URL to relative
      if (cleanPath.startsWith('http')) {
        try {
          const url = new URL(cleanPath);
          cleanPath = url.pathname.substring(1);
        } catch (err) {
          console.error(`❌ Invalid URL: ${cleanPath}`);
          stats.invalid++;
          brokenIds.push(msg.id);
          continue;
        }
      }

      // 2. Remove "undefined/" prefix
      if (cleanPath.includes('undefined/')) {
        cleanPath = cleanPath.replace('undefined/', '');
      }

      // 3. Remove leading slash
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }

      // 4. Check valid format
      if (!cleanPath.startsWith('uploads/')) {
        console.warn(`⚠️ Invalid format: ${originalUrl}`);
        stats.invalid++;
        brokenIds.push(msg.id);
        continue;
      }

      // 5. Check file exists on disk
      const absolutePath = path.join(process.cwd(), cleanPath);
      if (!fs.existsSync(absolutePath)) {
        console.warn(`📁 File missing: ${cleanPath}`);
        stats.fileNotFound++;
        brokenIds.push(msg.id);
        continue;
      }

      // 6. Update if changed
      if (cleanPath !== originalUrl) {
        await prisma.message.update({
          where: { id: msg.id },
          data:  { mediaUrl: cleanPath },
        });
        stats.fixed++;
        console.log(`✅ Fixed: ${originalUrl}`);
        console.log(`   → ${cleanPath}\n`);
      } else {
        stats.alreadyValid++;
      }

    } catch (err) {
      console.error(`❌ Error processing ${msg.id}:`, err.message);
      stats.errors++;
    }
  }

  // Print summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total processed: ${stats.total}`);
  console.log(`✅ Fixed:        ${stats.fixed}`);
  console.log(`✓  Already OK:   ${stats.alreadyValid}`);
  console.log(`⚠️  Invalid:      ${stats.invalid}`);
  console.log(`📁 Missing file: ${stats.fileNotFound}`);
  console.log(`❌ Errors:       ${stats.errors}`);
  console.log('═══════════════════════════════════════\n');

  // Clean up broken records
  if (brokenIds.length > 0) {
    console.log(`🔄 Clearing ${brokenIds.length} broken records...`);
    await prisma.message.updateMany({
      where: { id: { in: brokenIds } },
      data: {
        mediaUrl:      null,
        mediaName:     null,
        mediaSize:     null,
        mediaMimeType: null,
        text:          '[Media unavailable]',
      },
    });
    console.log(`✅ Cleared ${brokenIds.length} broken records\n`);
  }

  await prisma.$disconnect();
  console.log('✨ Migration complete!');
};

fixMediaUrls().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});