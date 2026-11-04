// backend/scripts/extract-regression-blocks.js (do not remove this comment)
// Extracts exact code blocks for every Phase B regression hit.
// Now includes PARENT QUERY SCAN to find queries missing relation includes.
// Output: grouped by file, with line numbers, context, and moved-field annotations.
// READ-ONLY — makes no changes.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '..', 'src');
const CONTEXT_LINES = 5;

const MOVED_FIELDS = {
  TenantAuth: [
    'otpHash', 'otpExpiresAt', 'isEmailVerified',
    'googleId', 'facebookId', 'authProvider'
  ],
  TenantWhatsApp: [
    'whatsappPhoneId', 'whatsappWabaId', 'whatsappAccessToken',
    'whatsappVerifyToken', 'whatsappPin', 'whatsappCatalogId'
  ],
  TenantSocial: [
    'facebookPageId', 'facebookPageName', 'facebookPageAccessToken',
    'instagramAccountId', 'instagramUsername'
  ],
  TenantZoho: [
    'zohoAccessToken', 'zohoRefreshToken', 'zohoTokenExpiresAt',
    'zohoAccountId', 'zohoDataCenter', 'zohoApiDomain',
    'zohoAccountEmail', 'zohoConnectionStatus', 'zohoConnectedAt', 'zohoScopes'
  ],
  TenantSubscription: [
    'planId', 'planStatus', 'billingType', 'planActivatedAt',
    'subscriptionStatus', 'currentPlan', 'planPeriodStart', 'planPeriodEnd',
    'cancelRequestedAt', 'cancellationReason', 'reactivatedAt', 'dataDeletionDate',
    'hasUsedTrial', 'trialPlanId', 'trialExtendedCount', 'trialExtendedByAdmin',
    'razorpayCustomerId', 'razorpaySubscriptionId',
    'autopayEnabled', 'autopayMethod',
    'razorpayOrderId', 'razorpayPaymentId', 'razorpaySignature',
    'razorpayPlanId', 'razorpayTokenId', 'razorpayMandateStatus'
  ]
};

const FIELD_TO_TABLE = {};
for (const [table, fields] of Object.entries(MOVED_FIELDS)) {
  for (const f of fields) FIELD_TO_TABLE[f] = table;
}

const TABLE_TO_RELATION = {
  TenantAuth: 'auth',
  TenantWhatsApp: 'whatsapp',
  TenantSocial: 'social',
  TenantZoho: 'zoho',
  TenantSubscription: 'subscription'
};

const RELATIONS = ['auth', 'whatsapp', 'social', 'zoho', 'subscription'];

const PRISMA_METHODS = [
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'update', 'updateMany', 'upsert', 'create', 'createMany',
  'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'
];

const READ_METHODS = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany'];

function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walkDir(fullPath, fileList);
    } else if (entry.name.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function extractCallBlock(lines, startIdx) {
  let depth = 0;
  let started = false;
  let endIdx = startIdx;
  for (let i = startIdx; i < Math.min(lines.length, startIdx + 120); i++) {
    for (const ch of lines[i]) {
      if (ch === '(') { depth++; started = true; }
      else if (ch === ')') { depth--; }
    }
    if (started && depth === 0) { endIdx = i; break; }
  }
  return { startIdx, endIdx };
}

function classifyMethod(method) {
  if (['update', 'updateMany', 'upsert', 'create', 'createMany', 'delete', 'deleteMany'].includes(method)) {
    return 'WRITE';
  }
  return 'READ';
}

function findMovedFieldsInBlock(lines, startIdx, endIdx) {
  const body = lines.slice(startIdx, endIdx + 1).join('\n');
  const found = new Set();
  for (const field of Object.keys(FIELD_TO_TABLE)) {
    const re = new RegExp(`\\b${field}\\s*:`, 'g');
    if (re.test(body)) found.add(field);
  }
  return [...found];
}

function findDotAccessHits(lines) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    for (const field of Object.keys(FIELD_TO_TABLE)) {
      const re = new RegExp(`\\b(\\w+)\\.${field}\\b(?!\\s*:)`, 'g');
      let match;
      while ((match = re.exec(line)) !== null) {
        const varName = match[1];
        if (/tenant/i.test(varName) || /^(t|tx)\b/.test(varName)) {
          hits.push({ lineIdx: i, field, table: FIELD_TO_TABLE[field], varName });
        }
      }
    }
  }
  return hits;
}

function checkRelationsInBlock(block) {
  const found = [];
  for (const rel of RELATIONS) {
    // Match `relation: {` or `relation: true` but NOT `relationField:`
    const re = new RegExp(`\\b${rel}\\s*:\\s*[\\{t]`);
    if (re.test(block)) found.push(rel);
  }
  return found;
}

function checkSpreadAfterQuery(lines, endIdx) {
  for (let j = endIdx + 1; j < Math.min(lines.length, endIdx + 6); j++) {
    const line = lines[j];
    // Match spread: ...tenantRow, ...raw, ...t
    if (/\.\.\.\w+/.test(line)) return { found: true, line: j + 1 };
    // Match extraction: tenantRow?.whatsapp || {}
    if (/\?\.(whatsapp|subscription|auth|social|zoho)/.test(line)) return { found: true, line: j + 1 };
  }
  return { found: false, line: -1 };
}

function formatLineNum(num, maxNum) {
  return String(num).padStart(String(maxNum).length, ' ');
}

function extractAndFormat() {
  const files = walkDir(SRC_DIR);
  let output = '';
  let totalWriteHits = 0;
  let totalDotHits = 0;
  let totalFiles = 0;
  let totalParentQueries = 0;
  let totalParentNeedsFix = 0;

  const sep = '═'.repeat(78);
  const thinSep = '─'.repeat(78);

  output += `\n${sep}\n`;
  output += `  PHASE B — REGRESSION SCAN + PARENT QUERY ANALYSIS\n`;
  output += `  ${files.length} files scanned | ${SRC_DIR}\n`;
  output += `${sep}\n\n`;

  // ── SECTION 1 & 2: WRITE REGRESSIONS + DOT-ACCESS ──
  output += `${sep}\n`;
  output += `  SECTION 1: WRITE REGRESSIONS (target: 0)\n`;
  output += `  prisma.tenant.update/create with moved fields in data block\n`;
  output += `${sep}\n\n`;

  const dotAccessNote = [
    `${sep}`,
    `  SECTION 2: DOT-ACCESS HITS (informational)`,
    `  tenant.movedField patterns — these ALWAYS appear in source code.`,
    `  They are NOT bugs when the parent query includes the relation + spread.`,
    `  Check SECTION 3 to verify parent queries are fixed.`,
    `${sep}`,
    ''
  ].join('\n');

  let dotSectionOutput = '';
  let writeSectionOutput = '';

  // Store per-file dot-access tables for parent query analysis
  const fileDotTables = {};

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const relPath = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
    const maxLine = lines.length;

    const writeHits = [];
    const dotHits = [];

    // 1. Prisma WRITE calls with moved fields
    for (let i = 0; i < lines.length; i++) {
      if (!/\.tenant\.\w+\s*\(/.test(lines[i])) continue;
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      const methodMatch = lines[i].match(/\.tenant\.(\w+)\s*\(/);
      if (!methodMatch) continue;
      const method = methodMatch[1];
      if (!PRISMA_METHODS.includes(method)) continue;
      if (classifyMethod(method) !== 'WRITE') continue;

      const call = extractCallBlock(lines, i);
      const movedFields = findMovedFieldsInBlock(lines, call.startIdx, call.endIdx);
      if (movedFields.length === 0) { i = call.endIdx; continue; }

      const byTable = {};
      for (const f of movedFields) {
        const t = FIELD_TO_TABLE[f];
        if (!byTable[t]) byTable[t] = [];
        byTable[t].push(f);
      }

      writeHits.push({ startIdx: call.startIdx, endIdx: call.endIdx, method, byTable });
      i = call.endIdx;
    }

    // 2. Dot-access hits
    const rawDotHits = findDotAccessHits(lines);
    const writeRanges = writeHits.map(h => [h.startIdx, h.endIdx]);
    const filteredDotHits = rawDotHits.filter(dh =>
      !writeRanges.some(([s, e]) => dh.lineIdx >= s && dh.lineIdx <= e)
    );

    const dotGroups = [];
    for (const dh of filteredDotHits) {
      const lastGroup = dotGroups[dotGroups.length - 1];
      if (lastGroup && dh.lineIdx - lastGroup.endIdx <= 3) {
        lastGroup.endIdx = dh.lineIdx;
        lastGroup.fields.add(dh.field);
        lastGroup.tables.add(dh.table);
      } else {
        dotGroups.push({
          startIdx: dh.lineIdx, endIdx: dh.lineIdx,
          fields: new Set([dh.field]), tables: new Set([dh.table])
        });
      }
    }

    for (const g of dotGroups) {
      const byTable = {};
      for (const t of g.tables) {
        byTable[t] = [...g.fields].filter(f => FIELD_TO_TABLE[f] === t);
      }
      dotHits.push({ startIdx: g.startIdx, endIdx: g.endIdx, byTable });
    }

    // Track dot-access tables per file for parent query analysis
    const dotTables = new Set();
    for (const dh of filteredDotHits) dotTables.add(dh.table);
    fileDotTables[relPath] = dotTables;

    if (writeHits.length === 0 && dotHits.length === 0) continue;

    totalFiles++;
    const fileHeader = `${sep}\n📄 ${relPath}  (${writeHits.length} write, ${dotHits.length} dot-access, ${lines.length} lines)\n${sep}\n\n`;

    if (writeHits.length > 0) {
      writeSectionOutput += fileHeader;
      for (let h = 0; h < writeHits.length; h++) {
        const hit = writeHits[h];
        totalWriteHits++;
        const rangeStr = hit.startIdx === hit.endIdx ? `L${hit.startIdx + 1}` : `L${hit.startIdx + 1}–${hit.endIdx + 1}`;
        writeSectionOutput += `${thinSep}\n`;
        writeSectionOutput += `  HIT ${h + 1}: ${rangeStr}  [WRITE]  prisma/tx.tenant.${hit.method}()\n`;
        for (const [table, fields] of Object.entries(hit.byTable)) {
          writeSectionOutput += `           → ${table}: ${fields.join(', ')}\n`;
        }
        writeSectionOutput += `\n`;
        const ctxStart = Math.max(0, hit.startIdx - CONTEXT_LINES);
        const ctxEnd = Math.min(lines.length - 1, hit.endIdx + CONTEXT_LINES);
        for (let i = ctxStart; i <= ctxEnd; i++) {
          const marker = (i >= hit.startIdx && i <= hit.endIdx) ? '▸' : ' ';
          writeSectionOutput += `  ${marker} ${formatLineNum(i + 1, maxLine)} │ ${lines[i].replace(/\t/g, '  ')}\n`;
        }
        writeSectionOutput += `\n`;
      }
    }

    if (dotHits.length > 0) {
      dotSectionOutput += fileHeader;
      for (let h = 0; h < dotHits.length; h++) {
        const hit = dotHits[h];
        totalDotHits++;
        const rangeStr = hit.startIdx === hit.endIdx ? `L${hit.startIdx + 1}` : `L${hit.startIdx + 1}–${hit.endIdx + 1}`;
        dotSectionOutput += `${thinSep}\n`;
        dotSectionOutput += `  HIT ${h + 1}: ${rangeStr}  [READ]  tenant.* dot access\n`;
        for (const [table, fields] of Object.entries(hit.byTable)) {
          dotSectionOutput += `           → ${table}: ${fields.join(', ')}\n`;
        }
        dotSectionOutput += `\n`;
        const ctxStart = Math.max(0, hit.startIdx - CONTEXT_LINES);
        const ctxEnd = Math.min(lines.length - 1, hit.endIdx + CONTEXT_LINES);
        for (let i = ctxStart; i <= ctxEnd; i++) {
          const marker = (i >= hit.startIdx && i <= hit.endIdx) ? '▸' : ' ';
          dotSectionOutput += `  ${marker} ${formatLineNum(i + 1, maxLine)} │ ${lines[i].replace(/\t/g, '  ')}\n`;
        }
        dotSectionOutput += `\n`;
      }
    }
  }

  output += writeSectionOutput || '  ✅ No WRITE regressions found!\n\n';
  output += dotAccessNote + '\n';
  output += dotSectionOutput || '  No dot-access hits.\n\n';

  // ── SECTION 3: PARENT QUERY SCAN ──
  output += `\n${sep}\n`;
  output += `  SECTION 3: PARENT QUERY SCAN\n`;
  output += `  prisma.tenant.find* calls — are relations included?\n`;
  output += `  ✅ = has relation + spread | ⚠️ = missing relation | ℹ️ = no dot-access in file\n`;
  output += `${sep}\n\n`;

  let parentSectionOutput = '';

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const relPath = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');

    const queries = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/(?:prisma|tx)\.tenant\.(findUnique|findFirst|findMany|findUniqueOrThrow|findFirstOrThrow)\s*\(/);
      if (!match) continue;
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      const call = extractCallBlock(lines, i);
      const block = lines.slice(call.startIdx, call.endIdx + 1).join('\n');
      const foundRelations = checkRelationsInBlock(block);
      const spread = checkSpreadAfterQuery(lines, call.endIdx);

      queries.push({
        lineIdx: call.startIdx,
        endIdx: call.endIdx,
        method: match[1],
        foundRelations,
        spreadFound: spread.found,
        spreadLine: spread.line
      });

      i = call.endIdx;
    }

    if (queries.length === 0) continue;

    const dotTables = fileDotTables[relPath] || new Set();
    const neededRelations = [...dotTables].map(t => TABLE_TO_RELATION[t]).filter(Boolean);

    let fileOutput = '';
    let fileNeedsFix = 0;

    for (const q of queries) {
      totalParentQueries++;
      const missingRelations = neededRelations.filter(r => !q.foundRelations.includes(r));
      const hasAllNeeded = missingRelations.length === 0;
      const hasSpread = q.spreadFound;

      let status;
      if (neededRelations.length === 0) {
        status = 'ℹ️ No dot-access in this file';
      } else if (hasAllNeeded && hasSpread) {
        status = '✅ OK';
      } else if (hasAllNeeded && !hasSpread) {
        status = '⚠️ Has relations but missing spread line';
        fileNeedsFix++;
      } else {
        status = `⚠️ NEEDS FIX — missing: ${missingRelations.join(', ')}`;
        fileNeedsFix++;
      }

      if (status.startsWith('⚠️')) totalParentNeedsFix++;

      fileOutput += `  L${q.lineIdx + 1}  prisma.tenant.${q.method}()\n`;
      fileOutput += `    Relations in query: ${q.foundRelations.length > 0 ? q.foundRelations.join(', ') : '(none)'}\n`;
      if (neededRelations.length > 0) {
        fileOutput += `    Relations needed:   ${neededRelations.join(', ')}\n`;
      }
      fileOutput += `    Spread after query: ${hasSpread ? `YES (L${q.spreadLine})` : 'NO'}\n`;
      fileOutput += `    Status: ${status}\n\n`;
    }

    if (fileNeedsFix > 0 || queries.some(q => q.foundRelations.length > 0)) {
      parentSectionOutput += `${thinSep}\n`;
      parentSectionOutput += `📄 ${relPath}  (${queries.length} queries, ${fileNeedsFix} need fix)\n\n`;
      parentSectionOutput += fileOutput;
    }
  }

  output += parentSectionOutput || '  No parent queries found.\n\n';

  // ── SUMMARY ──
  output += `${sep}\n`;
  output += `  SUMMARY\n`;
  output += `${sep}\n`;
  output += `  Section 1 — WRITE regressions:  ${totalWriteHits} hit(s)  ${totalWriteHits === 0 ? '✅ ALL FIXED' : '⚠️ NEED FIXING'}\n`;
  output += `  Section 2 — Dot-access hits:    ${totalDotHits} hit(s)  ℹ️ Expected (check Section 3)\n`;
  output += `  Section 3 — Parent queries:     ${totalParentQueries} total, ${totalParentNeedsFix} need fix\n`;
  output += `${sep}\n`;

  return output;
}

// Run
console.log('Extracting regression blocks + parent queries...');
const result = extractAndFormat();

const outPath = path.resolve(__dirname, 'regression-blocks.txt');
fs.writeFileSync(outPath, result, 'utf8');

console.log(`\n✅ Done. ${outPath}`);
console.log(`   File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
console.log(`\n   HOW TO READ:`);
console.log(`   • Section 1 (WRITE): Should be 0. If > 0, some fixes weren't applied.`);
console.log(`   • Section 2 (DOT):   Always shows hits — these are the usage lines, not bugs.`);
console.log(`   • Section 3 (PARENT): The real check. Fix queries marked ⚠️ NEEDS FIX.`);
console.log(`     Add include: { <relation>: true } to the query + spread line after.\n`);

const previewLines = result.split('\n').slice(0, 100);
console.log(previewLines.join('\n'));
if (result.split('\n').length > 100) {
  console.log(`\n  ... (${result.split('\n').length - 100} more lines in the file)\n`);
}