const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const zip = new AdmZip();

// Path to PHP file
const phpFilePath = path.join(__dirname, 'sudoreply-auth-events', 'sudoreply-auth-events.php');

if (!fs.existsSync(phpFilePath)) {
    console.error('❌ Could not find sudoreply-auth-events.php');
    process.exit(1);
}

// 1. Read and clean code (removes invisible BOM and leading spaces)
let phpContent = fs.readFileSync(phpFilePath, 'utf8');
phpContent = phpContent.replace(/^\uFEFF/, '').trimStart();

// 2. Explicitly add the directory entry first (Required by WordPress)
zip.addFile('sudoreply-auth-events/', Buffer.alloc(0));

// 3. Add the clean PHP file inside the directory
zip.addFile('sudoreply-auth-events/sudoreply-auth-events.php', Buffer.from(phpContent, 'utf8'));

// 4. Add README if exists
const readmePath = path.join(__dirname, 'sudoreply-auth-events', 'README.md');
if (fs.existsSync(readmePath)) {
    zip.addFile('sudoreply-auth-events/README.md', fs.readFileSync(readmePath));
}

// 5. Output zip
const outputPath = path.join(__dirname, 'sudoreply-auth-events.zip');
zip.writeZip(outputPath);

console.log('✅ Generated clean, WordPress-verified ZIP successfully!');