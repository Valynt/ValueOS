#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MANIFEST_PATH = path.resolve('config/legacy-surface-manifest.json');

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function tryRun(command) {
  try {
    return run(command);
  } catch {
    return null;
  }
}

function resolveBaseRef() {
  const githubBaseRef = process.env.GITHUB_BASE_REF;
  if (githubBaseRef) {
    const mergeBase = tryRun(`git merge-base HEAD origin/${githubBaseRef}`);
    if (mergeBase) return mergeBase;
  }

  const headParent = tryRun('git rev-parse HEAD^');
  if (headParent) return headParent;

  return null;
}

function readGithubEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(eventPath, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(MANIFEST_PATH)) {
  console.error(`❌ Legacy surface manifest is missing: ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const baseRef = resolveBaseRef();

if (!baseRef) {
  console.log('⚠️ Unable to resolve a base ref for legacy surface freeze checks. Skipping.');
  process.exit(0);
}

const changedFiles = run(`git diff --name-only ${baseRef}...HEAD`)
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

if (changedFiles.length === 0) {
  console.log('✅ Legacy surface freeze guard passed. No file changes detected.');
  process.exit(0);
}

const legacyDirectories = Array.isArray(manifest.legacyDirectories)
  ? manifest.legacyDirectories.filter((entry) => entry?.frozen !== false)
  : [];

const frozenChanges = legacyDirectories
  .map((entry) => {
    const prefix = `${entry.path.replace(/\/+$/, '')}/`;
    const files = changedFiles.filter((file) => file.startsWith(prefix));
    return { entry, files };
  })
  .filter(({ files }) => files.length > 0);

if (frozenChanges.length === 0) {
  console.log('✅ Legacy surface freeze guard passed. No frozen legacy paths were modified.');
  process.exit(0);
}

const overrideLabel = manifest.override?.label;
const metadataToken = String(manifest.override?.metadataToken ?? '').toLowerCase();

const eventPayload = readGithubEventPayload();
const prLabels = (eventPayload?.pull_request?.labels ?? [])
  .map((label) => (typeof label?.name === 'string' ? label.name : ''))
  .filter(Boolean);

const prContextBlob = [
  eventPayload?.pull_request?.title,
  eventPayload?.pull_request?.body,
  eventPayload?.head_commit?.message,
  eventPayload?.commits?.map((commit) => commit?.message).join('\n'),
]
  .filter((value) => typeof value === 'string' && value.length > 0)
  .join('\n')
  .toLowerCase();

const commitMessages = run(`git log --format=%B ${baseRef}..HEAD`).toLowerCase();

const hasOverrideLabel = Boolean(overrideLabel) && prLabels.includes(overrideLabel);
const hasMetadataToken = Boolean(metadataToken)
  && (commitMessages.includes(metadataToken) || prContextBlob.includes(metadataToken));

if (!hasOverrideLabel && !hasMetadataToken) {
  console.error('❌ Legacy surface freeze guard failed.');
  console.error('Detected changes under frozen legacy paths:');
  for (const { entry, files } of frozenChanges) {
    console.error(`\n- ${entry.path}`);
    console.error(`  ownerTeam: ${entry.ownerTeam}`);
    console.error(`  allowedChangeTypes: ${(entry.allowedChangeTypes ?? []).join(', ')}`);
    console.error(`  retirementTargetDate: ${entry.retirementTargetDate}`);
    for (const file of files) {
      console.error(`    • ${file}`);
    }
  }

  console.error('\nProvide one of the required explicit overrides:');
  if (overrideLabel) {
    console.error(`  1) PR label: ${overrideLabel}`);
  }
  if (metadataToken) {
    console.error(`  2) Metadata token in commit message or PR title/body: ${manifest.override.metadataToken}`);
  }
  process.exit(1);
}

const satisfiedBy = hasOverrideLabel ? `PR label "${overrideLabel}"` : `metadata token "${manifest.override.metadataToken}"`;
console.log(`✅ Legacy surface freeze guard passed via ${satisfiedBy}.`);
