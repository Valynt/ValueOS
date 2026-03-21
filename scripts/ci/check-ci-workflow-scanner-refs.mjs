#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function parseUsesRefs(workflowText) {
  return Array.from(workflowText.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gm), (match) => match[1]);
}

const manifest = JSON.parse(read("scripts/ci/security-tool-versions.json"));
const failures = [];
const workflowToExpectedRefs = new Map();

for (const { workflow, uses } of manifest.scannerActions) {
  if (workflow.endsWith("codeql.yml")) {
    continue;
  }
  const refs = workflowToExpectedRefs.get(workflow) ?? new Set();
  refs.add(uses);
  workflowToExpectedRefs.set(workflow, refs);
}

for (const [workflow, expectedRefs] of workflowToExpectedRefs.entries()) {
  const workflowContent = read(workflow);
  const usesRefs = parseUsesRefs(workflowContent);
  const scannerRepos = new Set([...expectedRefs].map((ref) => ref.split("@")[0]));
  const actualScannerRefs = usesRefs.filter((ref) => scannerRepos.has(ref.split("@")[0]));

  for (const ref of expectedRefs) {
    if (!actualScannerRefs.includes(ref)) {
      failures.push(`- Missing scanner action ref in ${workflow}: ${ref}`);
    }
  }

  for (const ref of actualScannerRefs) {
    if (!expectedRefs.has(ref)) {
      failures.push(`- Unexpected scanner action ref in ${workflow} (not in manifest): ${ref}`);
    }
  }
}

if (failures.length > 0) {
  console.error("❌ CI scanner action refs differ from scripts/ci/security-tool-versions.json:");
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`✅ CI scanner action refs match manifest across ${workflowToExpectedRefs.size} workflows`);
