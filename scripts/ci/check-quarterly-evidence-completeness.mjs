#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INDEX_PATH = resolve("docs/security-compliance/evidence-index.md");
const REQUIRED_SECTION_TITLE = "## Quarterly evidence completeness (CI-required artifacts)";

const markdown = readFileSync(INDEX_PATH, "utf8");
const sectionStart = markdown.indexOf(REQUIRED_SECTION_TITLE);

if (sectionStart === -1) {
  console.error(`Missing required section in evidence index: ${REQUIRED_SECTION_TITLE}`);
  process.exit(1);
}

const sectionBody = markdown.slice(sectionStart + REQUIRED_SECTION_TITLE.length);
const nextHeadingMatch = sectionBody.match(/\n##\s+/);
const bounded = nextHeadingMatch ? sectionBody.slice(0, nextHeadingMatch.index) : sectionBody;

const requiredArtifacts = Array.from(bounded.matchAll(/`([^`]+)`/g), (match) => match[1])
  .filter((candidate) => candidate.includes("/"));

if (requiredArtifacts.length === 0) {
  console.error("No required artifacts found in quarterly evidence completeness section.");
  process.exit(1);
}

const failures = [];

for (const artifact of requiredArtifacts) {
  const artifactPath = resolve(artifact);
  if (!existsSync(artifactPath)) {
    failures.push(`MISSING ${artifact}`);
    continue;
  }

  const stats = statSync(artifactPath);
  if (!stats.isFile()) {
    failures.push(`NOT_A_FILE ${artifact}`);
    continue;
  }

  if (stats.size <= 0) {
    failures.push(`EMPTY ${artifact}`);
  }
}

if (failures.length > 0) {
  console.error("Quarterly evidence completeness gate failed:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log(`Quarterly evidence completeness gate passed (${requiredArtifacts.length} artifacts verified).`);
