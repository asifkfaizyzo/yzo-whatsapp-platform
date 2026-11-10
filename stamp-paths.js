import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const CONFIG = {
  projectRoot: 'Q:/YourZeroesAndOnes/SudoReply/yzo-whatsapp-platform',
  // Target directories relative to projectRoot
  targets: [
    'backend/src'
  ],
  // Directories/files to skip entirely
  ignore: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'generated',
    'uploads',
    'static',
    'assets'
  ]
};

// Comment style mapper
const COMMENT_MAP = {
  // Slashes
  '.js': { start: '// ', end: '' },
  '.jsx': { start: '// ', end: '' },
  '.ts': { start: '// ', end: '' },
  '.tsx': { start: '// ', end: '' },
  '.mjs': { start: '// ', end: '' },
  '.cjs': { start: '// ', end: '' },
  '.prisma': { start: '// ', end: '' },
  '.sql': { start: '-- ', end: '' },
  // Block Comments
  '.css': { start: '/* ', end: ' */' },
  '.scss': { start: '/* ', end: ' */' },
  '.sass': { start: '/* ', end: ' */' },
  '.less': { start: '/* ', end: ' */' },
  // Markup / Docs
  '.html': { start: '<!-- ', end: ' -->' },
  '.xml': { start: '<!-- ', end: ' -->' },
  '.md': { start: '<!-- ', end: ' -->' },
  '.svg': { start: '<!-- ', end: ' -->' },
  '.vue': { start: '<!-- ', end: ' -->' },
  // Hashes
  '.env': { start: '# ', end: '' },
  '.yml': { start: '# ', end: '' },
  '.yaml': { start: '# ', end: '' },
  '.py': { start: '# ', end: '' },
  '.sh': { start: '# ', end: '' },
  '.gitignore': { start: '# ', end: '' },
};

// Helper to determine comment syntax for a given file
function getCommentSyntax(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (COMMENT_MAP[ext]) return COMMENT_MAP[ext];

  const basename = path.basename(filepath).toLowerCase();
  if (basename.startsWith('.env')) return { start: '# ', end: '' };
  if (basename === 'dockerfile') return { start: '# ', end: '' };
  return null;
}

// --- NEW: Detect whether a line is a stale or current path comment ---
function isPathComment(line, syntax) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 1. The sentinel comment from this script (always remove)
  if (trimmed.includes('(do not remove this comment)')) return true;

  // 2. Strip comment markers to inspect the inner content
  let inner = '';

  if (syntax.end) {
    // Block comment  e.g.  /* backend/src/foo.js */
    const startMarker = syntax.start.trim(); // '/*' or '<!--'
    const endMarker = syntax.end.trim();     // '*/' or '-->'
    if (trimmed.startsWith(startMarker) && trimmed.endsWith(endMarker)) {
      inner = trimmed.slice(startMarker.length, -endMarker.length).trim();
    } else {
      return false;
    }
  } else {
    // Line comment  e.g.  // backend/src/foo.js
    const prefix = syntax.start.trim(); // '//' or '#' or '--'
    if (trimmed.startsWith(prefix)) {
      inner = trimmed.slice(prefix.length).trim();
    } else {
      return false;
    }
  }

  // 3. Does the inner text look like a bare relative file path?
  //    Only word chars, hyphens, dots, and slashes — must contain / and .
  //    This safely ignores lines like:
  //      // NOTE: batch route MUST be before /:file_id
  //      // POST /cadmin/files/batch
  //      // import something from './foo'
  if (/^[\w\-./]+$/.test(inner) && inner.includes('/') && inner.includes('.')) {
    return true;
  }

  return false;
}

// Check for command line flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');

if (isDryRun) {
  console.log('\x1b[33m%s\x1b[0m', '✨ Running in DRY-RUN mode. No files will be modified. ✨\n');
}

// Convert absolute to relative path (uniform forward slashes)
function getRelativePath(absolutePath) {
  const relative = path.relative(CONFIG.projectRoot, absolutePath);
  return relative.split(path.sep).join('/');
}

// Recursive directory scan
function getFilesRecursively(dir) {
  let filesList = [];
  if (!fs.existsSync(dir)) {
    console.warn(`\x1b[33mWarning: Directory not found: ${dir}\x1b[0m`);
    return filesList;
  }

  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (CONFIG.ignore.includes(item)) continue;

    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      filesList = filesList.concat(getFilesRecursively(fullPath));
    } else {
      filesList.push(fullPath);
    }
  }
  return filesList;
}

function processFile(filePath) {
  const relativePath = getRelativePath(filePath);
  const syntax = getCommentSyntax(filePath);

  if (!syntax) {
    return { status: 'skipped', reason: 'unsupported file type' };
  }

  let fileContent = '';
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return { status: 'error', reason: `could not read file: ${error.message}` };
  }

  const lines = fileContent.split(/\r?\n/);
  let commentRemoved = false;
  let linesToKeep = [...lines];

  // --- FIXED: scan first 5 lines BACKWARDS, remove ALL stale path comments ---
  const checkLimit = Math.min(5, linesToKeep.length);
  for (let i = checkLimit - 1; i >= 0; i--) {
    if (isPathComment(linesToKeep[i], syntax)) {
      linesToKeep.splice(i, 1);
      commentRemoved = true;
    }
  }

  // Construct the new comment
  const newComment = `${syntax.start}${relativePath} (do not remove this comment)${syntax.end}`;

  // Respect shebang lines
  let insertIndex = 0;
  if (linesToKeep[0] && linesToKeep[0].startsWith('#!')) {
    insertIndex = 1;
  }

  linesToKeep.splice(insertIndex, 0, newComment);
  const updatedContent = linesToKeep.join('\n');

  if (!isDryRun) {
    try {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
    } catch (error) {
      return { status: 'error', reason: `could not write file: ${error.message}` };
    }
  }

  return {
    status: 'success',
    action: commentRemoved ? 'updated comment' : 'added comment',
    path: relativePath
  };
}

// --- Main execution block ---
function run() {
  console.log(`🚀 Starting comment scanner inside: ${CONFIG.projectRoot}\n`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const targetDir of CONFIG.targets) {
    const targetFullPath = path.join(CONFIG.projectRoot, targetDir);
    console.log(`📂 Scanning directory: \x1b[36m${targetDir}\x1b[0m`);

    const files = getFilesRecursively(targetFullPath);

    for (const file of files) {
      const result = processFile(file);

      if (result.status === 'success') {
        totalProcessed++;
        totalUpdated++;
        console.log(`  \x1b[32m✔\x1b[0m [${result.action.toUpperCase()}] ${result.path}`);
      } else if (result.status === 'error') {
        totalErrors++;
        console.log(`  \x1b[31m✖\x1b[0m [ERROR] ${getRelativePath(file)}: ${result.reason}`);
      }
    }
  }

  console.log(`\n\x1b[32m%s\x1b[0m`, `🏁 Done! Processed files: ${totalProcessed} | Errors encountered: ${totalErrors}`);
}

run();