#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';

const THREAT_MODEL_PATH = 'docs/security-compliance/threat-model.md';
const MAX_AGE_DAYS = Number.parseInt(process.env.THREAT_MODEL_MAX_AGE_DAYS ?? '90', 10);

if (!existsSync(THREAT_MODEL_PATH)) {
  console.error(`❌ Missing required threat model document: ${THREAT_MODEL_PATH}`);
  process.exit(1);
}

const content = readFileSync(THREAT_MODEL_PATH, 'utf8');
const match = content.match(/^\*\*Last Reviewed\*\*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/m);

if (!match) {
  console.error(`❌ ${THREAT_MODEL_PATH} must include a \"**Last Reviewed**: YYYY-MM-DD\" line.`);
  process.exit(1);
}

const reviewedDate = new Date(`${match[1]}T00:00:00Z`);
if (Number.isNaN(reviewedDate.getTime())) {
  console.error(`❌ Invalid Last Reviewed date in ${THREAT_MODEL_PATH}: ${match[1]}`);
  process.exit(1);
}

const now = new Date();
const ageMs = now.getTime() - reviewedDate.getTime();
const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

if (ageDays > MAX_AGE_DAYS) {
  console.error(
    `❌ Threat model is stale (${ageDays} days old). Policy requires review within ${MAX_AGE_DAYS} days.`,
  );
  process.exit(1);
}

console.log(
  `✅ Threat model freshness check passed: ${THREAT_MODEL_PATH} reviewed ${ageDays} days ago (policy: <= ${MAX_AGE_DAYS} days).`,
);
