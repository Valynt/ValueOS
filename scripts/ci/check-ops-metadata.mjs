#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TARGET_PREFIXES = ['infra/k8s/', 'docs/runbooks/'];

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const changedFiles = () => {
  const base = process.env.GITHUB_BASE_REF;
  const event = process.env.GITHUB_EVENT_NAME;

  if (event === 'pull_request' && base) {
    try {
      run(`git fetch --no-tags --depth=1 origin ${base}`);
    } catch {
      // Best-effort fetch; proceed with local refs if fetch is unavailable.
    }

    const baseRefCandidates = [`origin/${base}`, base];
    for (const candidate of baseRefCandidates) {
      try {
        return run(`git diff --name-only ${candidate}...HEAD`).split('\n').filter(Boolean);
      } catch {
        // Try next candidate.
      }
    }
  }

  return run('git diff --name-only HEAD~1..HEAD').split('\n').filter(Boolean);
};

const hasRequiredK8sMetadata = (content) => {
  const hasOwner = /^\s*(?:#\s*)?ops\.owner\s*:/m.test(content);
  const hasLabels = /^\s*(?:#\s*)?ops\.labels\s*:/m.test(content);
  return { hasOwner, hasLabels };
};

const hasRequiredRunbookMetadata = (content) => {
  const hasOwner = /^\s*Ops Owner\s*:/im.test(content);
  const hasLabels = /^\s*Ops Labels\s*:/im.test(content);
  return { hasOwner, hasLabels };
};

const files = changedFiles().filter((file) => TARGET_PREFIXES.some((prefix) => file.startsWith(prefix)));

if (files.length === 0) {
  console.log('No changed infra/runbook files detected; ops metadata check skipped.');
  process.exit(0);
}

const errors = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (file.startsWith('infra/k8s/') && /\.ya?ml$/i.test(file)) {
    const { hasOwner, hasLabels } = hasRequiredK8sMetadata(content);
    if (!hasOwner || !hasLabels) {
      errors.push(`${file}: missing ${[!hasOwner ? 'ops.owner' : '', !hasLabels ? 'ops.labels' : ''].filter(Boolean).join(' and ')}`);
    }
  }

  if (file.startsWith('docs/runbooks/') && /\.md$/i.test(file)) {
    const { hasOwner, hasLabels } = hasRequiredRunbookMetadata(content);
    if (!hasOwner || !hasLabels) {
      errors.push(`${file}: missing ${[!hasOwner ? 'Ops Owner' : '', !hasLabels ? 'Ops Labels' : ''].filter(Boolean).join(' and ')}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Ops ownership/label metadata policy violations:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Ops metadata check passed for ${files.length} changed file(s).`);
