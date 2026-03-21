import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const governanceCommand = "pnpm run typecheck:signal --verify";
const ciVerifyCommand = "pnpm run ci:verify";

const requiredWorkflows = [
  ".github/workflows/pr-fast.yml",
  ".github/workflows/main-verify.yml",
];

const optionalWorkflows = [
  ".github/workflows/nightly-governance.yml",
  ".github/workflows/test.yml",
  ".github/workflows/deploy.yml",
  ".github/workflows/release.yml",
];

async function checkCiVerifyContract() {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const ciVerifyScript = packageJson?.scripts?.["ci:verify"];

  if (ciVerifyScript && !ciVerifyScript.includes(governanceCommand)) {
    throw new Error(`package.json script "ci:verify" must include "${governanceCommand}" as a blocking governance gate.`);
  }
}

async function checkWorkflowGates(workflows, { optional = false } = {}) {
  const failures = [];
  const skipped = [];

  for (const workflow of workflows) {
    const workflowPath = path.join(repoRoot, workflow);
    let content;

    try {
      content = await readFile(workflowPath, "utf8");
    } catch (error) {
      if (optional && error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        skipped.push(workflow);
        continue;
      }
      throw error;
    }

    const hasCiVerify = content.includes(ciVerifyCommand);
    const hasDirectGovernance = content.includes(governanceCommand);

    if (!hasCiVerify && !hasDirectGovernance) {
      failures.push(`${workflow} (missing "${ciVerifyCommand}" or "${governanceCommand}")`);
    }
  }

  if (!optional && failures.length > 0) {
    throw new Error(`Governance gate missing in required workflows:\n- ${failures.join("\n- ")}`);
  }

  return { failures, skipped };
}

await checkCiVerifyContract();
await checkWorkflowGates(requiredWorkflows);
const { failures: optionalFailures, skipped: skippedOptionalWorkflows } = await checkWorkflowGates(optionalWorkflows, { optional: true });

if (optionalFailures.length > 0) {
  console.log(`ℹ️ Optional workflows without governance gate: ${optionalFailures.join(", ")}`);
}

if (skippedOptionalWorkflows.length > 0) {
  console.log(`ℹ️ Skipped missing optional workflows: ${skippedOptionalWorkflows.join(", ")}`);
}

console.log("✅ Governance gate contract verified for required workflows.");
