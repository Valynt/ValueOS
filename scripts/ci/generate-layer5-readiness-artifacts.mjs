#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DOC_PATH = process.env.LAYER5_REPORT_PATH ?? 'docs/operations/layer5-production-readiness.md';
const runId = process.env.GITHUB_RUN_ID ?? 'local';
const sha = process.env.GITHUB_SHA ?? 'local';
const generatedAt = new Date().toISOString();
const outDir = path.join('artifacts', 'operations');
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(DOC_PATH)) {
  console.error(`❌ Missing required Layer 5 readiness report: ${DOC_PATH}`);
  process.exit(1);
}

const content = fs.readFileSync(DOC_PATH, 'utf8');
const requiredMarkers = [
  '## Control Checklist',
  '## Drift Scenarios Tested',
  '## Pass/Fail Status Log',
  '## Unresolved Risks',
  '## Operational Runbook',
  '## Dashboards, Metrics, and Alert Thresholds',
];

const missing = requiredMarkers.filter((marker) => !content.includes(marker));
if (missing.length > 0) {
  console.error('❌ Layer 5 readiness report is missing required sections:');
  missing.forEach((m) => console.error(`- ${m}`));
  process.exit(1);
}

const report = {
  generated_at: generatedAt,
  source_commit: sha,
  source_doc: DOC_PATH,
  status: 'ready',
  checks: {
    required_sections_present: true,
  },
};

const jsonPath = path.join(outDir, `layer5-readiness-report-${runId}.json`);
const mdPath = path.join(outDir, `layer5-readiness-report-${runId}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(
  mdPath,
  `# Layer 5 Readiness Artifact\n\n- generated_at: ${generatedAt}\n- source_commit: ${sha}\n- source_doc: ${DOC_PATH}\n- status: ready\n\n## Validation\n- Required sections present: ✅\n`,
);

console.log(`✅ Wrote Layer 5 readiness artifacts:\n  - ${jsonPath}\n  - ${mdPath}`);
