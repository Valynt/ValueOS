import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const workflowPath = ".github/workflows/ci.yml";
const governanceCommand = "pnpm run typecheck:signal --verify";
const ciVerifyCommand = "pnpm run ci:verify";
const selfCheckCommand = "pnpm run ci:governance:self-check";

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const packageJson = await readJson("package.json");
  const scripts = packageJson.scripts ?? {};

  assert(
    scripts["typecheck:signal"] === "tsx scripts/dx/typecheck-telemetry.ts",
    'package.json must define "typecheck:signal" as "tsx scripts/dx/typecheck-telemetry.ts".',
  );

  assert(
    scripts["ci:governance:self-check"] ===
      "node scripts/ci/check-canonical-ci-entrypoint.mjs",
    'package.json must define "ci:governance:self-check" as the canonical workflow self-check entry point.',
  );

  assert(
    typeof scripts["ci:verify"] === "string" && scripts["ci:verify"].length > 0,
    'package.json must define "ci:verify".',
  );
  assert(
    scripts["ci:verify"].includes(governanceCommand),
    `"ci:verify" must include "${governanceCommand}" as a blocking governance gate.`,
  );
  assert(
    scripts["ci:verify"].includes(selfCheckCommand),
    `"ci:verify" must include "${selfCheckCommand}" so workflow/docs drift is checked transitively.`,
  );

  const workflowContents = await readFile(
    path.join(repoRoot, workflowPath),
    "utf8",
  );
  const referencesCanonicalCommand =
    workflowContents.includes(ciVerifyCommand) ||
    workflowContents.includes(governanceCommand);

  assert(
    referencesCanonicalCommand,
    `${workflowPath} must reference either "${ciVerifyCommand}" or "${governanceCommand}".`,
  );

  console.log(
    `✅ Canonical CI entry point contract verified for ${workflowPath}.`,
  );
}

await main();
