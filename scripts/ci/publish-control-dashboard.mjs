#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CONTROL_STATUS_PATH = resolve('docs/security-compliance/control-status.json');
const OUTPUT_JSON = resolve(process.env.CONTROL_DASHBOARD_JSON ?? 'release-artifacts/compliance/control-dashboard.json');
const OUTPUT_MD = resolve(process.env.CONTROL_DASHBOARD_MD ?? 'release-artifacts/compliance/control-dashboard.md');
const TODAY_UTC = new Date().toISOString().slice(0, 10);

function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : 'unknown';
}

function normalizeSeverity(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : 'unknown';
}

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }
  return value.trim();
}

function statusBucket(controls) {
  const buckets = new Map();
  for (const control of controls) {
    const key = normalizeStatus(control.status);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function severityBucket(controls) {
  const buckets = new Map();
  for (const control of controls) {
    const key = normalizeSeverity(control.severity);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function frameworkBucket(controls) {
  const buckets = new Map();
  for (const control of controls) {
    const frameworks = Array.isArray(control.frameworks) ? control.frameworks : [];
    for (const framework of frameworks) {
      const key = String(framework).trim().toUpperCase();
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  return Object.fromEntries([...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function main() {
  const payload = JSON.parse(readFileSync(CONTROL_STATUS_PATH, 'utf8'));
  const controls = Array.isArray(payload.controls) ? payload.controls : [];

  const criticalControls = controls.filter((control) => normalizeSeverity(control.severity) === 'critical');
  const criticalPastDue = criticalControls.filter((control) => {
    const target = parseDateOnly(control?.remediation?.targetDate) ?? parseDateOnly(control?.targetDate);
    return target && target < TODAY_UTC && !['completed', 'done', 'closed', 'accepted-risk', 'waived'].includes(normalizeStatus(control.status));
  });

  const openCriticalByDueDateOwner = criticalControls
    .filter((control) => !['completed', 'done', 'closed', 'accepted-risk', 'waived'].includes(normalizeStatus(control.status)))
    .map((control) => ({
      id: control.id,
      control: control.control,
      status: control.status,
      targetDate: parseDateOnly(control?.remediation?.targetDate) ?? parseDateOnly(control?.targetDate) ?? 'missing',
      owner: (
        typeof control?.remediation?.owner === 'string' && control.remediation.owner.trim()
          ? control.remediation.owner.trim()
          : (typeof control.owner === 'string' ? control.owner.trim() : '')
      ) || 'missing',
      evidenceLocation: typeof control?.evidenceLocation === 'string' && control.evidenceLocation.trim()
        ? control.evidenceLocation.trim()
        : 'missing',
    }))
    .sort((a, b) => {
      if (a.targetDate !== b.targetDate) {
        return a.targetDate.localeCompare(b.targetDate);
      }
      if (a.owner !== b.owner) {
        return a.owner.localeCompare(b.owner);
      }
      return a.id.localeCompare(b.id);
    });

  const criticalGaps = criticalControls.filter((control) => {
    const owner = typeof control?.remediation?.owner === 'string' && control.remediation.owner.trim()
      ? control.remediation.owner.trim()
      : (typeof control.owner === 'string' ? control.owner.trim() : '');
    const evidenceLocation = typeof control.evidenceLocation === 'string' ? control.evidenceLocation.trim() : '';
    return !owner || !evidenceLocation;
  });

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    date: TODAY_UTC,
    source: CONTROL_STATUS_PATH,
    totalControls: controls.length,
    byStatus: statusBucket(controls),
    bySeverity: severityBucket(controls),
    byFramework: frameworkBucket(controls),
    criticalPastDue: criticalPastDue.map((control) => ({
      id: control.id,
      control: control.control,
      status: control.status,
      targetDate: control?.remediation?.targetDate ?? control?.targetDate ?? null,
      owner: control?.remediation?.owner ?? control.owner ?? null,
    })),
    openCriticalByDueDateOwner,
    criticalOwnerOrEvidenceGaps: criticalGaps.map((control) => ({
      id: control.id,
      control: control.control,
      owner: control?.remediation?.owner ?? control.owner ?? null,
      evidenceLocation: control.evidenceLocation ?? null,
    })),
  };

  mkdirSync(dirname(OUTPUT_JSON), { recursive: true });
  mkdirSync(dirname(OUTPUT_MD), { recursive: true });

  writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Auditor-Ready Control Dashboard',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- totalControls: ${report.totalControls}`,
    `- source: ${report.source}`,
    '',
    '## Distribution',
    '',
    `- byStatus: ${JSON.stringify(report.byStatus)}`,
    `- bySeverity: ${JSON.stringify(report.bySeverity)}`,
    `- byFramework: ${JSON.stringify(report.byFramework)}`,
    '',
    `## Critical controls: past due (${report.criticalPastDue.length})`,
    '',
  ];

  if (report.criticalPastDue.length === 0) {
    lines.push('- none', '');
  } else {
    for (const control of report.criticalPastDue) {
      lines.push(`- ${control.id} | status=${control.status} | targetDate=${control.targetDate ?? 'missing'} | owner=${control.owner ?? 'missing'}`);
    }
    lines.push('');
  }

  lines.push(`## Critical controls: owner/evidence gaps (${report.criticalOwnerOrEvidenceGaps.length})`, '');
  if (report.criticalOwnerOrEvidenceGaps.length === 0) {
    lines.push('- none', '');
  } else {
    for (const control of report.criticalOwnerOrEvidenceGaps) {
      lines.push(`- ${control.id} | owner=${control.owner ?? 'missing'} | evidenceLocation=${control.evidenceLocation ?? 'missing'}`);
    }
    lines.push('');
  }

  lines.push(`## Open critical controls by due date / owner (${report.openCriticalByDueDateOwner.length})`, '');
  if (report.openCriticalByDueDateOwner.length === 0) {
    lines.push('- none', '');
  } else {
    for (const control of report.openCriticalByDueDateOwner) {
      lines.push(`- ${control.id} | targetDate=${control.targetDate} | owner=${control.owner} | status=${control.status} | evidenceLocation=${control.evidenceLocation}`);
    }
    lines.push('');
  }

  writeFileSync(OUTPUT_MD, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote auditor-ready control dashboard: ${OUTPUT_JSON} and ${OUTPUT_MD}`);
}

main();
