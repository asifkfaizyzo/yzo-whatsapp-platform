// backend/scripts/scan-tenant-regressions.js (do not remove this comment)
// Phase B Discovery: Scan all backend code for Prisma calls on `tenant.*`
// that reference fields moved to TenantAuth / TenantWhatsApp / TenantSocial / TenantZoho / TenantSubscription
// READ-ONLY — makes no changes.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, "..", "src");

// Fields that moved out of Tenant model (from Phase 3 memory)
const MOVED_FIELDS = {
  TenantAuth: [
    "otpHash",
    "otpExpiresAt",
    "isEmailVerified",
    "googleId",
    "facebookId",
    "authProvider",
  ],
  TenantWhatsApp: [
    "whatsappPhoneId",
    "whatsappWabaId",
    "whatsappAccessToken",
    "whatsappVerifyToken",
    "whatsappPin",
    "whatsappCatalogId",
  ],
  TenantSocial: [
    "facebookPageId",
    "facebookPageName",
    "facebookPageAccessToken",
    "instagramAccountId",
    "instagramUsername",
  ],
  TenantZoho: [
    "zohoAccessToken",
    "zohoRefreshToken",
    "zohoTokenExpiresAt",
    "zohoAccountId",
    "zohoDataCenter",
    "zohoApiDomain",
    "zohoAccountEmail",
    "zohoConnectionStatus",
    "zohoConnectedAt",
    "zohoScopes",
  ],
  TenantSubscription: [
    "planId",
    "planStatus",
    "billingType",
    "planActivatedAt",
    "subscriptionStatus",
    "currentPlan",
    "planPeriodStart",
    "planPeriodEnd",
    "cancelRequestedAt",
    "cancellationReason",
    "reactivatedAt",
    "dataDeletionDate",
    "hasUsedTrial",
    "trialPlanId",
    "trialExtendedCount",
    "trialExtendedByAdmin",
    "razorpayCustomerId",
    "razorpaySubscriptionId",
    "autopayEnabled",
    "autopayMethod",
    "razorpayOrderId",
    "razorpayPaymentId",
    "razorpaySignature",
    "razorpayPlanId",
    "razorpayTokenId",
    "razorpayMandateStatus",
  ],
};

// Flatten into a single lookup { fieldName: tableName }
const FIELD_TO_TABLE = {};
for (const [table, fields] of Object.entries(MOVED_FIELDS)) {
  for (const f of fields) FIELD_TO_TABLE[f] = table;
}

// Prisma methods we care about
const PRISMA_METHODS = [
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "upsert",
  "create",
  "createMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
];

// Find all .js files recursively
function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkDir(fullPath, fileList);
    } else if (entry.name.endsWith(".js")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// Extract the full Prisma call block starting at a given line
// Returns { startLine, endLine, body, method }
function extractPrismaCall(lines, startIdx) {
  // Match: prisma.tenant.<method>(  OR  tx.tenant.<method>(  OR  anyVar.tenant.<method>(
  const openLine = lines[startIdx];
  const methodMatch = openLine.match(/\.tenant\.(\w+)\s*\(/);
  if (!methodMatch) return null;
  const method = methodMatch[1];
  if (!PRISMA_METHODS.includes(method)) return null;

  // Walk forward tracking paren depth until balanced
  let depth = 0;
  let started = false;
  let body = "";
  let endIdx = startIdx;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "(") {
        depth++;
        started = true;
      } else if (ch === ")") {
        depth--;
      }
    }
    body += line + "\n";
    if (started && depth === 0) {
      endIdx = i;
      break;
    }
    if (i - startIdx > 100) break; // safety: don't scan forever
  }

  return { startLine: startIdx + 1, endLine: endIdx + 1, body, method };
}

// Determine if the call is a READ or WRITE
function classifyMethod(method) {
  if (
    [
      "update",
      "updateMany",
      "upsert",
      "create",
      "createMany",
      "delete",
      "deleteMany",
    ].includes(method)
  ) {
    return "WRITE";
  }
  return "READ";
}

// Check which moved fields appear in the call body
function findMovedFieldsInCall(body) {
  const found = new Set();
  // Match field names as object keys: `fieldName:` or `"fieldName":`
  // Also match in `select: { fieldName: true }` and `data: { fieldName: ... }` and `where: { fieldName: ... }`
  for (const field of Object.keys(FIELD_TO_TABLE)) {
    // word boundary, then field, then optional whitespace, then colon
    const re = new RegExp(`\\b${field}\\s*:`, "g");
    if (re.test(body)) {
      found.add(field);
    }
  }
  return [...found];
}

// Main scan
function scan() {
  const files = walkDir(SRC_DIR);
  const results = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    const fileHits = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Quick filter: line must mention `.tenant.`
      if (!/\.tenant\.\w+\s*\(/.test(line)) continue;
      // Skip obvious non-prisma (comments)
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

      const call = extractPrismaCall(lines, i);
      if (!call) continue;

      const movedFields = findMovedFieldsInCall(call.body);
      if (movedFields.length === 0) continue;

      // Group fields by target table
      const byTable = {};
      for (const f of movedFields) {
        const t = FIELD_TO_TABLE[f];
        if (!byTable[t]) byTable[t] = [];
        byTable[t].push(f);
      }

      fileHits.push({
        startLine: call.startLine,
        endLine: call.endLine,
        method: call.method,
        type: classifyMethod(call.method),
        byTable,
      });

      // Jump past this call to avoid re-scanning nested lines
      i = call.endLine - 1;
    }

    if (fileHits.length > 0) {
      results.push({ file, hits: fileHits });
    }
  }

  return results;
}

// Pretty print
function printResults(results) {
  if (results.length === 0) {
    console.log(
      "✅ No regressions found. All Prisma tenant.* calls are clean.",
    );
    return;
  }

  let totalHits = 0;
  console.log("━".repeat(80));
  console.log("  PHASE B REGRESSION SCAN — Tenant God Model Field Moves");
  console.log("━".repeat(80));
  console.log("");

  for (const { file, hits } of results) {
    const relPath = path
      .relative(path.resolve(__dirname, ".."), file)
      .replace(/\\/g, "/");
    console.log(`📄 ${relPath}`);
    console.log("─".repeat(80));
    for (const hit of hits) {
      totalHits++;
      const range =
        hit.startLine === hit.endLine
          ? `L${hit.startLine}`
          : `L${hit.startLine}-${hit.endLine}`;
      console.log(
        `   ${range.padEnd(14)} [${hit.type.padEnd(5)}] tenant.${hit.method}()`,
      );
      for (const [table, fields] of Object.entries(hit.byTable)) {
        console.log(`                   → ${table}: ${fields.join(", ")}`);
      }
    }
    console.log("");
  }

  console.log("━".repeat(80));
  console.log(
    `  TOTAL: ${totalHits} regression(s) across ${results.length} file(s)`,
  );
  console.log("━".repeat(80));
}

// Group summary by table
function printTableSummary(results) {
  const tableCount = {};
  const fileCount = {};

  for (const { file, hits } of results) {
    for (const hit of hits) {
      for (const [table, fields] of Object.entries(hit.byTable)) {
        tableCount[table] = (tableCount[table] || 0) + fields.length;
        if (!fileCount[table]) fileCount[table] = new Set();
        fileCount[table].add(file);
      }
    }
  }

  if (Object.keys(tableCount).length === 0) return;

  console.log("");
  console.log("  SUMMARY BY MOVED TABLE");
  console.log("─".repeat(80));
  for (const [table, count] of Object.entries(tableCount).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(
      `   ${table.padEnd(22)} ${String(count).padStart(4)} field refs across ${fileCount[table].size} file(s)`,
    );
  }
  console.log("━".repeat(80));
}

// Run
console.log("");
console.log("Scanning:", SRC_DIR);
console.log("");

const results = scan();
printResults(results);
printTableSummary(results);

// Also write to a file for easy sharing
const outputPath = path.resolve(__dirname, "regression-scan-report.txt");
let fileOutput = "";
const originalLog = console.log;
console.log = (...args) => {
  fileOutput += args.join(" ") + "\n";
};
printResults(results);
printTableSummary(results);
console.log = originalLog;
fs.writeFileSync(outputPath, fileOutput);
console.log("");
console.log(`📝 Report also saved to: scripts/regression-scan-report.txt`);
console.log("");
