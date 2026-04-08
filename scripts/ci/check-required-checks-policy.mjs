import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const policyPath = path.join(repoRoot, ".github/branch-protection/required-checks.json");
const readmePath = path.join(repoRoot, ".github/workflows/README.md");
const readmeStartMarker = "<!-- REQUIRED_CHECKS:START -->";
const readmeEndMarker = "<!-- REQUIRED_CHECKS:END -->";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeRequiredChecks(policy) {
  const normalized = {};

  for (const [branch, checks] of Object.entries(policy.requiredChecksByBranch ?? {})) {
    normalized[branch] = checks.map((entry) => {
      const hasScope = typeof entry.scope === "string" && entry.scope.trim().length > 0;
      return hasScope ? `${entry.check} (${entry.scope})` : entry.check;
    });
  }

  for (const [tagPattern, checks] of Object.entries(policy.requiredChecksByTag ?? {})) {
    normalized[tagPattern] = checks.map((entry) => {
      const hasScope = typeof entry.scope === "string" && entry.scope.trim().length > 0;
      return hasScope ? `${entry.check} (${entry.scope})` : entry.check;
    });
  }

  return normalized;
}

function extractReadmeRequiredChecks(readmeContents) {
  const startIndex = readmeContents.indexOf(readmeStartMarker);
  const endIndex = readmeContents.indexOf(readmeEndMarker);

  assert(startIndex !== -1, `Missing ${readmeStartMarker} marker in .github/workflows/README.md.`);
  assert(endIndex !== -1, `Missing ${readmeEndMarker} marker in .github/workflows/README.md.`);
  assert(endIndex > startIndex, "Required-check markers are in invalid order in .github/workflows/README.md.");

  const section = readmeContents
    .slice(startIndex + readmeStartMarker.length, endIndex)
    .trim();

  const jsonMatch = section.match(/```json\s*([\s\S]*?)\s*```/);
  assert(jsonMatch, "Required-check README section must include a fenced ```json block.");

  return JSON.parse(jsonMatch[1]);
}

function isEqualJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const [policyRaw, readmeRaw] = await Promise.all([
    readFile(policyPath, "utf8"),
    readFile(readmePath, "utf8"),
  ]);

  const policy = JSON.parse(policyRaw);
  const expectedReadmeSnapshot = normalizeRequiredChecks(policy);
  const actualReadmeSnapshot = extractReadmeRequiredChecks(readmeRaw);

  assert(
    isEqualJson(actualReadmeSnapshot, expectedReadmeSnapshot),
    [
      "Required-check policy drift detected.",
      "Update .github/workflows/README.md REQUIRED_CHECKS block to match .github/branch-protection/required-checks.json.",
      `Expected: ${JSON.stringify(expectedReadmeSnapshot, null, 2)}`,
      `Actual: ${JSON.stringify(actualReadmeSnapshot, null, 2)}`,
    ].join("\n"),
  );

  console.log("✅ Required-check policy matches .github/workflows/README.md.");
}

await main();
