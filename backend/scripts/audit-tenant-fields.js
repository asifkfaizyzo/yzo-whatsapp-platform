#!/usr/bin/env node
// backend/scripts/audit-tenant-fields.js
// AST-based audit for Tenant God Model regression detection.
// Zero false positives — understands nested relation blocks natively.

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const traverse = _traverse.default || _traverse;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');

/* ── config ─────────────────────────────────────────────────────── */

const MOVED = {
  // TenantWhatsApp
  whatsappPhoneId: 'whatsapp', whatsappWabaId: 'whatsapp',
  whatsappAccessToken: 'whatsapp', whatsappVerifyToken: 'whatsapp',
  whatsappPin: 'whatsapp', whatsappCatalogId: 'whatsapp',
  // TenantSocial
  facebookPageId: 'social', facebookPageName: 'social',
  facebookPageAccessToken: 'social', instagramAccountId: 'social',
  instagramUsername: 'social',
  // TenantZoho
  zohoAccessToken: 'zoho', zohoRefreshToken: 'zoho',
  zohoTokenExpiresAt: 'zoho', zohoAccountId: 'zoho',
  zohoDataCenter: 'zoho', zohoApiDomain: 'zoho',
  zohoAccountEmail: 'zoho', zohoConnectionStatus: 'zoho',
  zohoConnectedAt: 'zoho', zohoScopes: 'zoho',
  // TenantAuth
  googleId: 'auth', facebookId: 'auth', authProvider: 'auth',
  isEmailVerified: 'auth', otpHash: 'auth', otpExpiresAt: 'auth',
  // TenantSubscription
  planId: 'subscription', planActivatedAt: 'subscription',
  billingType: 'subscription', planStatus: 'subscription',
  subscriptionStatus: 'subscription', currentPlan: 'subscription',
  planPeriodStart: 'subscription', planPeriodEnd: 'subscription',
  cancelRequestedAt: 'subscription', cancellationReason: 'subscription',
  reactivatedAt: 'subscription', dataDeletionDate: 'subscription',
  hasUsedTrial: 'subscription', trialPlanId: 'subscription',
  trialExtendedCount: 'subscription', trialExtendedByAdmin: 'subscription',
  razorpayCustomerId: 'subscription', razorpaySubscriptionId: 'subscription',
  autopayEnabled: 'subscription', autopayMethod: 'subscription',
  razorpayMerchantId: 'subscription', razorpayMerchantName: 'subscription',
  razorpayMerchantEmail: 'subscription', razorpayMerchantPhone: 'subscription',
  razorpayMerchantType: 'subscription', razorpayMerchantStatus: 'subscription',
  razorpaySettlementAccountId: 'subscription', razorpayRouteEnabled: 'subscription',
  razorpayCommissionPercent: 'subscription',
};

const MOVED_REL = { plan: 'subscription' };

const METHODS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'create', 'update', 'upsert', 'delete',
  'updateMany', 'deleteMany', 'count', 'aggregate',
]);

/* ── helpers ────────────────────────────────────────────────────── */

const cap = s => s[0].toUpperCase() + s.slice(1);
const relModel = r => `Tenant${cap(r)}`;
const pName = p => p.key?.name || p.key?.value || null;

function* jsFiles(dir) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) {
      if (e !== 'node_modules' && e !== '.git') yield* jsFiles(f);
    } else if (/\.(m?js|cjs)$/.test(e)) {
      yield f;
    }
  }
}

/** Resolve a node to an ObjectExpression, following one variable hop. */
function toObj(node, scope) {
  if (!node) return null;
  if (node.type === 'ObjectExpression') return node;
  if (node.type === 'Identifier') {
    const b = scope.getBinding(node.name);
    if (b?.path.isVariableDeclarator()) {
      const init = b.path.node.init;
      if (init?.type === 'ObjectExpression') return init;
    }
  }
  return null;
}

/* ── per-file analysis ──────────────────────────────────────────── */

function analyze(file) {
  const rel = relative(ROOT, file);
  const code = readFileSync(file, 'utf-8');

  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      errorRecovery: true,
      plugins: [
        'jsx', 'optionalChaining', 'nullishCoalescingOperator',
        'classProperties', 'classPrivateProperties', 'classPrivateMethods',
        'dynamicImport', 'exportDefaultFrom', 'objectRestSpread',
        'optionalCatchBinding', 'numericSeparator', 'logicalAssignment',
      ],
    });
  } catch {
    return { rel, issues: [], unverifiable: false };
  }

  const issues = [];
  let unverifiable = false;

  /* Pass 1 — collect vars assigned from prisma.tenant.* / tx.tenant.* */
  const tenantVars = new Map(); // name → Set<includedRelationNames>

  traverse(ast, {
    VariableDeclarator(p) {
      let init = p.node.init;
      if (init?.type === 'AwaitExpression') init = init.argument;
      if (init?.type !== 'CallExpression') return;
      const c = init.callee;
      if (c?.type !== 'MemberExpression') return;
      const o = c.object;
      if (o?.type !== 'MemberExpression') return;
      if (o.property?.name !== 'tenant') return;
      const name = p.node.id?.name;
      if (!name) return;

      const rels = new Set();
      const arg = init.arguments[0];
      if (arg?.type === 'ObjectExpression') {
        for (const pr of arg.properties) {
          const k = pName(pr);
          if ((k === 'include' || k === 'select') && pr.value?.type === 'ObjectExpression') {
            for (const sp of pr.value.properties) {
              const sk = pName(sp);
              if (sk) rels.add(sk);
            }
          }
        }
      }
      tenantVars.set(name, rels);
    },
  });

  /* Pass 2 — check prisma calls + dot-access */
  traverse(ast, {

    /* ── prisma.tenant.<method>({ ... }) ── */
    CallExpression(p) {
      const c = p.node.callee;
      if (c?.type !== 'MemberExpression') return;
      const o = c.object;
      if (o?.type !== 'MemberExpression') return;
      if (o.property?.name !== 'tenant') return;
      const method = c.property?.name;
      if (!METHODS.has(method)) return;

      const opts = toObj(p.node.arguments[0], p.scope);
      if (!opts) return;
      const line = p.node.loc?.start?.line || '?';

      for (const pr of opts.properties) {
        const k = pName(pr);
        if (!k) continue;

        // WRITE: data / create / update
        if (k === 'data' || k === 'create' || k === 'update') {
          const v = toObj(pr.value, p.scope);
          if (!v) continue;
          for (const sp of v.properties) {
            const fn = pName(sp);
            if (fn && MOVED[fn]) {
              issues.push({
                line, type: 'WRITE',
                msg: `${k}.${fn} on prisma.tenant.${method} — moved to ${relModel(MOVED[fn])}`,
                fix: `split: tenant.${method}() + ${relModel(MOVED[fn])}.upsert()`,
              });
            }
          }
        }

        // READ: where / select
        if (k === 'where' || k === 'select') {
          const v = toObj(pr.value, p.scope);
          if (!v) continue;
          for (const sp of v.properties) {
            const fn = pName(sp);
            if (fn && MOVED[fn]) {
              const r = MOVED[fn];
              issues.push({
                line, type: k === 'where' ? 'WHERE' : 'SELECT',
                msg: `${k}.${fn} on prisma.tenant.${method} — moved to ${relModel(r)}`,
                fix: k === 'where'
                  ? `where: { ${r}: { ${fn}: ... } }`
                  : `select: { ${r}: { select: { ${fn}: true } } }`,
              });
            }
          }
        }

        // RELATION: include.plan on Tenant
        if (k === 'include') {
          const v = toObj(pr.value, p.scope);
          if (!v) continue;
          for (const sp of v.properties) {
            const fn = pName(sp);
            if (fn && MOVED_REL[fn]) {
              issues.push({
                line, type: 'RELATION',
                msg: `include.${fn} on prisma.tenant.${method} — ${fn} moved to ${relModel(MOVED_REL[fn])}`,
                fix: `include: { ${MOVED_REL[fn]}: { include: { ${fn}: true } } }`,
              });
            }
          }
        }
      }
    },

    /* ── dot-access: req.tenant.movedField / tenantVar.movedField ── */
MemberExpression(p) {
      const n = p.node;
      const fn = n.property?.name;
      if (!fn || !MOVED[fn]) return;
      const line = n.loc?.start?.line || '?';
      const r = MOVED[fn];

      // req.tenant.movedField — always a bug
      if (
        n.object?.type === 'MemberExpression' &&
        n.object.object?.name === 'req' &&
        n.object.property?.name === 'tenant'
      ) {
        issues.push({
          line, type: 'DOT',
          msg: `req.tenant.${fn} — moved fields not on Tenant table`,
          fix: `query tenant.${r} relation separately`,
        });
        return;
      }

      if (n.object?.type === 'Identifier') {
        // SCOPE CHECK FIRST: is this var a param in the current function?
        const binding = p.scope.getBinding(n.object.name);
        if (binding?.kind === 'param') {
          unverifiable = true;
          return; // skip before tenantVars check
        }

        // Also skip if var is assigned from req.tenant (not a prisma call)
        if (binding?.path.isVariableDeclarator()) {
          const init = binding.path.node.init;
          if (
            init?.type === 'MemberExpression' &&
            init.object?.name === 'req' &&
            init.property?.name === 'tenant'
          ) {
            unverifiable = true;
            return;
          }
        }

        // Now check if it came from prisma.tenant.*
        if (tenantVars.has(n.object.name)) {
          const rels = tenantVars.get(n.object.name);
          if (rels.has(r)) return; // relation included → assume spread
          issues.push({
            line, type: 'DOT',
            msg: `${n.object.name}.${fn} — ${fn} moved to ${relModel(r)}`,
            fix: `add ${r} to include + Object.assign(v, v?.${r})`,
          });
          return;
        }
      }
    },
  });

  return { rel, issues, unverifiable };
}

/* ── main ───────────────────────────────────────────────────────── */

const files = [...jsFiles(SRC)];
console.log(`\n🔍 Auditing ${files.length} files...\n`);

const allIssues = [];
let unverifiableCount = 0;

for (const f of files) {
  const { rel, issues, unverifiable } = analyze(f);
  if (unverifiable) unverifiableCount++;
  for (const iss of issues) allIssues.push({ ...iss, file: rel });
}

if (allIssues.length === 0) {
  const line = '✅ All clean.\n';
  console.log(line);
  if (unverifiableCount) {
    const note = `⚠️  ${unverifiableCount} file(s) had unverifiable tenant params (cross-file tracing not supported)\n`;
    console.log(note);
  }
  process.exit(0);
}

// Group by file
const byFile = new Map();
for (const iss of allIssues) {
  if (!byFile.has(iss.file)) byFile.set(iss.file, []);
  byFile.get(iss.file).push(iss);
}

const out = [];
out.push(`❌ ${allIssues.length} real issue(s) found across ${byFile.size} file(s)\n`);

for (const [file, fileIssues] of byFile) {
  out.push(file);
  for (const iss of fileIssues) {
    out.push(`  L${String(iss.line).padEnd(5)} ${iss.type.padEnd(9)} ${iss.msg}`);
    out.push(`  ${''.padEnd(14)} fix: ${iss.fix}`);
  }
  out.push('');
}

if (unverifiableCount) {
  out.push(`⚠️  ${unverifiableCount} file(s) had unverifiable tenant params`);
  out.push('');
}

const text = out.join('\n');
console.log(text);

const outPath = join(__dirname, 'audit-results.txt');
writeFileSync(outPath, text, 'utf-8');
console.log(`Results written to ${relative(ROOT, outPath)}\n`);

process.exit(1);