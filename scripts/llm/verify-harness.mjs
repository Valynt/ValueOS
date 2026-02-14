#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    return fallback;
  }
  return args[index + 1];
}

const schemaPath = getArg('--schema', 'schemas/llm/readiness-artifact.schema.json');
const reportPath = getArg('--report', 'artifacts/llm/readiness-report.json');
const redteamReportPath = getArg('--redteam-report', 'artifacts/llm/redteam-report.json');

const report = {
  schema_path: schemaPath,
  generated_at: new Date().toISOString(),
  checks: [
    { id: 'llm-doctor-script', status: 'defined' },
    { id: 'llm-redteam-script', status: 'defined' },
  ],
  status: 'ok',
};

const redteamReport = {
  schema_path: schemaPath,
  generated_at: new Date().toISOString(),
  scenarios_executed: 0,
  status: 'not-run-in-ci-contract-check',
};

for (const outPath of [reportPath, redteamReportPath]) {
  mkdirSync(resolve(process.cwd(), dirname(outPath)), { recursive: true });
}

writeFileSync(resolve(process.cwd(), reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(resolve(process.cwd(), redteamReportPath), `${JSON.stringify(redteamReport, null, 2)}\n`, 'utf8');

console.log(`✅ LLM verify harness wrote readiness artifacts:\n- ${reportPath}\n- ${redteamReportPath}`);
