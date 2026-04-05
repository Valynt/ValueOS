import { readFile } from "node:fs/promises";
import path from "node:path";

const packageJsonPath = path.join(process.cwd(), "package.json");

try {
  const contents = await readFile(packageJsonPath, "utf8");
  JSON.parse(contents);
  console.log("✅ package.json parses successfully.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ package.json parse check failed: ${message}`);
  process.exit(1);
}
