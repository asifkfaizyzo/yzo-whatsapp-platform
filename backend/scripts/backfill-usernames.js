// backend/scripts/backfill-usernames.js (do not remove this comment)
/**
 * One-time backfill: generates unique usernames for all existing
 * Tenant, User, and SuperAdmin records where username IS NULL.
 *
 * Usage:
 *   node scripts/backfill-usernames.js            # live run
 *   node scripts/backfill-usernames.js --dry-run   # preview only
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

function deriveBase(email) {
  if (!email) return `user_${Date.now()}`;
  const raw = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
  return raw.length >= 4 ? raw : raw + String(Math.floor(Math.random() * 900 + 100));
}

async function isTaken(username) {
  const [tenant, user, admin] = await Promise.all([
    prisma.tenant.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { username } }),
    prisma.superAdmin.findUnique({ where: { username } }),
  ]);
  return !!(tenant || user || admin);
}

async function findAvailableUsername(email) {
  const base = deriveBase(email);
  let candidate = base;
  let counter = 1;

  while (await isTaken(candidate)) {
    candidate = `${base}_${counter}`;
    counter++;
    if (counter > 999) {
      candidate = `${base}_${Date.now()}`;
      break;
    }
  }

  return candidate;
}

async function backfillModel(modelName, prismaKey) {
  const model = prisma[prismaKey];
  const records = await model.findMany({
    where: { username: null },
    select: { id: true, email: true },
  });

  if (records.length === 0) {
    console.log(`  ✅ ${modelName}: No records need backfill.`);
    return 0;
  }

  console.log(`  🔄 ${modelName}: ${records.length} record(s) to backfill...`);
  let updated = 0;

  for (const record of records) {
    const username = await findAvailableUsername(record.email);

    if (DRY_RUN) {
      console.log(`     [DRY] ${record.email || record.id} → @${username}`);
    } else {
      await model.update({
        where: { id: record.id },
        data: { username },
      });
      console.log(`     ✅ ${record.email || record.id} → @${username}`);
    }
    updated++;
  }

  return updated;
}

async function main() {
  console.log(`\n🚀 Username Backfill ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"}\n`);

  const counts = {
    Tenant: await backfillModel("Tenant", "tenant"),
    User: await backfillModel("User", "user"),
    SuperAdmin: await backfillModel("SuperAdmin", "superAdmin"),
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\n📊 Total: ${total} record(s) ${DRY_RUN ? "would be" : "were"} updated.`);
  console.log("   Tenant:", counts.Tenant);
  console.log("   User:", counts.User);
  console.log("   SuperAdmin:", counts.SuperAdmin);

  if (DRY_RUN && total > 0) {
    console.log("\n⚠️  Re-run without --dry-run to apply changes.");
  }
}

main()
  .catch((err) => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());