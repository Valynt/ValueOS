#!/usr/bin/env node

/**
 * verify-build-env.js
 *
 * Verifies the build environment meets requirements:
 * - Node.js version
 * - pnpm version
 * - Lockfile existence
 *
 * This script is safe to run in CI and Docker.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let REQUIRED_NODE_VERSION;
try {
  REQUIRED_NODE_VERSION = fs.readFileSync(path.join(projectRoot, '.nvmrc'), 'utf8').trim();
} catch (e) {
  console.error('❌ Could not read .nvmrc');
  process.exit(1);
}

let REQUIRED_PNPM_VERSION;
try {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  if (!pkgJson.packageManager || !pkgJson.packageManager.startsWith('pnpm@')) {
     console.error('❌ packageManager field in package.json must start with pnpm@');
     process.exit(1);
  }
  REQUIRED_PNPM_VERSION = pkgJson.packageManager.split('@')[1];
} catch (e) {
  console.error('❌ Could not read package.json or packageManager field');
  process.exit(1);
}

function checkNodeVersion() {
  const current = process.version.replace(/^v/, '');
  // Simple equality check. In some envs major version match might be enough,
  // but for "deterministic build" exact match is better.
  // Note: This is a strict check. If you need loose checking, update this script.
  if (current !== REQUIRED_NODE_VERSION) {
    console.error(`❌ Node.js version mismatch. Expected ${REQUIRED_NODE_VERSION}, got ${current}`);
    return false;
  }
  console.log(`✅ Node.js version ${current}`);
  return true;
}

function checkPnpmVersion() {
  try {
    const current = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    if (current !== REQUIRED_PNPM_VERSION) {
      console.error(`❌ pnpm version mismatch. Expected ${REQUIRED_PNPM_VERSION}, got ${current}`);
      return false;
    }
    console.log(`✅ pnpm version ${current}`);
    return true;
  } catch (e) {
    console.error(`❌ pnpm not found or failed to run: ${e.message}`);
    return false;
  }
}

function checkLockfile() {
  if (!fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    console.error('❌ pnpm-lock.yaml not found');
    return false;
  }
  console.log('✅ pnpm-lock.yaml exists');
  return true;
}

function main() {
  console.log('🔍 Verifying build environment...');
  const results = [
    checkNodeVersion(),
    checkPnpmVersion(),
    checkLockfile()
  ];

  if (results.every(r => r)) {
    console.log('✅ Build environment verified.');
    process.exit(0);
  } else {
    console.error('❌ Build environment verification failed.');
    process.exit(1);
  }
}

main();
