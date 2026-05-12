#!/usr/bin/env node
import fs from 'node:fs';

const REPORT_PATH = process.env.LAYER5_REPORT_PATH ?? 'artifacts/operations/layer5-production-readiness.generated.md';
const PLACEHOLDERS = ['CI_GENERATED_UTC', 'CI_SOURCE_COMMIT', 'TO_BE_FILLED_BY_CI'];

if (!fs.existsSync(REPORT_PATH)) {
  console.error(`❌ Missing Layer 5 report to validate: ${REPORT_PATH}`);
  process.exit(1);
}

const content = fs.readFileSync(REPORT_PATH, 'utf8');
const remaining = PLACEHOLDERS.filter((token) => content.includes(token));

if (remaining.length > 0) {
  console.error(`❌ Layer 5 report still contains placeholder tokens in ${REPORT_PATH}:`);
  remaining.forEach((token) => console.error(`- ${token}`));
  process.exit(1);
}

console.log(`✅ Layer 5 metadata placeholders cleared in ${REPORT_PATH}`);
