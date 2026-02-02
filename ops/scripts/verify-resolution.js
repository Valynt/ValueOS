import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../");

// Initialize jiti to load TS files
const jiti = require("jiti")(__filename);

console.log(`Workspace root: ${workspaceRoot}`);

let failCount = 0;

function checkPathExists(contextName, alias, resolvedPath) {
  if (!resolvedPath) return;

  // Handle globs/suffixes if necessary (simple existence check for now)
  // If it's a directory, it should exist. If it's a file, it should exist.
  // Alias targets in vite config are usually absolute paths.

  // If the path is relative (unlikely if resolved by 'path.resolve' in config), make it absolute
  let absolutePath = resolvedPath;
  if (!path.isAbsolute(resolvedPath)) {
    // Some simple relative replacements might exist
    console.warn(
      `[WARN] [${contextName}] Alias target '${resolvedPath}' is not absolute. Skipping verification.`
    );
    return;
  }

  if (fs.existsSync(absolutePath)) {
    console.log(`[PASS] [${contextName}] ${alias} -> ${absolutePath}`);
  } else {
    console.log(`[FAIL] [${contextName}] ${alias} -> ${absolutePath}`);
    failCount++;
  }
}

async function verifyAppConfig(appName) {
  const configPath = path.join(workspaceRoot, "apps", appName, "vite.config.ts");
  if (!fs.existsSync(configPath)) {
    console.log(`[SKIP] No vite.config.ts found for ${appName}`);
    return;
  }

  console.log(`\n--- Checking ${appName} Configuration ---`);
  try {
    // Load the config
    // Intercept process.cwd() or __dirname if needed, but jiti handles __dirname well
    const mod = jiti(configPath);
    const config = mod.default || mod;

    // config can be a function or an object
    let resolvedConfig = config;
    if (typeof config === "function") {
      // Mock command/mode if necessary, though simply calling it might work
      // Some configs depend on env vars loaded by loadEnv
      try {
        resolvedConfig = await config({ command: "serve", mode: "development" });
      } catch (err) {
        console.log(
          `[WARN] Could not execute config function for ${appName}, trying static properties if any.`
        );
      }
    }

    const aliases = resolvedConfig?.resolve?.alias;

    if (!aliases) {
      console.log(`[INFO] No aliases found in ${appName}`);
      return;
    }

    // Aliases can be an object or an array
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        checkPathExists(appName, alias.find, alias.replacement);
      }
    } else {
      for (const [key, value] of Object.entries(aliases)) {
        checkPathExists(appName, key, value);
      }
    }
  } catch (e) {
    console.error(`[ERROR] Failed to load/parse config for ${appName}:`, e.message);
    failCount++;
  }
}

async function run() {
  await verifyAppConfig("ValyntApp");
  await verifyAppConfig("VOSAcademy");

  if (failCount > 0) {
    console.log(`\nFound ${failCount} resolution failures.`);
    process.exit(1);
  } else {
    console.log("\nAll checked paths resolve correctly.");
    process.exit(0);
  }
}

run();
