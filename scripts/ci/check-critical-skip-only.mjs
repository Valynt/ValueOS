#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const waiverPath = path.join(root, 'config/release-risk/release-1.0-skip-waivers.json');

if (!fs.existsSync(waiverPath)) {
  console.error(`❌ Missing waiver file: ${waiverPath}`);
  process.exit(1);
}

const waiverConfig = JSON.parse(fs.readFileSync(waiverPath, 'utf8'));
const criticalPaths = Array.isArray(waiverConfig.criticalPaths) ? waiverConfig.criticalPaths : [];
const waivers = Array.isArray(waiverConfig.waivers) ? waiverConfig.waivers : [];

if (criticalPaths.length === 0) {
  console.error('❌ Waiver config has no criticalPaths entries.');
  process.exit(1);
}

const now = new Date();
const waiverMap = new Map();
for (const waiver of waivers) {
  const key = `${waiver.file}:${waiver.line}`;
  waiverMap.set(key, waiver);

  const expiresOn = new Date(`${waiver.expiresOn}T23:59:59Z`);
  if (Number.isNaN(expiresOn.getTime())) {
    console.error(`❌ Invalid expiresOn date for waiver ${waiver.id}: ${waiver.expiresOn}`);
    process.exit(1);
  }
  if (expiresOn < now) {
    console.error(
      `❌ Waiver ${waiver.id} is expired (${waiver.expiresOn}) for ${waiver.file}:${waiver.line}.`,
    );
    process.exit(1);
  }
}

const rgArgs = ['-n', '\\b(it|describe|test)\\.(skip|only)\\b', '.'];
for (const glob of criticalPaths) {
  rgArgs.push('--glob', glob);
}
let output = '';

try {
  output = execFileSync('rg', rgArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  if (error.status === 1) {
    console.log('✅ No .skip/.only found in critical paths.');
    process.exit(0);
  }

  const stderr = error.stderr ? String(error.stderr) : '';
  console.error('❌ Failed to scan critical paths for .skip/.only.');
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
  process.exit(1);
}

const findings = output
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^(.*?):(\d+):(.*)$/);
    if (!match) {
      return null;
    }

    return {
      file: match[1].replace(/^\.\//, ''),
      line: Number.parseInt(match[2], 10),
      snippet: match[3].trim(),
    };
  })
  .filter((entry) => entry !== null);

const unapproved = [];
for (const finding of findings) {
  const key = `${finding.file}:${finding.line}`;
  if (!waiverMap.has(key)) {
    unapproved.push(finding);
  }
}

if (unapproved.length > 0) {
  console.error('❌ Found unapproved .skip/.only in critical paths:');
  for (const finding of unapproved) {
    console.error(`  - ${finding.file}:${finding.line} :: ${finding.snippet}`);
  }
  console.error(
    `Add an approved waiver entry in ${path.relative(root, waiverPath)} with owner and expiresOn, or re-enable the test.`,
  );
  process.exit(1);
}

console.log(`✅ Critical-path .skip/.only check passed with ${findings.length} approved waiver(s).`);
