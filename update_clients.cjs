const fs = require("fs");
const path = require("path");

// --- CONFIGURATION ---
// 1. Files to target (relative to repository root)
const TARGET_FILES = [
  "packages/mcp/ground-truth/clients/SECEdgarClient.ts",
  "packages/mcp/ground-truth/clients/BLSClient.ts",
  "packages/mcp/ground-truth/clients/CensusClient.ts",
];

// 2. The import line to add (Adjust the path to match your project structure if needed)
const IMPORT_STATEMENT = "import { fetchWithRetry } from './utils/fetchWithRetry';\n";

// --- MAIN LOGIC ---

TARGET_FILES.forEach((fileName) => {
  const filePath = path.join(__dirname, fileName);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Skipping ${fileName}: File not found in current directory.`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let originalContent = content;
  let modified = false;

  // 1. Add Import if missing
  // We check if 'fetchWithRetry' is already mentioned to avoid duplicate imports
  if (!content.includes("fetchWithRetry")) {
    content = IMPORT_STATEMENT + content;
    console.log(`   + Added import to ${fileName}`);
    modified = true;
  }

  // 2. Replace 'await fetch(' with 'await fetchWithRetry('
  // We use a global regex replacement
  const regex = /await fetch\(/g;

  if (regex.test(content)) {
    const matches = content.match(regex).length;
    content = content.replace(regex, "await fetchWithRetry(");
    console.log(`   + Replaced ${matches} instance(s) of 'fetch' in ${fileName}`);
    modified = true;
  }

  // 3. Save changes
  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Updated ${fileName}`);
  } else {
    console.log(`ℹ️  No changes needed for ${fileName}`);
  }
});

console.log("\n--- Automation Complete ---");
