#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const now = new Date();
const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
const year = now.getUTCFullYear();
const timestamp = now.toISOString().replace(/[:.]/g, '-');

const reportRoot = path.resolve('reports', 'compliance');
const outputRoot = path.resolve('compliance', 'evidence-packs');
const packDir = path.join(outputRoot, `${year}-Q${quarter}`, `evidence-pack-${timestamp}`);

const requiredArtifacts = [
  {
    name: 'dsr-report',
    path: path.join(reportRoot, 'dsr', 'vitest-dsr.junit.xml'),
    control: 'GDPR Art.15/17',
  },
  {
    name: 'rls-report',
    path: path.join(reportRoot, 'rls', 'vitest-rls.junit.xml'),
    control: 'SOC2 CC6.1 / ISO27001 A.9',
  },
  {
    name: 'audit-immutability-report',
    path: path.join(reportRoot, 'audit', 'vitest-audit-immutability.junit.xml'),
    control: 'SOC2 CC6.8 / ISO27001 A.12.4',
  },
  {
    name: 'migration-ledger',
    path: path.resolve('docs', 'security-compliance', 'evidence-index.md'),
    control: 'Evidence traceability',
  },
];

const copyResults = [];
await fs.mkdir(packDir, { recursive: true });

for (const artifact of requiredArtifacts) {
  const destination = path.join(packDir, path.basename(artifact.path));
  try {
    await fs.copyFile(artifact.path, destination);
    const file = await fs.readFile(destination);
    const sha256 = crypto.createHash('sha256').update(file).digest('hex');
    copyResults.push({ ...artifact, destination, sha256, included: true });
  } catch {
    copyResults.push({ ...artifact, destination: null, sha256: null, included: false });
  }
}

const manifest = {
  generated_at: now.toISOString(),
  quarter: `Q${quarter}`,
  year,
  source_workflow: process.env.GITHUB_WORKFLOW ?? 'local',
  workflow_run_id: process.env.GITHUB_RUN_ID ?? 'local-run',
  workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
  artifacts: copyResults,
};

await fs.writeFile(path.join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

const markdown = [
  '# Quarterly Compliance Evidence Pack',
  '',
  `- Generated: ${manifest.generated_at}`,
  `- Period: ${year} Q${quarter}`,
  `- Workflow run: ${manifest.workflow_run_id} (attempt ${manifest.workflow_run_attempt})`,
  '',
  '| Artifact | Control | Included | SHA-256 |',
  '|---|---|---|---|',
  ...copyResults.map((item) =>
    `| ${item.name} | ${item.control} | ${item.included ? 'yes' : 'no'} | ${item.sha256 ?? 'n/a'} |`
  ),
  '',
].join('\n');

await fs.writeFile(path.join(packDir, 'README.md'), markdown);

console.log(`Generated quarterly evidence pack: ${packDir}`);

const missing = copyResults.filter((item) => !item.included);
if (missing.length > 0) {
  console.warn(`Missing ${missing.length} expected artifact(s). See manifest.json for details.`);
  process.exitCode = 2;
}
