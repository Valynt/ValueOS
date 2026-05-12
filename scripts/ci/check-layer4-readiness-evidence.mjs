#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOC_PATH = 'docs/security-compliance/layer4-governance-drift-readiness.md';
const ARCH_GATE_COMMAND = 'node scripts/ci/check-architecture-doc-drift.mjs';
const RELEASE_GATE_MANIFEST = 'scripts/ci/release-gate-manifest.json';
const REQUIRED_DOCS = [
  DOC_PATH,
  'docs/observability/governance-drift-alerts.md',
  'docs/operations/runbooks/governance-drift.md',
  'docs/security-compliance/drift-gate-evidence.md',
];
const REQUIRED_TEST_TARGET = 'pnpm test -- packages/backend/src/lib/__tests__/rules.test.ts';

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function toRepoPath(fromDoc, rawLink) {
  if (rawLink.startsWith('http://') || rawLink.startsWith('https://') || rawLink.startsWith('#')) {
    return null;
  }
  const clean = rawLink.replace(/[#?].*$/, '');
  if (!clean) return null;
  return path.normalize(path.join(path.dirname(fromDoc), clean)).replace(/\\/g, '/');
}

export function evaluateLayer4Readiness() {
  const failures = [];
  const checks = [];

  const missingDocs = REQUIRED_DOCS.filter((doc) => !exists(doc));
  checks.push({ id: 'required-docs-exist', pass: missingDocs.length === 0, detail: missingDocs.length ? `missing: ${missingDocs.join(', ')}` : 'all required docs present' });
  if (missingDocs.length) failures.push(`Missing required docs: ${missingDocs.join(', ')}`);

  const docBody = exists(DOC_PATH) ? fs.readFileSync(path.join(ROOT, DOC_PATH), 'utf8') : '';
  const hasTestTarget = docBody.includes(REQUIRED_TEST_TARGET);
  checks.push({ id: 'required-test-target-present', pass: hasTestTarget, detail: hasTestTarget ? 'required Layer 4 test target referenced' : `missing required target string: ${REQUIRED_TEST_TARGET}` });
  if (!hasTestTarget) failures.push('Layer 4 readiness doc does not reference required governance rules test target.');

  const hasArchitectureGate = docBody.includes(ARCH_GATE_COMMAND);
  checks.push({ id: 'architecture-drift-gate-command', pass: hasArchitectureGate, detail: hasArchitectureGate ? 'architecture drift gate command present' : `missing command: ${ARCH_GATE_COMMAND}` });
  if (!hasArchitectureGate) failures.push('Layer 4 readiness doc missing architecture drift gate command reference.');

  let manifest = null;
  if (!exists(RELEASE_GATE_MANIFEST)) {
    failures.push(`Missing release-gate manifest: ${RELEASE_GATE_MANIFEST}`);
    checks.push({ id: 'release-gate-manifest-exists', pass: false, detail: 'manifest missing' });
  } else {
    manifest = JSON.parse(fs.readFileSync(path.join(ROOT, RELEASE_GATE_MANIFEST), 'utf8'));
    checks.push({ id: 'release-gate-manifest-exists', pass: true, detail: 'manifest present' });
  }

  const architectureGateEntry = manifest?.releaseBlockingGates?.find((gate) => gate.id === 'architecture-drift-gate');
  const manifestHasArchitectureScript = architectureGateEntry?.script === 'scripts/ci/check-architecture-doc-drift.mjs';
  checks.push({
    id: 'manifest-architecture-gate-consistency',
    pass: Boolean(manifestHasArchitectureScript),
    detail: manifestHasArchitectureScript
      ? 'architecture-drift-gate references expected script'
      : 'architecture-drift-gate missing or script mismatch in release-gate-manifest.json',
  });
  if (!manifestHasArchitectureScript) {
    failures.push('Release gate manifest is missing architecture-drift-gate script linkage.');
  }

  const linkMatches = [...docBody.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)];
  const repoLinks = linkMatches
    .map((m) => toRepoPath(DOC_PATH, m[1]))
    .filter(Boolean);

  const brokenLinks = repoLinks.filter((linkPath) => !exists(linkPath));
  checks.push({ id: 'runbook-doc-links-resolve', pass: brokenLinks.length === 0, detail: brokenLinks.length ? `broken: ${brokenLinks.join(', ')}` : 'all in-repo links resolve' });
  if (brokenLinks.length) failures.push(`Layer 4 readiness doc has broken in-repo links: ${brokenLinks.join(', ')}`);

  return {
    gate: 'layer4-readiness-evidence',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failures,
  };
}

function main() {
  const result = evaluateLayer4Readiness();
  console.log(JSON.stringify(result));
  if (result.status === 'FAIL') {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
