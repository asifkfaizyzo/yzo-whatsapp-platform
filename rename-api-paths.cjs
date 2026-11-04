// rename-api-paths.cjs
const fs = require('fs');
const path = require('path');

const DRY_RUN = false; // ← flip to false after verifying dry-run output
const ROOT = __dirname;

// ── Replacement Rules (order matters: numbered first, bare /api last) ──
const NUMBERED_RULES = [
  { from: '/api9', to: '/tenant/broadcasts' },
  { from: '/api8', to: '/tenant/templates' },
  { from: '/api7', to: '/tenant/tags' },
  { from: '/api6', to: '/tenant/messages' },
  { from: '/api5', to: '/tenant/conversations' },
  { from: '/api4', to: '/tenant/contacts' },
  { from: '/api3', to: '/tenant/user' },
  { from: '/api2', to: '/tenant' },
];

// Bare /api → /sradmin
// Match /api NOT preceded by '.' (avoids ../../api/ imports)
// NOT followed by digit 2-9 (avoids matching /api2 etc)
// Followed by /, quote, comma, paren, space, or end-of-string
const BARE_API_REGEX = /(?<!\.)(\/api)(?![2-9])(?=\/|['"`\s,;)\]}]|$)/g;

// Lines to DELETE entirely (app.js /api4 duplicate mount)
const DELETE_LINES = [
  "app.use('/api4'",
  'app.use("/api4"',
];

function shouldSkipLine(line) {
  // Skip import/require paths like from "../../api/zoho"
  if (/from\s+['"]\.\.?\/.*\/api\//.test(line)) return true;
  if (/require\s*\(\s*['"]\.\.?\/.*\/api\//.test(line)) return true;
  // Skip Shopify Admin API URLs (external, not ours)
  if (/\/admin\/api\//.test(line)) return true;
  // Skip file-path comments like "// tenant-web/src/api/axios.js"
  if (/^\s*\/\/\s*\S+\/src\/api\//.test(line)) return true;
  return false;
}

function processLine(line, filePath) {
  if (shouldSkipLine(line)) return line;

  // Check if this line should be deleted (app.js /api4 mount)
  if (filePath.includes('app.js')) {
    for (const dl of DELETE_LINES) {
      if (line.trim().startsWith(dl)) return null; // signal deletion
    }
  }
  let result = line;

  // Apply numbered rules first (longest match first, already sorted)
  for (const rule of NUMBERED_RULES) {
    // Match the pattern followed by /, quote, comma, paren, space, or EOL
    const regex = new RegExp(
      rule.from.replace('/', '\\/') + "(?=\\/|['\"`\\s,;)\\]}]|$)",
      'g'
    );
    result = result.replace(regex, rule.to);
  }

  // Apply bare /api → /sradmin last
  result = result.replace(BARE_API_REGEX, '/sradmin');

  return result;
}

function processFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  if (!fs.existsSync(abs)) return { file: filePath, changes: 0, deleted: 0, error: 'not found' };

  const original = fs.readFileSync(abs, 'utf-8');
  const lines = original.split('\n');
  const newLines = [];
  let changes = 0;
  let deleted = 0;
  const diffs = [];

  for (let i = 0; i < lines.length; i++) {
    const processed = processLine(lines[i], filePath);

    if (processed === null) {
      deleted++;
      diffs.push(`  L${i + 1} DELETE: ${lines[i].trim().substring(0, 120)}`);
      continue;
    }

    if (processed !== lines[i]) {
      changes++;
      diffs.push(`  L${i + 1} - ${lines[i].trim().substring(0, 120)}`);
      diffs.push(`  L${i + 1} + ${processed.trim().substring(0, 120)}`);
    }

    newLines.push(processed);
  }

  if (changes > 0 || deleted > 0) {
    let finalContent = newLines.join('\n');
    // Fix: WooCommerce oauth fallback is a tenant route, not superadmin
    if (filePath.includes('woocommerce.oauth.controller.js')) {
      finalContent = finalContent.replace(/\/sradmin\/woocommerce/g, '/tenant/woocommerce');
    }
    if (!DRY_RUN) {
      fs.writeFileSync(abs, finalContent, 'utf-8');
    }
    return { file: filePath, changes, deleted, diffs };
  }

  return { file: filePath, changes: 0, deleted: 0 };
}

// ── Files to process (from discovery) ──
const FILES = [
  // Backend
  'backend/.env.example',
  'backend/src/app.js',
  'backend/src/lib/utils/signed.url.js',
  'backend/src/middlewares/subscription.access.js',
  'backend/src/modules/shopify/products/shopify.product.controller.js',
  'backend/src/modules/shopify/webhooks/shopify.webhook.service.js',
  'backend/src/modules/tenant/integrations/tenant.integrations.controller.js',
  'backend/src/modules/tenant/razorpay.oauth.controller.js',
  'backend/src/modules/webhook/order.webhook.controller.js',
  'backend/src/modules/whatsapp/call.controller.js',
  'backend/src/modules/whatsapp/whatsapp.controller.js',
  'backend/src/modules/whatsapp/whatsapp.routes.js',
  'backend/src/modules/whatsapp/whatsapp.schema.js',
  'backend/src/modules/woocommerce/woocommerce.controller.js',
  'backend/src/modules/woocommerce/woocommerce.oauth.controller.js',
  'backend/src/modules/woocommerce/woocommerce.order.controller.js',
  'backend/src/modules/woocommerce/woocommerce.service.js',
  'backend/src/modules/zoho/webhooks/zoho.trigger.controller.js',
  'backend/src/modules/zoho/webhooks/zoho.webhook.controller.js',
  'backend/src/modules/zoho/zoho.controller.js',
  'backend/src/modules/zoho/zoho.service.js',
  // Tenant-web
  'tenant-web/src/api/analytics.js',
  'tenant-web/src/api/axios.js',
  'tenant-web/src/api/broadcast.js',
  'tenant-web/src/api/contact.js',
  'tenant-web/src/api/conversation.js',
  'tenant-web/src/api/flow.js',
  'tenant-web/src/api/message.js',
  'tenant-web/src/api/tag.js',
  'tenant-web/src/api/template.js',
  'tenant-web/src/api/tenant.js',
  'tenant-web/src/api/user.js',
  'tenant-web/src/api/zoho.js',
  'tenant-web/src/components/Sidebar.jsx',
  'tenant-web/src/components/TopNavBar.jsx',
  'tenant-web/src/components/settings/ShopifySettings.jsx',
  'tenant-web/src/pages/dashboard/Dashboard.jsx',
  'tenant-web/src/pages/dashboard/Inbox.jsx',
  'tenant-web/src/pages/dashboard/RazorpayOAuthCallback.jsx',
  'tenant-web/src/routes/appRoutes.jsx',
  'tenant-web/src/store/useAuthStore.js',
  // Admin-web
  'admin-web/src/api/axios.js',
  'admin-web/src/pages/dashboard/Tenants.jsx',
  'admin-web/src/store/useAdminAuthStore.js',
];

// ── Run ──
console.log(DRY_RUN ? '\n🔍 DRY RUN — no files will be modified\n' : '\n🚀 APPLYING CHANGES\n');

let totalChanges = 0;
let totalDeleted = 0;
let totalFiles = 0;

for (const f of FILES) {
  const result = processFile(f);
  if (result.error) {
    console.log(`❌ ${f}: ${result.error}`);
    continue;
  }
  if (result.changes > 0 || result.deleted > 0) {
    totalFiles++;
    totalChanges += result.changes;
    totalDeleted += result.deleted;
    console.log(`📄 ${f} (${result.changes} changes, ${result.deleted} deletions)`);
    if (result.diffs) {
      for (const d of result.diffs) console.log(d);
    }
    console.log('');
  }
}

console.log('─'.repeat(60));
console.log(`  ${totalFiles} files, ${totalChanges} line changes, ${totalDeleted} line deletions`);
if (DRY_RUN) {
  console.log('  ⚠️  DRY RUN — set DRY_RUN = false and re-run to apply');
}
console.log('─'.repeat(60));