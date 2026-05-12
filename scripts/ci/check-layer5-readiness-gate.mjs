#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DOC_PATH = 'docs/operations/layer5-production-readiness.md';
const MANIFEST_PATH = 'docs/operations/layer5-impact-paths.json';
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
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function loadLayer5ImpactManifest(manifestPath = MANIFEST_PATH) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Layer 5 manifest is required but missing: ${manifestPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Layer 5 manifest is invalid JSON at ${manifestPath}: ${error.message}`);
  }

  const sections = ['include', 'exclude'];
  for (const section of sections) {
    if (!parsed[section] || typeof parsed[section] !== 'object') {
      throw new Error(`Layer 5 manifest must include an object section: ${section}`);
    }
    if (!isStringArray(parsed[section].exact)) {
      throw new Error(`Layer 5 manifest section ${section}.exact must be an array of strings`);
    }
    if (!isStringArray(parsed[section].prefixes)) {
      throw new Error(`Layer 5 manifest section ${section}.prefixes must be an array of strings`);
    }

    for (const prefix of parsed[section].prefixes) {
      if (!prefix.endsWith('/')) {
        throw new Error(`Layer 5 manifest ${section}.prefixes entries must end with '/': ${prefix}`);
      }
    }
  }

  return parsed;
}

export function evaluateLayer5Impact(changedFiles, manifest) {
  const includeExact = new Set(manifest.include.exact);
  const excludeExact = new Set(manifest.exclude.exact);

  const isIncluded = (filePath) => (
    includeExact.has(filePath)
    || manifest.include.prefixes.some((prefix) => filePath.startsWith(prefix))
  );

  const isExcluded = (filePath) => (
    excludeExact.has(filePath)
    || manifest.exclude.prefixes.some((prefix) => filePath.startsWith(prefix))
  );

  const triggeringFiles = changedFiles.filter((filePath) => isIncluded(filePath) && !isExcluded(filePath));

  return {
    isLayer5Impacting: triggeringFiles.length > 0,
    triggeringFiles,
  };
}

function checkReadinessDoc() {
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
}

export function runLayer5ReadinessGate() {
  let manifest;
  try {
    manifest = loadLayer5ImpactManifest(MANIFEST_PATH);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  const changed = listChangedFiles();
  const impact = evaluateLayer5Impact(changed, manifest);

  if (!impact.isLayer5Impacting) {
    console.log('ℹ️ No Layer 5-impacting changes detected; readiness gate not required.');
    return;
  }

  console.log('🧾 Layer 5 impact triggers:');
  impact.triggeringFiles.forEach((filePath) => console.log(` - ${filePath}`));

  checkReadinessDoc();

  console.log(
    `✅ Layer 5 readiness gate passed for Layer 5-impacting changes (${changed.length} files changed, ${impact.triggeringFiles.length} Layer 5 triggers).`
  );
}

if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  runLayer5ReadinessGate();
}
