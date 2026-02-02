import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../");

console.log(`Workspace root: ${workspaceRoot}`);

let failCount = 0;

function checkPath(contextName, basePath, alias, relativeTarget) {
  const fromPath = path.resolve(workspaceRoot, basePath);
  const resolved = path.resolve(fromPath, relativeTarget);
  // Handle globs roughly by stripping /*
  const cleanTarget = relativeTarget.replace(/\/\*$/, "");
  const cleanResolved = resolved.replace(/\/\*$/, "");

  const exists = fs.existsSync(cleanResolved);

  if (exists) {
    console.log(`[PASS] [${contextName}] ${alias} -> ${cleanTarget}`);
  } else {
    console.log(`[FAIL] [${contextName}] ${alias} -> ${cleanTarget}`);
    console.log(`       Base: ${fromPath}`);
    console.log(`       Resolved: ${cleanResolved}`);
    failCount++;
  }
}

// Check Root TSConfig mappings (simulation)
console.log("\n--- Checking Root Path Assumptions ---");
checkPath("Root", ".", "@valueos/shared", "packages/shared/src"); // Expect directory or index
checkPath("Root", ".", "@valueos/design-system", "packages/components/design-system/src");

// Check ValyntApp Vite Config
console.log("\n--- Checking ValyntApp Configuration ---");
// Intended: ../../packages/shared/src
checkPath("ValyntApp", "apps/ValyntApp", "@valueos/shared", "../../packages/shared/src");

// Check VOSAcademy Vite Config (Local & Root fallback)
console.log("\n--- Checking VOSAcademy Configuration ---");
checkPath("VOSAcademy", "apps/VOSAcademy", "@shared/const", "packages/shared/src/const.ts");

if (failCount > 0) {
  console.log(`\nFound ${failCount} resolution failures.`);
  process.exit(1);
} else {
  console.log("\nAll checked paths resolve correctly.");
  process.exit(0);
}
