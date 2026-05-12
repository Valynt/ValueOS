#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DOC_PATH = 'docs/operations/layer5-production-readiness.md';
const MANIFEST_PATH = 'docs/operations/layer5-impact-paths.json';

const forceBaselineValidation = process.argv.includes('--baseline') || process.env.LAYER5_BASELINE_VALIDATION === 'true';
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

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0);
}

export function loadLayer5ImpactManifest({ root = process.cwd() } = {}) {
  const manifestPath = path.join(root, MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Layer 5 impact manifest is missing: ${MANIFEST_PATH}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Layer 5 impact manifest is invalid JSON: ${MANIFEST_PATH} (${error.message})`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Layer 5 impact manifest must be a JSON object: ${MANIFEST_PATH}`);
  }

  for (const bucket of ['include', 'exclude']) {
    const section = parsed[bucket];
    if (!section || typeof section !== 'object') {
      throw new Error(`Layer 5 impact manifest missing '${bucket}' object.`);
    }

    if (!isStringArray(section.exact)) {
      throw new Error(`Layer 5 impact manifest '${bucket}.exact' must be a string array.`);
    }

    if (!isStringArray(section.prefixes)) {
      throw new Error(`Layer 5 impact manifest '${bucket}.prefixes' must be a string array.`);
    }
  }

  return {
    includeExact: new Set(parsed.include.exact),
    includePrefixes: parsed.include.prefixes,
    excludeExact: new Set(parsed.exclude.exact),
    excludePrefixes: parsed.exclude.prefixes,
  };
}

export function evaluateLayer5Impact(changedFiles, manifest) {
  const triggered = [];
  for (const file of changedFiles) {
    const isExcluded = manifest.excludeExact.has(file)
      || manifest.excludePrefixes.some((prefix) => file.startsWith(prefix));
    if (isExcluded) {
      continue;
    }

    const isIncluded = manifest.includeExact.has(file)
      || manifest.includePrefixes.some((prefix) => file.startsWith(prefix));
    if (isIncluded) {
      triggered.push(file);
    }
  }

  return { isLayer5Impacting: triggered.length > 0, triggeredFiles: triggered };
}

function run() {
  const changed = listChangedFiles();

  let manifest;
  try {
    manifest = loadLayer5ImpactManifest();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  const { isLayer5Impacting, triggeredFiles } = evaluateLayer5Impact(changed, manifest);

  if (!isLayer5Impacting && !forceBaselineValidation) {
    console.log('ℹ️ No Layer 5-impacting changes detected; readiness gate not required.');
    process.exit(0);
  }

  if (triggeredFiles.length) {
    console.log('ℹ️ Layer 5-impacting files detected:');
    triggeredFiles.forEach((file) => console.log(` - ${file}`));
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

  if (forceBaselineValidation) {
    console.log(`✅ Layer 5 readiness baseline integrity passed (${changed.length} files inspected).`);
  } else {
    console.log(`✅ Layer 5 readiness gate passed for Layer 5-impacting changes (${changed.length} files changed).`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
