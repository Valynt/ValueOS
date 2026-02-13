#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';

const repoRoot = process.cwd();
const checklistPath = path.join('docs', 'processes', 'critical-claims-checklist.md');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✅ ${message}`);
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function parseChecklistTargets(content) {
  const results = new Set();
  const backtickRegex = /`([^`]+)`/g;

  for (const match of content.matchAll(backtickRegex)) {
    const candidate = match[1].trim();
    if (
      (candidate.startsWith('.github/') ||
        candidate.startsWith('docs/') ||
        candidate.startsWith('scripts/')) &&
      !candidate.includes('*')
    ) {
      results.add(candidate.replace(/^\.\//, ''));
    }
  }

  return [...results];
}

function getChangedFiles() {
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') return [];

  const baseSha = process.env.GITHUB_BASE_SHA || process.env.GITHUB_EVENT_PULL_REQUEST_BASE_SHA;
  const headSha = process.env.GITHUB_SHA || 'HEAD';

  if (!baseSha) {
    console.warn('⚠️ Base SHA not available; skipping PR coupling checks.');
    return [];
  }

  try {
    const output = cp
      .execSync(`git diff --name-only ${baseSha}...${headSha}`, { encoding: 'utf8' })
      .trim();

    if (!output) return [];
    return output.split('\n').map((f) => f.trim()).filter(Boolean);
  } catch (error) {
    fail(`Unable to compute changed files for PR coupling checks: ${error.message}`);
    return [];
  }
}

function enforceControlCoupling(changedFiles) {
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') {
    ok('PR-only control coupling checks skipped for non-PR event.');
    return;
  }

  if (changedFiles.length === 0) {
    ok('No changed files detected for PR coupling checks.');
    return;
  }

  const workflowChanged = changedFiles.some((f) => f.startsWith('.github/workflows/'));

  const controlDocMatchers = [
    /^docs\/security-compliance\//,
    /^docs\/operations\/deployment-guide\.md$/,
    /^docs\/runbooks\/deployment-runbook\.md$/,
    /^docs\/runbooks\/disaster-recovery\.md$/,
  ];

  const controlDocChanged = changedFiles.some((f) => controlDocMatchers.some((m) => m.test(f)));

  if (workflowChanged && !controlDocChanged) {
    fail('Workflow changes detected without corresponding security/deploy control documentation updates.');
  } else {
    ok('Workflow-to-control-doc coupling check passed.');
  }

  if (controlDocChanged && !workflowChanged) {
    fail('Security/deploy control documentation changed without corresponding workflow updates.');
  } else {
    ok('Control-doc-to-workflow coupling check passed.');
  }
}

function main() {
  if (!exists(checklistPath)) {
    fail(`Checklist file is missing: ${checklistPath}`);
    process.exit(process.exitCode || 1);
  }

  const content = fs.readFileSync(path.join(repoRoot, checklistPath), 'utf8');
  const targets = parseChecklistTargets(content);

  if (targets.length === 0) {
    fail(`No repository targets were discovered in ${checklistPath}.`);
  }

  for (const target of targets) {
    if (exists(target)) {
      ok(`Validated artifact exists: ${target}`);
    } else {
      fail(`Referenced artifact is missing: ${target}`);
    }
  }

  const changedFiles = getChangedFiles();
  enforceControlCoupling(changedFiles);

  if (process.exitCode) {
    console.error('Critical claims validation failed.');
    process.exit(1);
  }

  console.log('Critical claims validation passed.');
}

main();
