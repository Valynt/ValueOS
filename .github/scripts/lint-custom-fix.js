import fs from 'fs';
import path from 'path';

import glob from 'glob';

// Named constants for magic numbers
const IMPROVEMENT_RATIO = 0.5;
const DAYS_90 = 90;
const MS_PER_DAY = 86400000;

// Utility: Replace magic numbers with named constants
function replaceMagicNumbers(content: string): string {
  return content
    .replace(/([^\w\d])0\.5([^\w\d])/g, `$1IMPROVEMENT_RATIO$2`)
    .replace(/([^\w\d])90([^\w\d])/g, `$1DAYS_90$2`)
    .replace(/([^\w\d])86400000([^\w\d])/g, `$1MS_PER_DAY$2`);
}

// Utility: Remove redundant await
function removeRedundantAwait(content: string): string {
  return content.replace(/await (return|Promise\.resolve)/g, '$1');
}

// Utility: Log actions
function logAction(file: string, action: string) {
  fs.appendFileSync('lint-fix-todo.log', `[${new Date().toISOString()}] ${file}: ${action}\n`);
}

// Main: Process all TypeScript files
const files = glob.sync('src/**/*.{ts,tsx}', { absolute: true });
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Remove redundant await
  const newContent1 = removeRedundantAwait(content);
  if (newContent1 !== content) {
    logAction(file, 'Removed redundant await');
    content = newContent1;
    changed = true;
  }

  // Replace magic numbers
  const newContent2 = replaceMagicNumbers(content);
  if (newContent2 !== content) {
    logAction(file, 'Replaced magic numbers with named constants');
    content = newContent2;
    changed = true;
  }

  // Save if changed and run basic integrity checks
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');

    try {
      // run ESLint on the modified file to catch syntax or style issues
      const { execSync } = require('child_process');
      execSync(`pnpm run lint -- --fix --file ${file}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Lint check failed for ${file}:`, e.message || e);
      // continue, we don't want the script to crash; CI will catch errors later
    }
  }
}

// After processing all files, run a global type check and report summary
try {
  const { execSync } = require('child_process');
  console.log('Running global type check...');
  execSync('pnpm run tsc --noEmit', { stdio: 'inherit' });
  console.log('Type check passed.');
} catch (e) {
  console.error('Type check failed after lint fixes:', e.message || e);
}

// Summary: the "lint-fix-todo.log" file already contains a record of all
// modifications. Future enhancements could parse it and show a concise report.
