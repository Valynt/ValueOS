import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const policyPath = path.join(repoRoot, ".github/branch-protection/required-checks.json");
const workflowReadmePath = path.join(repoRoot, ".github/workflows/README.md");
const workflowMap = {
  "pr-fast": ".github/workflows/pr-fast.yml",
  "staging-deploy-release-gates": ".github/workflows/main-verify.yml",
  codeql: ".github/workflows/codeql.yml",
  "infra-plan": ".github/workflows/terraform.yml",
};

function asIsoDate(date) {
  return date.toISOString();
}

function checkWorkflowContainsCheckName(content, checkName) {
  const explicitName = `name: ${checkName}`;
  const jobIdLine = `${checkName}:`;
  return content.includes(explicitName) || content.includes(jobIdLine);
}

function extractReadmeSection(content) {
  const startMarker = "<!-- REQUIRED_CHECKS:START -->";
  const endMarker = "<!-- REQUIRED_CHECKS:END -->";
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("README required-check markers are missing or malformed.");
  }

  return content.slice(start + startMarker.length, end).trim();
}

async function main() {
  const generatedAt = asIsoDate(new Date());
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const workflowReadme = await readFile(workflowReadmePath, "utf8");

  const results = [];
  const allChecks = new Set();

  for (const checks of Object.values(policy.requiredChecksByBranch ?? {})) {
    for (const entry of checks) {
      allChecks.add(entry.check);
    }
  }

  for (const checkName of [...allChecks].sort()) {
    const workflowRelativePath = workflowMap[checkName];

    if (!workflowRelativePath) {
      results.push({
        check: checkName,
        status: "non-compliant",
        reason: "No workflow mapping configured in report-required-check-compliance.mjs.",
      });
      continue;
    }

    const workflowContents = await readFile(path.join(repoRoot, workflowRelativePath), "utf8");
    const foundInWorkflow = checkWorkflowContainsCheckName(workflowContents, checkName);

    results.push({
      check: checkName,
      workflow: workflowRelativePath,
      status: foundInWorkflow ? "compliant" : "non-compliant",
      reason: foundInWorkflow ? "Required check name found in workflow." : "Required check name missing from workflow.",
    });
  }

  const readmeSection = extractReadmeSection(workflowReadme);
  const hasCodeqlInReadme = readmeSection.includes('"codeql"');

  results.push({
    check: "README required-check snapshot",
    workflow: ".github/workflows/README.md",
    status: hasCodeqlInReadme ? "compliant" : "non-compliant",
    reason: hasCodeqlInReadme
      ? "README required-check section includes codeql."
      : "README required-check section does not include codeql.",
  });

  const compliantCount = results.filter((item) => item.status === "compliant").length;
  const nonCompliantCount = results.length - compliantCount;
  const overallStatus = nonCompliantCount === 0 ? "compliant" : "non-compliant";

  const reportJson = {
    generatedAt,
    overallStatus,
    compliantCount,
    nonCompliantCount,
    results,
  };

  const reportMarkdown = [
    "# Weekly required-check enforcement compliance",
    "",
    `- Generated at (UTC): ${generatedAt}`,
    `- Overall status: **${overallStatus}**`,
    `- Compliant checks: ${compliantCount}`,
    `- Non-compliant checks: ${nonCompliantCount}`,
    "",
    "| Check | Workflow | Status | Notes |",
    "|---|---|---|---|",
    ...results.map((item) => `| ${item.check} | ${item.workflow ?? "n/a"} | ${item.status} | ${item.reason} |`),
    "",
    "This artifact is produced by `scripts/ci/report-required-check-compliance.mjs` for governance review.",
  ].join("\n");

  const outputDir = path.join(repoRoot, "artifacts/governance");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "required-check-enforcement-weekly.json"), `${JSON.stringify(reportJson, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "required-check-enforcement-weekly.md"), `${reportMarkdown}\n`, "utf8");

  if (overallStatus !== "compliant") {
    throw new Error(`Required-check enforcement report found ${nonCompliantCount} non-compliant item(s).`);
  }

  console.log("✅ Weekly required-check enforcement report generated.");
}

await main();
