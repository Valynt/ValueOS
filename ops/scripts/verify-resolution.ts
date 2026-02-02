import config from "../../vitest.config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Handling __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");

console.log("🔍 Verifying path aliases from vitest.config.ts...");

async function verify() {
  const resolvedConfig = await (typeof config === "function" ? config({}) : config);

  const aliases = resolvedConfig.resolve?.alias;

  if (!aliases) {
    console.error("❌ No resolve.alias found in config.");
    process.exit(1);
  }

  let failure = false;

  console.log("Found aliases:", Object.keys(aliases).length);

  for (const [alias, aliasPath] of Object.entries(aliases)) {
    // In vitest config, path.resolve usage means these are likely absolute paths already
    // IF the config was evaluated in the context of the root.
    // However, since we are importing it, the __dirname in the CONFIG file refers to the root
    // (because the config file is in the root).
    // So the paths in `aliases` object should be correct absolute paths.

    if (typeof aliasPath !== "string") {
      console.warn(`⚠️  Skipping complex alias definition for: ${alias}`);
      continue;
    }

    if (!fs.existsSync(aliasPath)) {
      console.error(`❌ Alias Broken: "${alias}" -> ${aliasPath}`);
      failure = true;
    } else {
      console.log(`✅ ${alias} -> ${path.relative(rootDir, aliasPath)}`);
    }
  }

  if (failure) {
    console.error("\n💥 Verification FAILED: Some aliases point to non-existent paths.");
    process.exit(1);
  } else {
    console.log("\n✨ All aliases verified successfully!");
  }
}

verify().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
