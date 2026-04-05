#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const shimPath = 'packages/backend/src/lib/agent/types.ts';
const claimText = 'No active consumers';
const importPattern = String.raw`lib/agent/types`;

let importHits = '';
try {
  importHits = execSync(
    `rg --line-number --glob '*.ts' --glob '*.tsx' \"${importPattern}\" packages/backend/src`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
} catch (error) {
  if (error && error.status === 1) {
    importHits = '';
  } else {
    throw error;
  }
}

if (importHits.length > 0) {
  throw new Error(
    [
      'Found imports referencing deprecated lib/agent/types path.',
      'Migrate call sites to packages/backend/src/types/agent.ts.',
      '',
      importHits,
    ].join('\n')
  );
}

if (fs.existsSync(shimPath)) {
  const shimSource = fs.readFileSync(shimPath, 'utf8');
  if (shimSource.includes(claimText)) {
    throw new Error(
      `${shimPath} still claims \"${claimText}\". Remove the claim or retire the shim.`
    );
  }
}

console.log('Agent type shim claim check passed.');
