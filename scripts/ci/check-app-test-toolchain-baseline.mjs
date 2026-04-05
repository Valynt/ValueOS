import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APPS_DIR = path.join(ROOT, "apps");

const BASELINE = Object.freeze({
  vite: 5,
  vitest: 3,
  "@vitejs/plugin-react": 5,
  "@vitest/coverage-v8": 3,
  "@vitest/coverage-istanbul": 3,
});

function extractMajor(versionRange) {
  if (typeof versionRange !== "string") return null;
  const majorMatch = versionRange.match(/\d+/);
  if (!majorMatch) return null;
  return Number(majorMatch[0]);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listAppPackageJsons() {
  if (!fs.existsSync(APPS_DIR)) return [];

  return fs
    .readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(APPS_DIR, entry.name, "package.json"))
    .filter((packageJsonPath) => fs.existsSync(packageJsonPath))
    .sort((left, right) => left.localeCompare(right));
}

const errors = [];
const rows = [];

for (const packageJsonPath of listAppPackageJsons()) {
  const packageJson = readJson(packageJsonPath);
  const appPath = path.relative(ROOT, path.dirname(packageJsonPath));
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };

  for (const [dependencyName, expectedMajor] of Object.entries(BASELINE)) {
    if (!Object.hasOwn(dependencies, dependencyName)) continue;

    const configuredVersion = dependencies[dependencyName];
    const configuredMajor = extractMajor(configuredVersion);

    rows.push(`${appPath}: ${dependencyName}@${configuredVersion}`);

    if (configuredMajor === null) {
      errors.push(`${appPath}: unable to parse ${dependencyName} major from \"${String(configuredVersion)}\".`);
      continue;
    }

    if (configuredMajor !== expectedMajor) {
      errors.push(
        `${appPath}: unsupported ${dependencyName}@${configuredVersion}. Expected major ${expectedMajor} baseline.`,
      );
    }
  }
}

console.log("App test-toolchain dependency inventory:");
for (const row of rows) {
  console.log(`- ${row}`);
}

if (errors.length > 0) {
  console.error("\n❌ App test-toolchain baseline violations:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("\n✅ App manifests match the workspace Vite/Vitest baseline.");
