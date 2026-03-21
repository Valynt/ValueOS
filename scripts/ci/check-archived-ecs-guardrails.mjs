#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const ARCHIVE_PATH = 'infra/archive/terraform/ecs-reference/';
const LEGACY_ARCHIVE_PATH = 'infra/terraform/modules/_archived/';
const APPROVED_BREAK_GLASS_WORKFLOWS = [];

const workflowFiles = execSync("rg --files .github/workflows -g '*.yml' -g '*.yaml'", { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();

const terraformFiles = execSync("rg --files infra -g '*.tf'", { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => !file.startsWith(ARCHIVE_PATH))
  .sort();

const failures = [];

for (const workflowFile of workflowFiles) {
  if (APPROVED_BREAK_GLASS_WORKFLOWS.includes(workflowFile)) {
    continue;
  }

  const content = readFileSync(resolve(ROOT, workflowFile), 'utf8');
  if (content.includes(ARCHIVE_PATH) || content.includes(LEGACY_ARCHIVE_PATH)) {
    failures.push(`- ${workflowFile} references the archived ECS module path, but no approved break-glass workflow allowlists it.`);
  }
}

const terraformSourcePattern = /source\s*=\s*["'][^"']*(infra\/archive\/terraform\/ecs-reference|infra\/terraform\/modules\/_archived|modules\/ecs-service|modules\/ecs)(?:\/|["'])/giu;

for (const terraformFile of terraformFiles) {
  const content = readFileSync(resolve(ROOT, terraformFile), 'utf8');
  const matches = [...content.matchAll(terraformSourcePattern)];
  if (matches.length > 0) {
    failures.push(
      `- ${terraformFile} references archived ECS module sources: ${matches.map((match) => match[0].trim()).join('; ')}`,
    );
  }
}

if (failures.length > 0) {
  console.error('❌ Archived ECS guardrail check failed.');
  console.error(`Approved break-glass workflows: ${APPROVED_BREAK_GLASS_WORKFLOWS.length > 0 ? APPROVED_BREAK_GLASS_WORKFLOWS.join(', ') : '(none)'}`);
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`✅ Archived ECS guardrails verified. Approved break-glass workflows: ${APPROVED_BREAK_GLASS_WORKFLOWS.length > 0 ? APPROVED_BREAK_GLASS_WORKFLOWS.join(', ') : '(none)'}.`);
