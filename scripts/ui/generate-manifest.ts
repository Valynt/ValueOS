import * as fs from "fs";
import * as path from "path";

interface ManifestEntry {
  name: string;
  path: string;
}

interface UiManifest {
  generatedAt: string;
  components: ManifestEntry[];
}

const baseDir = path.resolve(process.cwd(), "apps/ValyntApp/src");
const outputPath = path.resolve(process.cwd(), "ui-manifest.json");

function walkDirectory(dir: string, results: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }

      walkDirectory(fullPath, results);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }

  return results;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function getComponentName(filePath: string): string {
  const parsed = path.parse(filePath);
  if (parsed.name === "index") {
    return path.basename(parsed.dir);
  }

  return parsed.name;
}

function generateManifest(): UiManifest {
  if (!fs.existsSync(baseDir)) {
    throw new Error(`Base directory not found: ${baseDir}`);
  }

  const files = walkDirectory(baseDir);
  const components = files
    .map((filePath) => ({
      name: getComponentName(filePath),
      path: toPosixPath(path.relative(baseDir, filePath)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    components,
  };
}

const manifest = generateManifest();
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
console.log(`✅ UI manifest written to ${outputPath}`);
