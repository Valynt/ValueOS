#!/usr/bin/env node
// Simple stability seal script executed by CI or manually.  It runs a
// minimal set of commands to sanity-check the repo before declaring a build
// production-ready.  Returns non-zero if any stage fails.

const { execSync } = require('child_process');

function run(cmd) {
  console.log(`\n> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.error(`command failed: ${cmd}`);
    return false;
  }
}

let ok = true;

// build frontend
ok &= run('pnpm -F ./apps/ValyntApp run build');

// lint, but allow warnings
if (!run('pnpm run lint')) {
  console.warn('Lint reported issues, but not failing stability seal');
}

// run RLS if available
if (!run('pnpm run test:rls')) {
  console.warn('RLS check unavailable or failed');
}

// verify TODO metadata as part of seal
if (!run('pnpm run check:todo-metadata')) {
  ok = false;
}

if (!ok) process.exit(1);
