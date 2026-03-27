#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const MATRIX_PATH = resolve(ROOT, '.github/workflows/CI_CONTROL_MATRIX.md');
const WORKFLOW_DIR = resolve(ROOT, '.github/workflows');

function parseMatrixRows(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const rows = [];

  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) {
      continue;
    }

    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 6 || cells[0] === 'Tier') {
      continue;
    }

    rows.push({
      tier: cells[0],
      domain: cells[1],
      control: cells[2],
      workflows: cells[3],
      owner: cells[4],
      remediation: cells[5],
      evidence: cells[6] ?? '',
    });
  }

  return rows;
}

function extractWorkflowRefs(text) {
  return [...text.matchAll(/`([^`]+\.ya?ml)`/g)].map((match) => match[1]);
}

function main() {
  const markdown = readFileSync(MATRIX_PATH, 'utf8');
  const rows = parseMatrixRows(markdown);
  const workflowFiles = new Set(readdirSync(WORKFLOW_DIR).filter((name) => name.endsWith('.yml') || name.endsWith('.yaml')));

  const staleWorkflowRefs = [];
  const informationalRows = [];

  for (const row of rows) {
    if (row.tier === 'informational') {
      informationalRows.push(row);
    }

    for (const ref of extractWorkflowRefs(row.workflows)) {
      const short = ref.split('/').pop();
      if (short && !workflowFiles.has(short)) {
        staleWorkflowRefs.push({ control: row.control, workflow: ref });
      }
    }
  }

  const report = {
    generated_at_utc: new Date().toISOString(),
    control_count: rows.length,
    informational_count: informationalRows.length,
    stale_workflow_reference_count: staleWorkflowRefs.length,
    stale_workflow_references: staleWorkflowRefs,
    recommendation: 'Retire or downgrade informational checks with no ownership demand, and remove stale workflow references.',
  };

  const outDir = resolve(ROOT, 'artifacts/governance');
  mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, 'control-pruning-review.json');
  const mdPath = resolve(outDir, 'control-pruning-review.md');

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const markdownReport = [
    '# Monthly Control Pruning Review',
    '',
    `- generated_at_utc: ${report.generated_at_utc}`,
    `- controls_indexed: ${report.control_count}`,
    `- informational_controls: ${report.informational_count}`,
    `- stale_workflow_references: ${report.stale_workflow_reference_count}`,
    '',
    '## Stale workflow references',
    '',
    ...(staleWorkflowRefs.length === 0
      ? ['- none']
      : staleWorkflowRefs.map((entry) => `- ${entry.control} -> ${entry.workflow}`)),
    '',
    '## Review action',
    '',
    `- ${report.recommendation}`,
    '',
  ].join('\n');

  writeFileSync(mdPath, markdownReport, 'utf8');

  if (!existsSync(jsonPath) || !existsSync(mdPath)) {
    throw new Error('Failed to write control pruning artifacts.');
  }

  console.log(`✅ Wrote ${jsonPath}`);
  console.log(`✅ Wrote ${mdPath}`);
}

main();
