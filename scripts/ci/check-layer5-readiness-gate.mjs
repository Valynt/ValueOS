#!/usr/bin/env node
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const DOC_PATH = 'docs/operations/layer5-production-readiness.md';
const baseSha = process.env.CI_BASE_SHA || process.env.GITHUB_BASE_SHA || 'origin/main';
const headSha = process.env.CI_HEAD_SHA || process.env.GITHUB_SHA || 'HEAD';

function listChangedFiles() {
  try {
    const out = execSync(`git diff --name-only ${baseSha}...${headSha}`, { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    const out = execSync('git diff --name-only HEAD~1...HEAD', { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  }
}

const changed = listChangedFiles();
const layer5Patterns = [
  /^packages\/backend\/src\/lib\/agent-fabric\//,
  /^packages\/backend\/src\/runtime\//,
  /^packages\/backend\/src\/services\/realtime\//,
  /^infra\/k8s\//,
  /^docs\/operations\/runbooks\/governance-drift\.md$/,
];
const isLayer5Impacting = changed.some((f) => layer5Patterns.some((re) => re.test(f)));

if (!isLayer5Impacting) {
  console.log('ℹ️ No Layer 5-impacting changes detected; readiness gate not required.');
  process.exit(0);
}

if (!fs.existsSync(DOC_PATH)) {
  console.error(`❌ Layer 5-impacting PR requires ${DOC_PATH}`);
  process.exit(1);
}

const content = fs.readFileSync(DOC_PATH, 'utf8');
const required = [
  '## Control Checklist',
  '## Drift Scenarios Tested',
  '## Pass/Fail Status Log',
  '## Unresolved Risks',
  '### Strict-Mode Activation Criteria',
  '### Drift Alert Triage',
  '### Safe Remediation / Rollback Path',
  '| Drift detected |',
  '| Drift unresolved |',
  '| Blocked executions |',
];
const missing = required.filter((needle) => !content.includes(needle));
if (missing.length) {
  console.error('❌ Layer 5 readiness report is missing required content for gating:');
  missing.forEach((m) => console.error(`- ${m}`));
  process.exit(1);
}

console.log(`✅ Layer 5 readiness gate passed for Layer 5-impacting changes (${changed.length} files changed).`);
