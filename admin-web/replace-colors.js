import fs from 'fs';
import path from 'path';

// Your core brand color: RGB(18, 94, 242) -> #125EF2
const BRAND_BLUE = '#125EF2';

// Mathematically matched shades for your design system
const blueShades = {
  '50': '#EAF2FE',   // Extremely light (bg-emerald-50)
  '100': '#CFE0FD',  // Light tint (bg-emerald-100)
  '200': '#CFE0FD',
  '300': '#A0C2FA',
  '400': '#125EF2',  
  '500': '#125EF2',  // Brand Main (RGB 18, 94, 242)
  '600': '#125EF2',  // Brand Main
  '700': '#0F4FCC',  // Darker Blue for hover/border
  '800': '#0D47A1',  // Darkest Blue for text
  '900': '#0A3780',
  '950': '#051C40',
};

// Exact HEX replacements (for inline styles or SVG colors)
const hexReplacements = [
  ['#10b981', BRAND_BLUE], // Emerald-500
  ['#10B981', BRAND_BLUE],
  ['#059669', BRAND_BLUE], // Emerald-600
  ['#34d399', '#A0C2FA'], // Emerald-400
  ['#047857', '#0F4FCC'], // Emerald-700
  ['#14b8a6', BRAND_BLUE], // Teal-500
  // ['#22c55e', BRAND_BLUE], // Green-500
];

function getAllFiles(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;

  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== ".next" && file !== "dist") {
        files = files.concat(getAllFiles(fullPath));
      }
    } else {
      const ext = path.extname(file);
      if ([".jsx", ".tsx", ".js", ".ts", ".css"].includes(ext)) {
        files.push(fullPath);
      }
    }
  });
  return files;
}

const targetDirectory = "./src";
console.log(`\n🔍 Scanning directory: ${path.resolve(targetDirectory)}`);

const files = getAllFiles(targetDirectory);
console.log(`📁 Found ${files.length} matchable files (.js, .ts, .jsx, .tsx, .css)\n`);

let totalChanges = 0;
let updatedFilesCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  let originalContent = content;
  let fileChanges = 0;

  // 1. SMART REGEX REPLACEMENT:
  // Matches Tailwind structures like bg-emerald-500, hover:text-teal-700, border-green-100, etc.

  // const tailwindRegex = /\b(bg|text|border|from|to|ring|focus:ring|hover:bg|hover:text|hover:border|hover:from|hover:to)-(emerald|teal|green)-(\d+)\b/g;
  
  const tailwindRegex = /\b(bg|text|border|from|to|ring|focus:ring|hover:bg|hover:text|hover:border|hover:from|hover:to)-(emerald|teal)-(\d+)\b/g;

  content = content.replace(tailwindRegex, (match, prefix, color, weight) => {
    const targetBlueHex = blueShades[weight] || BRAND_BLUE;
    fileChanges++;
    return `${prefix}-[${targetBlueHex}]`;
  });

  // 2. HEX CODE REPLACEMENT:
  hexReplacements.forEach(([oldHex, newHex]) => {
    if (content.includes(oldHex)) {
      const occurrences = content.split(oldHex).length - 1;
      content = content.split(oldHex).join(newHex);
      fileChanges += occurrences;
    }
  });

  // 3. SPECIAL CUSTOM CASES (from your original list):
  const customReplacements = [
    ["bg-emerald-55/10", "bg-[#EAF2FE]"],
    ["hover:border-emerald-200", "hover:border-[#CFE0FD]"],
  ];

  customReplacements.forEach(([find, replace]) => {
    if (content.includes(find)) {
      const occurrences = content.split(find).length - 1;
      content = content.split(find).join(replace);
      fileChanges += occurrences;
    }
  });

  // Save changes if any were made
  if (content !== originalContent) {
    fs.writeFileSync(file, content, "utf8");
    updatedFilesCount++;
    totalChanges += fileChanges;
    console.log(`✅ Updated: ${path.relative(targetDirectory, file)} (${fileChanges} replacements)`);
  }
});

console.log("\n=================================");
console.log(`🎉 COLOR REPLACEMENT COMPLETE!`);
console.log(`📁 Files Updated: ${updatedFilesCount}`);
console.log(`🔄 Total Replacements Made: ${totalChanges}`);
console.log(`🎨 Brand Color Applied: ${BRAND_BLUE} (RGB 18, 94, 242)`);
console.log("=================================\n");