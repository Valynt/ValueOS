import fs from "node:fs";
import path from "node:path";
import { resolve } from "node:path";

const workspaceRoot = process.cwd();
console.log(`Workspace root: ${workspaceRoot}`);

function checkResolution(baseDir, alias, target) {
  const fromPath = path.resolve(workspaceRoot, baseDir);
  const resolved = path.resolve(fromPath, target);
  const exists = fs.existsSync(resolved);
  console.log(`[${exists ? "PASS" : "FAIL"}] ${alias} -> ${target}`);
  console.log(`    Base: ${fromPath}`);
  console.log(`    Resolved: ${resolved}`);
  return exists;
}

console.log("--- Checking ValyntApp Aliases ---");
// Current config in ValyntApp: path.resolve(__dirname, "../packages/shared/src")
// __dirname is apps/ValyntApp
// relative is ../packages/shared/src
checkResolution("apps/ValyntApp", "@valueos/shared", "../packages/shared/src");

console.log("\n--- Checking VOSAcademy Aliases ---");
// Current config in VOSAcademy: resolve(__dirname, "packages/shared/src/const.ts")
// __dirname is apps/VOSAcademy
// relative is packages/shared/src/const.ts
checkResolution("apps/VOSAcademy", "@shared/const", "packages/shared/src/const.ts");

console.log("\n--- Checking Corrected Paths ---");
checkResolution("apps/ValyntApp", "@valueos/shared", "../../packages/shared/src");
checkResolution("apps/VOSAcademy", "@shared/const", "../../packages/shared/src/const.ts");
