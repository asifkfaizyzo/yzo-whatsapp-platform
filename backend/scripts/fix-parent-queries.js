// backend/scripts/fix-parent-queries.js
// Auto-fixes Section 3 parent query regressions from Phase B scan.
// Adds missing include relations and Object.assign spreads to prisma.tenant.find* calls.
//
// Usage:
//   node scripts/fix-parent-queries.js            # apply fixes
//   node scripts/fix-parent-queries.js --dry-run   # preview only

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Fix definitions from Section 3 scan ───────────────────────────────
// addInclude: relations to ADD to the query's include block (empty = spread-only fix)
// findUnique/findFirst: also adds Object.assign spread after query
// findMany: only adds include (spread must be inside the iteration loop)

const FIXES = [
  // ── cron/jobs ──
  { file: 'src/cron/jobs/expired-subscriptions.job.js', line: 69, addInclude: [] },
  { file: 'src/cron/jobs/expiry-reminders.job.js', line: 12, addInclude: [] },

  // ── cron/workers ──
  { file: 'src/cron/workers/webhook.worker.js', line: 157, addInclude: ['whatsapp'] },
  { file: 'src/cron/workers/webhook.worker.js', line: 637, addInclude: ['subscription', 'social'] },
  { file: 'src/cron/workers/webhook.worker.js', line: 644, addInclude: ['subscription', 'social'] },
  { file: 'src/cron/workers/webhook.worker.js', line: 652, addInclude: ['subscription', 'social'] },
  { file: 'src/cron/workers/webhook.worker.js', line: 730, addInclude: ['social'] },
  { file: 'src/cron/workers/webhook.worker.js', line: 756, addInclude: ['subscription', 'social', 'whatsapp'] },

  // ── lib ──
  { file: 'src/lib/plan.limits.js', line: 9, addInclude: [] },
  { file: 'src/lib/plan.limits.js', line: 99, addInclude: [] },

  // ── middlewares ──
  { file: 'src/middlewares/auth.tenant.js', line: 34, addInclude: [] },
  { file: 'src/middlewares/auth.tenant.js', line: 162, addInclude: [] },
  { file: 'src/middlewares/subscription.access.js', line: 30, addInclude: [] },

  // ── admin-subscriptions ──
  { file: 'src/modules/admin-subscriptions/adminSubscription.controller.js', line: 65, addInclude: [] },
  { file: 'src/modules/admin-subscriptions/adminSubscription.controller.js', line: 143, addInclude: ['subscription'] },
  { file: 'src/modules/admin-subscriptions/adminSubscription.controller.js', line: 347, addInclude: ['subscription'] },

  // ── automation ──
  { file: 'src/modules/automation/flowEngine.service.js', line: 450, addInclude: ['whatsapp'] },
  { file: 'src/modules/automation/flowEngine.service.js', line: 530, addInclude: ['whatsapp'] },
  { file: 'src/modules/automation/flowEngine.service.js', line: 2583, addInclude: ['whatsapp'] },
  { file: 'src/modules/automation/flowEngine.service.js', line: 2748, addInclude: ['whatsapp'] },
  { file: 'src/modules/automation/flowEngine.service.js', line: 2793, addInclude: ['whatsapp'] },
  { file: 'src/modules/automation/flowEngine.service.js', line: 3312, addInclude: ['whatsapp'] },
  { file: 'src/modules/automation/flowEngine.service.js', line: 3487, addInclude: ['whatsapp'] },
  { file: 'src/modules/automation/flowEngine.service.js', line: 3527, addInclude: ['whatsapp'] },

  // ── billing ──
  { file: 'src/modules/billing/billing.controller.js', line: 24, addInclude: ['subscription'] },
  { file: 'src/modules/billing/billing.controller.js', line: 187, addInclude: ['subscription'] },
  { file: 'src/modules/billing/billing.controller.js', line: 282, addInclude: ['subscription'] },
  { file: 'src/modules/billing/billing.controller.js', line: 400, addInclude: ['subscription'] },
  { file: 'src/modules/billing/billing.controller.js', line: 604, addInclude: ['subscription'] },

  // ── messages ──
  { file: 'src/modules/messages/message.service.js', line: 570, addInclude: ['social', 'whatsapp'] },
  { file: 'src/modules/messages/message.service.js', line: 775, addInclude: ['social', 'whatsapp'] },
  { file: 'src/modules/messages/message.service.js', line: 1118, addInclude: ['social', 'whatsapp'] },
  { file: 'src/modules/messages/message.service.js', line: 1309, addInclude: ['social', 'whatsapp'] },

  // ── plans ──
  { file: 'src/modules/plans/plan.controller.js', line: 322, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 524, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 562, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 772, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 916, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 956, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 983, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 1108, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 1247, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 1321, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 1507, addInclude: ['subscription'] },
  { file: 'src/modules/plans/plan.controller.js', line: 1528, addInclude: ['subscription'] },

  // ── shopify ──
  { file: 'src/modules/shopify/orders/shopify.cartRecovery.service.js', line: 693, addInclude: ['whatsapp'] },

  // ── superadmin ──
  { file: 'src/modules/superadmin/reports.service.js', line: 438, addInclude: ['subscription', 'whatsapp'] },
  { file: 'src/modules/superadmin/reports.service.js', line: 510, addInclude: ['subscription', 'whatsapp'] },
  { file: 'src/modules/superadmin/reports.service.js', line: 611, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 22, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 322, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 347, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 367, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 454, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 501, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 538, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 674, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 713, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 761, addInclude: ['subscription'] },
  { file: 'src/modules/superadmin/superadmin.service.js', line: 956, addInclude: ['subscription'] },

  // ── tenant/auth ──
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 35, addInclude: ['subscription', 'auth'] },
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 142, addInclude: ['subscription', 'auth'] },
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 294, addInclude: ['subscription', 'auth'] },
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 350, addInclude: ['subscription', 'auth'] },
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 354, addInclude: ['subscription', 'auth'] },
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 396, addInclude: ['subscription'] },
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 430, addInclude: ['subscription', 'auth'] },
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 434, addInclude: ['subscription', 'auth'] },
  { file: 'src/modules/tenant/auth/tenant.auth.service.js', line: 476, addInclude: ['subscription'] },

  // ── tenant/integrations ──
  { file: 'src/modules/tenant/integrations/tenant.integrations.controller.js', line: 189, addInclude: ['whatsapp', 'social'] },
  { file: 'src/modules/tenant/integrations/tenant.integrations.controller.js', line: 304, addInclude: ['whatsapp', 'social'] },

  // ── webhook ──
  { file: 'src/modules/webhook/order.webhook.controller.js', line: 40, addInclude: ['whatsapp'] },
  { file: 'src/modules/webhook/order.webhook.controller.js', line: 157, addInclude: ['whatsapp'] },
  { file: 'src/modules/webhook/order.webhook.controller.js', line: 204, addInclude: ['whatsapp'] },

  // ── whatsapp ──
  { file: 'src/modules/whatsapp/call.controller.js', line: 747, addInclude: ['whatsapp'] },
  { file: 'src/modules/whatsapp/whatsapp.controller.js', line: 257, addInclude: [] },
  { file: 'src/modules/whatsapp/whatsapp.controller.js', line: 336, addInclude: ['whatsapp'] },
  { file: 'src/modules/whatsapp/whatsapp.controller.js', line: 352, addInclude: ['whatsapp'] },
  { file: 'src/modules/whatsapp/whatsapp.controller.js', line: 410, addInclude: [] },
  { file: 'src/modules/whatsapp/whatsapp.controller.js', line: 538, addInclude: ['whatsapp'] },
  { file: 'src/modules/whatsapp/whatsapp.controller.js', line: 554, addInclude: ['whatsapp'] },
];

// ─── Group by file ─────────────────────────────────────────────────────
const byFile = {};
for (const fix of FIXES) {
  (byFile[fix.file] ??= []).push(fix);
}

// ─── Stats & log ───────────────────────────────────────────────────────
const stats = { applied: 0, skipped: 0, errors: 0 };
const log = [];

// ─── Core: apply a single fix to a lines array ────────────────────────
function applyFix(lines, fix) {
  const targetIdx = fix.line - 1; // 0-indexed

  // 1. Find prisma.tenant.find* near target line (±5 lines tolerance)
  let qLine = -1;
  for (let i = Math.max(0, targetIdx - 5); i <= Math.min(lines.length - 1, targetIdx + 5); i++) {
    if (/prisma\.tenant\.find(Unique|First|Many)\s*\(/.test(lines[i])) {
      qLine = i;
      break;
    }
  }
  if (qLine === -1) return { applied: false, reason: 'query not found near line' };

  const isFindMany = /findMany/.test(lines[qLine]);

  // 2. Find the query's closing ) by paren-depth matching
  const m = lines[qLine].match(/find(Unique|First|Many)\s*\(/);
  const openParenCol = m.index + m[0].length - 1;
  let pDepth = 1, qEndLine = qLine;
  let found = false;
  for (let i = qLine; i < lines.length && !found; i++) {
    const jStart = (i === qLine) ? openParenCol + 1 : 0;
    for (let j = jStart; j < lines[i].length; j++) {
      if (lines[i][j] === '(') pDepth++;
      if (lines[i][j] === ')') {
        pDepth--;
        if (pDepth === 0) { qEndLine = i; found = true; break; }
      }
    }
  }
  if (!found) return { applied: false, reason: 'could not match query parens' };

  // 3. Reject queries that use 'select:' (can't mix select + include in Prisma)
  for (let i = qLine; i <= qEndLine; i++) {
    if (/\bselect\s*:/.test(lines[i])) {
      return { applied: false, reason: 'uses select — manual fix needed' };
    }
  }

  let modified = false;

  // 4. Add missing include relations
  if (fix.addInclude.length > 0) {
    // Check if 'include:' already exists in the query block
    let includeLine = -1;
    for (let i = qLine; i <= qEndLine; i++) {
      if (/\binclude\s*:/.test(lines[i])) { includeLine = i; break; }
    }

    if (includeLine !== -1) {
      // Insert new relation keys right after the 'include: {' line
      const baseIndent = lines[includeLine].match(/^(\s*)/)[1];
      const newLines = fix.addInclude.map(r => `${baseIndent}  ${r}: true,`);
      lines.splice(includeLine + 1, 0, ...newLines);
      qEndLine += newLines.length;
      modified = true;
    } else {
      // Find the closing } of the query argument (last } before closing ))
      let braceLine = qEndLine;
      for (let i = qEndLine; i >= qLine; i--) {
        if (lines[i].includes('}')) { braceLine = i; break; }
      }
      // Detect indent from the 'where:' line (or first line after query start)
      let indent = '    ';
      for (let i = qLine + 1; i <= qEndLine; i++) {
        const im = lines[i].match(/^(\s+)\w/);
        if (im) { indent = im[1]; break; }
      }
      const block = [
        `${indent}include: {`,
        ...fix.addInclude.map(r => `${indent}  ${r}: true,`),
        `${indent}},`,
      ];
      lines.splice(braceLine, 0, ...block);
      qEndLine += block.length;
      modified = true;
    }
  }

  // 5. Add Object.assign spread for findUnique / findFirst (not findMany)
  if (!isFindMany) {
    // Detect the assigned variable name (look up to 5 lines before query)
    let varName = null;
    for (let i = qLine; i >= Math.max(0, qLine - 5); i--) {
      const vm = lines[i].match(/(?:const|let|var)\s+(\w+)\s*=/);
      if (vm) { varName = vm[1]; break; }
    }

    if (varName) {
      // Find the ; that ends the query statement
      let semiLine = qEndLine;
      for (let i = qEndLine; i <= Math.min(lines.length - 1, qEndLine + 2); i++) {
        if (lines[i].includes(';')) { semiLine = i; break; }
      }

      // Check if a spread/assign already exists within 5 lines after
      let hasSpread = false;
      for (let i = semiLine + 1; i <= Math.min(lines.length - 1, semiLine + 5); i++) {
        if (lines[i].includes(`Object.assign(${varName}`) ||
            lines[i].includes(`{ ...${varName}`) ||
            lines[i].includes(`{...${varName}`)) {
          hasSpread = true;
          break;
        }
      }

      if (!hasSpread) {
        const spread = `Object.assign(${varName}, ${varName}?.auth, ${varName}?.whatsapp, ${varName}?.social, ${varName}?.zoho, ${varName}?.subscription);`;
        lines.splice(semiLine + 1, 0, spread);
        modified = true;
      }
    }
  }

  if (!modified) return { applied: false, reason: 'no changes needed (findMany spread-only?)' };
  return { applied: true };
}

// ─── Main processing loop ──────────────────────────────────────────────
for (const [relPath, fixes] of Object.entries(byFile)) {
  const absPath = path.join(BACKEND_ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    log.push(`❌ File not found: ${relPath}`);
    stats.errors += fixes.length;
    continue;
  }

  let lines = fs.readFileSync(absPath, 'utf8').split('\n');

  // Process bottom-to-top so earlier line numbers stay valid
  fixes.sort((a, b) => b.line - a.line);

  for (const fix of fixes) {
    try {
      const result = applyFix(lines, fix);
      if (result.applied) {
        stats.applied++;
        const desc = fix.addInclude.length
          ? `+include: ${fix.addInclude.join(', ')}`
          : '+spread';
        log.push(`✅ ${relPath}:${fix.line}  ${desc}`);
      } else {
        stats.skipped++;
        log.push(`⏭️  ${relPath}:${fix.line}  ${result.reason}`);
      }
    } catch (err) {
      stats.errors++;
      log.push(`❌ ${relPath}:${fix.line}  ${err.message}`);
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(absPath, lines.join('\n'), 'utf8');
  }
}

// ─── Output ────────────────────────────────────────────────────────────
console.log('');
console.log(DRY_RUN ? '🔍 DRY RUN — no files modified' : '🔧 APPLIED — files modified');
console.log('═'.repeat(70));
for (const entry of log) console.log(entry);
console.log('═'.repeat(70));
console.log(`  Applied: ${stats.applied}  |  Skipped: ${stats.skipped}  |  Errors: ${stats.errors}  /  ${FIXES.length} total`);
console.log(`  Files:   ${Object.keys(byFile).length}`);
console.log('');

if (!DRY_RUN && stats.applied > 0) {
  console.log('💡 Review:    git diff');
  console.log('💡 Revert:    git checkout -- src/');
  console.log('💡 Verify:    node scripts/extract-regression-blocks.js');
  console.log('');
}

if (stats.skipped > 0) {
  console.log('⚠️  Skipped items need manual fixes. Common reasons:');
  console.log('   • findMany queries — spread must go inside the for-loop');
  console.log('   • select queries — Prisma forbids mixing select + include');
  console.log('   • query not found — line shifted or already fixed');
  console.log('');
}