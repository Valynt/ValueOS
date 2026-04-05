import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "../..");
const POLICY_PATH = path.join(ROOT, "config/ci/workspace-package-policy.json");
const ALLOWED_CLASSIFICATIONS = new Set([
  "production-runtime",
  "internal-library",
  "experimental",
  "archived",
]);
const ALLOWED_APP_LIFECYCLES = new Set(["active", "experimental", "archived"]);
const RELEASE_ELIGIBLE = "eligible";
const ROOT_VITEST_COVERED = "covered";
const ROOT_VITEST_EXCLUDED = "excluded";
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.split("=");
    return [key, value];
  }),
);
const mode = args.get("--mode") ?? "ci";
const publishedPackagesEnv = args.get("--published-packages-env");
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
const policyEntries = Object.entries(policy.packages ?? {}).sort(([left], [right]) => left.localeCompare(right));

function walkForPackageJsons(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const packageJsonPath = path.join(fullPath, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        results.push(packageJsonPath);
      }
      results.push(...walkForPackageJsons(fullPath));
    }
  }

  return results;
}

function listWorkspacePackages() {
  return [...walkForPackageJsons(path.join(ROOT, "apps")), ...walkForPackageJsons(path.join(ROOT, "packages"))]
    .map((packageJsonPath) => path.relative(ROOT, path.dirname(packageJsonPath)))
    .sort((left, right) => left.localeCompare(right));
}

function walkForTests(dir) {
  if (!fs.existsSync(dir)) return false;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (walkForTests(fullPath)) return true;
      continue;
    }

    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
      return true;
    }
  }

  return false;
}

function formatStatus(packageJson) {
  const scripts = packageJson.scripts ?? {};
  return {
    hasTestScript: typeof scripts.test === "string" && scripts.test.length > 0,
    hasBuildScript: typeof scripts.build === "string" && scripts.build.length > 0,
  };
}

function readPackageJson(packagePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, packagePath, "package.json"), "utf8"));
}

const workspacePackages = listWorkspacePackages();
const policyPaths = policyEntries.map(([packagePath]) => packagePath).sort((left, right) => left.localeCompare(right));
const errors = [];

if (JSON.stringify(workspacePackages) !== JSON.stringify(policyPaths)) {
  const workspaceOnly = workspacePackages.filter((packagePath) => !policyPaths.includes(packagePath));
  const policyOnly = policyPaths.filter((packagePath) => !workspacePackages.includes(packagePath));
  if (workspaceOnly.length > 0) {
    errors.push(`Workspace packages missing from policy: ${workspaceOnly.join(", ")}`);
  }
  if (policyOnly.length > 0) {
    errors.push(`Policy entries missing package.json files: ${policyOnly.join(", ")}`);
  }
}

const releaseEligiblePackages = [];
const shippedPackageSummaries = [];

for (const [packagePath, policyEntry] of policyEntries) {
  const packageJson = readPackageJson(packagePath);
  const packageMetadata = packageJson.valueos;

  if (!ALLOWED_CLASSIFICATIONS.has(policyEntry.classification)) {
    errors.push(`${packagePath}: unsupported classification ${policyEntry.classification}`);
  }

  if (!packageMetadata) {
    errors.push(`${packagePath}: missing package.json valueos metadata`);
    continue;
  }

  const expectedMetadata = {
    classification: policyEntry.classification,
    supportTier: policyEntry.supportTier,
    owner: policyEntry.owner,
    shipped: policyEntry.shipped,
    ci: policyEntry.ci,
  };
  if (typeof policyEntry.lifecycle === "string") {
    expectedMetadata.lifecycle = policyEntry.lifecycle;
  }

  if (!isDeepStrictEqual(packageMetadata, expectedMetadata)) {
    errors.push(`${packagePath}: package.json valueos metadata drifted from ${path.relative(ROOT, POLICY_PATH)}`);
  }

  if (packageJson.name !== policyEntry.name) {
    errors.push(`${packagePath}: policy name ${policyEntry.name} does not match package.json name ${packageJson.name}`);
  }

  const isWorkspaceApp = packagePath.startsWith("apps/");
  if (isWorkspaceApp) {
    if (!ALLOWED_APP_LIFECYCLES.has(policyEntry.lifecycle)) {
      errors.push(`${packagePath}: app packages must declare lifecycle in policy as one of active|experimental|archived.`);
    }

    const packageLifecycle = packageMetadata?.lifecycle;
    if (!ALLOWED_APP_LIFECYCLES.has(packageLifecycle)) {
      errors.push(`${packagePath}: package.json valueos.lifecycle must be one of active|experimental|archived.`);
    }
  }

  const { hasTestScript, hasBuildScript } = formatStatus(packageJson);
  const hasTestsOnDisk = walkForTests(path.join(ROOT, packagePath));
  const rootVitest = policyEntry.ci?.rootVitest ?? {};
  const release = policyEntry.ci?.release ?? {};
  const approvedExclusion = rootVitest.status === ROOT_VITEST_EXCLUDED && typeof rootVitest.justification === "string" && rootVitest.justification.trim().length > 0;

  if ((policyEntry.classification === "production-runtime" || policyEntry.classification === "internal-library") && !hasTestScript && !hasBuildScript && !approvedExclusion) {
    errors.push(`${packagePath}: ${policyEntry.classification} packages need a test script, build script, or documented root CI exclusion.`);
  }

  if (policyEntry.classification === "production-runtime" && !hasTestScript && !approvedExclusion) {
    errors.push(`${packagePath}: production packages must define a test script or an approved root CI exclusion.`);
  }

  if (policyEntry.shipped) {
    shippedPackageSummaries.push(`${packagePath} [${policyEntry.classification}] -> rootVitest:${rootVitest.status}`);
    if (rootVitest.status === ROOT_VITEST_COVERED && !hasTestsOnDisk) {
      errors.push(`${packagePath}: marked as root Vitest covered but no test/spec files were found.`);
    }
    if (rootVitest.status === ROOT_VITEST_EXCLUDED && !approvedExclusion) {
      errors.push(`${packagePath}: shipped packages excluded from root Vitest must document a justification.`);
    }
    if (rootVitest.status !== ROOT_VITEST_COVERED && rootVitest.status !== ROOT_VITEST_EXCLUDED) {
      errors.push(`${packagePath}: shipped packages must be root Vitest covered or explicitly excluded.`);
    }
  }

  if (release.status === RELEASE_ELIGIBLE) {
    releaseEligiblePackages.push(packageJson.name);
  }

  if (release.status !== RELEASE_ELIGIBLE && release.status !== ROOT_VITEST_EXCLUDED) {
    errors.push(`${packagePath}: release status must be eligible or excluded.`);
  }

  if (typeof release.justification !== "string" || release.justification.trim().length === 0) {
    errors.push(`${packagePath}: release status must include a justification.`);
  }

  console.log(
    `${packagePath.padEnd(36)} | ${policyEntry.classification.padEnd(17)} | shipped=${String(policyEntry.shipped).padEnd(5)} | testScript=${String(hasTestScript).padEnd(5)} | buildScript=${String(hasBuildScript).padEnd(5)} | rootVitest=${rootVitest.status}`,
  );
}

if (mode === "release" && publishedPackagesEnv) {
  const publishedPackages = JSON.parse(process.env[publishedPackagesEnv] ?? "[]");
  const publishedNames = publishedPackages.map((entry) => entry.name);
  const unexpected = publishedNames.filter((name) => !releaseEligiblePackages.includes(name));
  if (unexpected.length > 0) {
    errors.push(`Release automation attempted to publish packages excluded by policy: ${unexpected.join(", ")}`);
  }
}

console.log(`\nShipped packages tracked by root Vitest/exclusion policy: ${shippedPackageSummaries.length}`);
for (const summary of shippedPackageSummaries) {
  console.log(`- ${summary}`);
}

console.log(`\nRelease-eligible packages: ${releaseEligiblePackages.join(", ") || "none"}`);

if (errors.length > 0) {
  console.error("\n❌ Workspace package governance policy violations:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("\n✅ Workspace package governance policy is valid.");
