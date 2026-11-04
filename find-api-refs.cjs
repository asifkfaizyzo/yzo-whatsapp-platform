// find-api-refs.cjs
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SEARCH_DIRS = [
  path.join(ROOT, 'backend', 'src'),
  path.join(ROOT, 'backend', '.env'),
  path.join(ROOT, 'backend', '.env.example'),
  path.join(ROOT, 'tenant-web', 'src'),
  path.join(ROOT, 'tenant-web', '.env'),
  path.join(ROOT, 'admin-web', 'src'),
  path.join(ROOT, 'admin-web', '.env'),
];

const SKIP = ['node_modules', '.git', 'migrations'];
const EXTS = ['.js', '.jsx', '.ts', '.tsx', '.env', '.cjs', '.mjs', '.html'];

function walk(target) {
  try {
    const stat = fs.statSync(target);
    if (stat.isFile()) return [target];
    const results = [];
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (SKIP.some(s => entry.name.includes(s))) continue;
      const full = path.join(target, entry.name);
      if (entry.isDirectory()) results.push(...walk(full));
      else if (EXTS.some(e => entry.name.endsWith(e))) results.push(full);
    }
    return results;
  } catch {
    return [];
  }
}

const files = SEARCH_DIRS.flatMap(d => walk(d));

// ── Patterns ──
// 1. Numbered APIs (unambiguous)
const NUMBERED = /\/api[2-9](?:\/|['"`\s,;)\]}]|$)/;
// 2. Bare /api as route mount or URL path (NOT followed by digit, NOT part of VITE_API_URL etc)
const BARE_API = /(?:app\.use\s*\(\s*['"`]\/api['"`]|['"`]\/api['"`]|['"`]\/api\/|}\s*\/api\/|\/api\/refresh|\/api\/login|\/api\/register|\/api\/zoho|\/api\/auth\/|\/api\/webhook\/)/;
// 3. Template literal patterns like ${URL}/api2
const TEMPLATE = /\$\{[^}]+\}\/api\d?/;

const report = {};

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip file-path header comments
    if (/do not remove this comment/.test(line)) continue;

    let match = null;
    if (NUMBERED.test(line)) match = 'NUMBERED';
    else if (BARE_API.test(line)) match = 'BARE /api';
    else if (TEMPLATE.test(line)) match = 'TEMPLATE';

    if (match) {
      hits.push({ line: i + 1, type: match, content: line.trim().substring(0, 150) });
    }
  }

  if (hits.length > 0) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    report[rel] = hits;
  }
}

// ── Print ──
let totalHits = 0;
const grouped = { backend: [], 'tenant-web': [], 'admin-web': [] };

for (const [file, hits] of Object.entries(report).sort()) {
  const project = file.startsWith('backend') ? 'backend' : file.startsWith('tenant') ? 'tenant-web' : 'admin-web';
  grouped[project].push({ file, hits });
  totalHits += hits.length;
}

for (const [project, entries] of Object.entries(grouped)) {
  if (entries.length === 0) continue;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${project.toUpperCase()} (${entries.length} files)`);
  console.log('═'.repeat(60));
  for (const { file, hits } of entries) {
    console.log(`\n  📄 ${file} (${hits.length} hits)`);
    for (const h of hits) {
      console.log(`     L${String(h.line).padStart(4)} [${h.type}] ${h.content}`);
    }
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`  TOTAL: ${Object.keys(report).length} files, ${totalHits} hits`);
console.log('─'.repeat(60));