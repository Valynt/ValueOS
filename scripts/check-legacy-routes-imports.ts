import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const valyntSrc = path.join(repoRoot, "apps", "ValyntApp", "src");
const legacyRoutesFile = path.join(
  valyntSrc,
  "routes",
  "_legacy",
  "routes.placeholder.tsx"
);

const importPattern = /routes\/_legacy\/routes\.placeholder/;

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function main() {
  const files = await walk(valyntSrc);
  const offenders: string[] = [];

  for (const file of files) {
    if (file === legacyRoutesFile) {
      continue;
    }

    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
      continue;
    }

    const contents = await readFile(file, "utf-8");
    if (importPattern.test(contents)) {
      offenders.push(path.relative(repoRoot, file));
    }
  }

  if (offenders.length > 0) {
    console.error(
      "Found imports of routes/_legacy/routes.placeholder.tsx. This file is not active and must not be wired without security review."
    );
    offenders.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
  }

  console.log(
    "✅ No imports of routes/_legacy/routes.placeholder.tsx detected."
  );
}

main().catch((error) => {
  console.error("Legacy routes import check failed:", error);
  process.exit(1);
});
