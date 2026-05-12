#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

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
const DEFAULT_MAX_ARTIFACT_AGE_HOURS = 24;

function exists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function toRepoPath(fromDoc, rawLink) {
  if (rawLink.startsWith('http://') || rawLink.startsWith('https://') || rawLink.startsWith('#')) {
    return null;
  }
  const clean = rawLink.replace(/[#?].*$/, '');
  if (!clean) return null;
  return path.normalize(path.join(path.dirname(fromDoc), clean)).replace(/\\/g, '/');
}

function evaluateLayer4Artifact({ root, manifest, headCommit, nowMs }) {
  const failures = [];
  const checks = [];
  const requirements = manifest?.layer4ReadinessEvidence;

  if (!requirements) {
    checks.push({ id: 'layer4-evidence-contract', pass: false, detail: 'missing layer4ReadinessEvidence contract in manifest' });
    failures.push('Release gate manifest missing layer4ReadinessEvidence contract.');
    return { checks, failures };
  }

  const evidencePath = requirements.artifactPath;
  if (!evidencePath || !exists(root, evidencePath)) {
    checks.push({ id: 'layer4-evidence-artifact-exists', pass: false, detail: `artifact missing: ${evidencePath ?? '(unset)'}` });
    failures.push(`Missing Layer 4 evidence artifact: ${evidencePath ?? '(unset)'}`);
    return { checks, failures };
  }

  const artifact = JSON.parse(fs.readFileSync(path.join(root, evidencePath), 'utf8'));
  checks.push({ id: 'layer4-evidence-artifact-exists', pass: true, detail: `artifact present: ${evidencePath}` });

  const artifactCommitMatches = artifact.commit === headCommit;
  checks.push({ id: 'layer4-evidence-commit-match', pass: artifactCommitMatches, detail: artifactCommitMatches ? 'artifact commit matches HEAD' : `artifact commit ${artifact.commit} != HEAD ${headCommit}` });
  if (!artifactCommitMatches) failures.push(`Layer 4 evidence artifact commit (${artifact.commit}) does not match HEAD (${headCommit}).`);

  const maxAgeHours = requirements.maxArtifactAgeHours ?? DEFAULT_MAX_ARTIFACT_AGE_HOURS;
  const artifactMs = Date.parse(artifact.timestamp);
  const artifactAgeHours = Number.isFinite(artifactMs) ? (nowMs - artifactMs) / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;
  const artifactFresh = Number.isFinite(artifactMs) && artifactAgeHours <= maxAgeHours;
  checks.push({ id: 'layer4-evidence-freshness', pass: artifactFresh, detail: artifactFresh ? `artifact age ${artifactAgeHours.toFixed(2)}h within ${maxAgeHours}h` : `artifact timestamp invalid/stale: ${artifact.timestamp}, age=${artifactAgeHours.toFixed(2)}h, threshold=${maxAgeHours}h` });
  if (!artifactFresh) failures.push(`Layer 4 evidence artifact is stale or invalid timestamp (threshold ${maxAgeHours}h).`);

  const checkMap = new Map((artifact.checks ?? []).map((check) => [check.id, check]));
  const failingRequiredChecks = [];
  for (const required of requirements.requiredChecks ?? []) {
    const found = checkMap.get(required.id);
    const expectedStatus = required.expectedStatus ?? 'pass';
    const pass = found?.status === expectedStatus;
    checks.push({ id: `layer4-required-check-${required.id}`, pass, detail: pass ? `required check ${required.id} status=${found.status}` : `required check ${required.id} missing or status=${found?.status ?? 'missing'} expected=${expectedStatus}` });
    if (!pass) failingRequiredChecks.push(required.id);
  }
  if (failingRequiredChecks.length) {
    failures.push(`Layer 4 evidence artifact has non-pass required checks: ${failingRequiredChecks.join(', ')}`);
  }

  return { checks, failures };
}

export function evaluateLayer4Readiness(options = {}) {
  const root = options.root ?? process.cwd();
  const headCommit = options.headCommit ?? process.env.GITHUB_SHA ?? 'HEAD';
  const nowMs = options.nowMs ?? Date.now();

  const failures = [];
  const checks = [];

  const missingDocs = REQUIRED_DOCS.filter((doc) => !exists(root, doc));
  checks.push({ id: 'required-docs-exist', pass: missingDocs.length === 0, detail: missingDocs.length ? `missing: ${missingDocs.join(', ')}` : 'all required docs present' });
  if (missingDocs.length) failures.push(`Missing required docs: ${missingDocs.join(', ')}`);

  const docBody = exists(root, DOC_PATH) ? fs.readFileSync(path.join(root, DOC_PATH), 'utf8') : '';
  const hasTestTarget = docBody.includes(REQUIRED_TEST_TARGET);
  checks.push({ id: 'required-test-target-present', pass: hasTestTarget, detail: hasTestTarget ? 'required Layer 4 test target referenced' : `missing required target string: ${REQUIRED_TEST_TARGET}` });
  if (!hasTestTarget) failures.push('Layer 4 readiness doc does not reference required governance rules test target.');

  const hasArchitectureGate = docBody.includes(ARCH_GATE_COMMAND);
  checks.push({ id: 'architecture-drift-gate-command', pass: hasArchitectureGate, detail: hasArchitectureGate ? 'architecture drift gate command present' : `missing command: ${ARCH_GATE_COMMAND}` });
  if (!hasArchitectureGate) failures.push('Layer 4 readiness doc missing architecture drift gate command reference.');

  let manifest = null;
  if (!exists(root, RELEASE_GATE_MANIFEST)) {
    failures.push(`Missing release-gate manifest: ${RELEASE_GATE_MANIFEST}`);
    checks.push({ id: 'release-gate-manifest-exists', pass: false, detail: 'manifest missing' });
  } else {
    manifest = JSON.parse(fs.readFileSync(path.join(root, RELEASE_GATE_MANIFEST), 'utf8'));
    checks.push({ id: 'release-gate-manifest-exists', pass: true, detail: 'manifest present' });
  }

  const architectureGateEntry = manifest?.releaseBlockingGates?.find((gate) => gate.id === 'architecture-drift-gate');
  const manifestHasArchitectureScript = architectureGateEntry?.script === 'scripts/ci/check-architecture-doc-drift.mjs';
  checks.push({ id: 'manifest-architecture-gate-consistency', pass: Boolean(manifestHasArchitectureScript), detail: manifestHasArchitectureScript ? 'architecture-drift-gate references expected script' : 'architecture-drift-gate missing or script mismatch in release-gate-manifest.json' });
  if (!manifestHasArchitectureScript) failures.push('Release gate manifest is missing architecture-drift-gate script linkage.');

  const linkMatches = [...docBody.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)];
  const repoLinks = linkMatches.map((m) => toRepoPath(DOC_PATH, m[1])).filter(Boolean);

  const brokenLinks = repoLinks.filter((linkPath) => !exists(root, linkPath));
  checks.push({ id: 'runbook-doc-links-resolve', pass: brokenLinks.length === 0, detail: brokenLinks.length ? `broken: ${brokenLinks.join(', ')}` : 'all in-repo links resolve' });
  if (brokenLinks.length) failures.push(`Layer 4 readiness doc has broken in-repo links: ${brokenLinks.join(', ')}`);

  const artifactResult = evaluateLayer4Artifact({ root, manifest, headCommit, nowMs });
  checks.push(...artifactResult.checks);
  failures.push(...artifactResult.failures);

  return {
    gate: 'layer4-readiness-evidence',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failures,
  };
}

function main() {
  const result = evaluateLayer4Readiness({ headCommit: process.env.GITHUB_SHA ?? 'HEAD' });
  console.log(JSON.stringify(result));
  if (result.status === 'FAIL') {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
