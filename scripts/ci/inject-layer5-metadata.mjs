#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_DOC_PATH = process.env.LAYER5_SOURCE_DOC_PATH ?? 'docs/operations/layer5-production-readiness.md';
const OUTPUT_DOC_PATH = process.env.LAYER5_INJECTED_DOC_PATH ?? path.join('artifacts', 'operations', 'layer5-production-readiness.generated.md');

const sha = process.env.GITHUB_SHA ?? 'local';
const generatedAt = new Date().toISOString();

if (!fs.existsSync(SOURCE_DOC_PATH)) {
  console.error(`❌ Missing Layer 5 source report: ${SOURCE_DOC_PATH}`);
  process.exit(1);
}

const source = fs.readFileSync(SOURCE_DOC_PATH, 'utf8');

const injected = source
  .replaceAll('CI_GENERATED_UTC', generatedAt)
  .replaceAll('CI_SOURCE_COMMIT', sha);

fs.mkdirSync(path.dirname(OUTPUT_DOC_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_DOC_PATH, injected);

console.log(`✅ Injected Layer 5 metadata:\n  - source: ${SOURCE_DOC_PATH}\n  - output: ${OUTPUT_DOC_PATH}\n  - generated_at: ${generatedAt}\n  - source_commit: ${sha}`);
