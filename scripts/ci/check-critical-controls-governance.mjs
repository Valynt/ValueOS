#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONTROL_STATUS_PATH = resolve('docs/security-compliance/control-status.json');
const EVIDENCE_INDEX_PATH = resolve('docs/security-compliance/evidence-index.md');
const ARTIFACT_ROOT = resolve('artifacts/compliance/critical-controls-gate');
const CONTROL_ASSERTION_ROOT = resolve('artifacts/compliance/critical-controls');
const TODAY_UTC = new Date().toISOString().slice(0, 10);
const CLOSED_STATUSES = new Set(['completed', 'done', 'closed', 'accepted-risk', 'waived']);
const ID_PATTERN = /^CR-\d{3}$/;
const EVIDENCE_ROW_PATTERN = /^\|\s*(CR-\d{3})\s*\|\s*`([^`]+)`\s*\|/;

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }
  return value.trim();
}

function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : 'unknown';
}

function parseEvidenceIndexRows(markdown) {
  const rows = new Map();
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(EVIDENCE_ROW_PATTERN);
    if (!match) {
      continue;
    }
    rows.set(match[1], match[2]);
  }
  return rows;
}

function writeJson(path, payload) {
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeMarkdown(path, lines) {
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const controlStatus = JSON.parse(readFileSync(CONTROL_STATUS_PATH, 'utf8'));
  const controls = Array.isArray(controlStatus.controls) ? controlStatus.controls : [];
  const evidenceIndex = readFileSync(EVIDENCE_INDEX_PATH, 'utf8');
  const evidenceRows = parseEvidenceIndexRows(evidenceIndex);
  const failures = [];

  const openCriticalControls = controls
    .filter((control) => String(control?.severity ?? '').trim().toLowerCase() === 'critical')
    .filter((control) => !CLOSED_STATUSES.has(normalizeStatus(control?.status)))
    .filter((control) => normalizeStatus(control?.status) === 'planned');

  mkdirSync(ARTIFACT_ROOT, { recursive: true });
  mkdirSync(CONTROL_ASSERTION_ROOT, { recursive: true });

  const assertions = openCriticalControls.map((control) => {
    const id = typeof control?.id === 'string' ? control.id.trim() : '';
    const owner = typeof control?.remediation?.owner === 'string' && control.remediation.owner.trim()
      ? control.remediation.owner.trim()
      : (typeof control?.owner === 'string' ? control.owner.trim() : '');
    const dueDate = parseDateOnly(control?.remediation?.targetDate) ?? parseDateOnly(control?.targetDate);
    const evidenceArtifactPath = evidenceRows.get(id) ?? null;
    const assertionFailures = [];

    if (!ID_PATTERN.test(id)) {
      assertionFailures.push(`INVALID_CONTROL_ID ${String(control?.id)}`);
    }
    if (!owner) {
      assertionFailures.push(`OWNERLESS ${id}`);
    }
    if (!dueDate) {
      assertionFailures.push(`MISSING_OR_INVALID_DUE_DATE ${id}`);
    } else if (dueDate < TODAY_UTC) {
      assertionFailures.push(`OVERDUE ${id}: due=${dueDate}, today=${TODAY_UTC}`);
    }
    if (!evidenceArtifactPath) {
      assertionFailures.push(`MISSING_EVIDENCE_ARTIFACT_MAPPING ${id}: no machine-readable path in evidence-index.md`);
    } else if (!/\.json$/i.test(evidenceArtifactPath)) {
      assertionFailures.push(`NON_MACHINE_READABLE_EVIDENCE_PATH ${id}: ${evidenceArtifactPath}`);
    }

    const assertion = {
      id,
      status: control.status,
      severity: control.severity,
      owner,
      dueDate,
      evidenceArtifactPath,
      assertionResult: assertionFailures.length === 0 ? 'pass' : 'fail',
      failures: assertionFailures,
    };

    const controlDir = resolve(CONTROL_ASSERTION_ROOT, id || 'unknown');
    mkdirSync(controlDir, { recursive: true });
    writeJson(resolve(controlDir, 'assertion.json'), assertion);
    failures.push(...assertionFailures);
    return assertion;
  });

  const burndown = assertions
    .map((assertion) => ({
      id: assertion.id,
      owner: assertion.owner || 'unassigned',
      dueDate: assertion.dueDate || 'missing',
      evidenceArtifactPath: assertion.evidenceArtifactPath || 'missing',
      assertionResult: assertion.assertionResult,
      failureCount: assertion.failures.length,
    }))
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.owner !== b.owner) {
        return a.owner.localeCompare(b.owner);
      }
      return a.id.localeCompare(b.id);
    });

  const report = {
    generatedAt: new Date().toISOString(),
    date: TODAY_UTC,
    source: CONTROL_STATUS_PATH,
    evidenceIndex: EVIDENCE_INDEX_PATH,
    openCriticalControlsCount: openCriticalControls.length,
    failingAssertionsCount: failures.length,
    assertions,
    result: failures.length === 0 ? 'pass' : 'fail',
  };

  const dashboard = {
    generatedAt: report.generatedAt,
    date: TODAY_UTC,
    openCriticalByDueDateOwner: burndown,
  };

  writeJson(resolve(ARTIFACT_ROOT, 'report.json'), report);
  writeJson(resolve(ARTIFACT_ROOT, 'open-critical-controls-dashboard.json'), dashboard);

  const lines = [
    '# Critical Controls Governance Gate',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- openCriticalControlsCount: ${report.openCriticalControlsCount}`,
    `- failingAssertionsCount: ${report.failingAssertionsCount}`,
    `- result: ${report.result}`,
    '',
    '## Open critical controls by due date / owner',
    '',
  ];

  if (burndown.length === 0) {
    lines.push('- none');
  } else {
    for (const item of burndown) {
      lines.push(`- ${item.id} | dueDate=${item.dueDate} | owner=${item.owner} | assertion=${item.assertionResult} | evidence=${item.evidenceArtifactPath}`);
    }
  }

  writeMarkdown(resolve(ARTIFACT_ROOT, 'open-critical-controls-dashboard.md'), lines);

  if (failures.length > 0) {
    console.error('Critical controls governance gate failed:');
    for (const failure of failures) {
      console.error(` - ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Critical controls governance gate passed (${openCriticalControls.length} controls).`);
}

main();
