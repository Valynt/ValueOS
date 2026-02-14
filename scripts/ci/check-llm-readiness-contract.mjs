#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const packageJsonPath = resolve(ROOT, 'package.json');

const requiredScripts = ['llm:doctor', 'llm:verify', 'llm:redteam'];
const requiredPolicyFiles = ['policies/llm/usage-policy.md'];
const requiredAllowlistFiles = ['policies/llm/model-allowlist.json'];
const requiredSchemaPaths = ['schemas/llm/readiness-artifact.schema.json'];
const requiredVerifyArtifactPaths = ['artifacts/llm/readiness-report.json', 'artifacts/llm/redteam-report.json'];

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const scripts = pkg.scripts ?? {};

const errors = [];

for (const scriptName of requiredScripts) {
  if (!scripts[scriptName] || typeof scripts[scriptName] !== 'string') {
    errors.push(`Missing required npm script: \"${scriptName}\".`);
  }
}

for (const file of [...requiredPolicyFiles, ...requiredAllowlistFiles, ...requiredSchemaPaths]) {
  if (!existsSync(resolve(ROOT, file))) {
    errors.push(`Missing required LLM contract file: ${file}`);
  }
}

const verifyCommand = scripts['llm:verify'] ?? '';
for (const schemaPath of requiredSchemaPaths) {
  if (!verifyCommand.includes(schemaPath)) {
    errors.push(`llm:verify must reference required schema path: ${schemaPath}`);
  }
}

for (const artifactPath of requiredVerifyArtifactPaths) {
  if (!verifyCommand.includes(artifactPath)) {
    errors.push(`llm:verify must produce required readiness artifact path: ${artifactPath}`);
  }
}

if (errors.length > 0) {
  console.error('❌ LLM readiness contract check failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('✅ LLM readiness contract check passed');
console.log(`Validated ${requiredScripts.length} required scripts, ${requiredPolicyFiles.length} policy file(s), ${requiredAllowlistFiles.length} allowlist file(s), and verify harness contract paths.`);
