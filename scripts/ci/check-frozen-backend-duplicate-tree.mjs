#!/usr/bin/env node
import { execSync } from 'node:child_process';

const FROZEN_ROOT = 'apps/ValyntApp/src/services/';
const ALLOWED_PREFIXES = [
  `${FROZEN_ROOT}ui-adapters/`,
  `${FROZEN_ROOT}__tests__/`,
];
const REQUIRED_SYNC_TOKEN = '[migration-sync]';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function tryRun(cmd) {
  try {
    return run(cmd);
  } catch {
    return null;
  }
}

function resolveBaseRef() {
  const githubBaseRef = process.env.GITHUB_BASE_REF;
  if (githubBaseRef) {
    const remoteBase = `origin/${githubBaseRef}`;
    const mergeBase = tryRun(`git merge-base HEAD ${remoteBase}`);
    if (mergeBase) return mergeBase;
  }

  const headParent = tryRun('git rev-parse HEAD^');
  if (headParent) return headParent;

  return null;
}

const baseRef = resolveBaseRef();
if (!baseRef) {
  console.log('⚠️ Unable to resolve a base ref for frozen duplicate-tree checks. Skipping.');
  process.exit(0);
}

const changedFiles = run(`git diff --name-only ${baseRef}...HEAD`)
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean);

const frozenChanges = changedFiles.filter((file) => file.startsWith(FROZEN_ROOT));
if (frozenChanges.length === 0) {
  console.log('✅ Frozen duplicate-tree guard passed. No changes detected under apps/ValyntApp/src/services.');
  process.exit(0);
}

const disallowedChanges = frozenChanges.filter(
  (file) => !ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix)),
);

if (disallowedChanges.length === 0) {
  console.log('✅ Frozen duplicate-tree guard passed. Only allowed UI adapter/test paths changed.');
  process.exit(0);
}

const commitMessages = run(`git log --format=%B ${baseRef}..HEAD`);
const hasSyncToken = commitMessages.toLowerCase().includes(REQUIRED_SYNC_TOKEN.toLowerCase());

const backendChanged = new Set(
  changedFiles.filter((file) => file.startsWith('packages/backend/src/services/')),
);

const missingMirrors = disallowedChanges.filter((file) => {
  const mirrored = file.replace('apps/ValyntApp/src/services/', 'packages/backend/src/services/');
  return !backendChanged.has(mirrored);
});

if (!hasSyncToken || missingMirrors.length > 0) {
  console.error('❌ Frozen duplicate-tree guard failed.');
  console.error(`Detected edits under ${FROZEN_ROOT} outside allowed prefixes.`);
  console.error('These edits are only allowed in migration sync commits with mirrored backend changes.\n');

  if (!hasSyncToken) {
    console.error(`Missing required commit token: ${REQUIRED_SYNC_TOKEN}`);
  }

  if (missingMirrors.length > 0) {
    console.error('\nFiles missing matching edits under packages/backend/src/services/:');
    for (const file of missingMirrors) {
      console.error(`  - ${file}`);
    }
  }

  console.error('\nTo proceed, create a dedicated sync commit that:');
  console.error(`  1) Includes ${REQUIRED_SYNC_TOKEN} in commit message`);
  console.error('  2) Applies the same file-path changes under packages/backend/src/services/');
  process.exit(1);
}

console.log('✅ Frozen duplicate-tree guard passed via migration sync commit token + mirrored backend edits.');
