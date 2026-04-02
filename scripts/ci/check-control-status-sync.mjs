#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GUIDE_PATH = resolve('docs/security-compliance/compliance-guide.md');
const STATUS_PATH = resolve('docs/security-compliance/control-status.json');

const RECORD_PATTERN = /^\s*-\s+Remediation Record:\s+`(CR-\d{3})`\s*\|\s*Framework:\s*([^|]+)\|\s*Owner:\s*([^|]+)\|\s*Target date:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*Status:\s*([^|]+)\|\s*Evidence location:\s*`([^`]+)`\s*$/;
const CHECKBOX_PATTERN = /^\s*-\s+\[\s\]\s+(.+)$/;

function parseGuideRecords(markdown) {
  const lines = markdown.split(/\r?\n/);
  const records = [];
  let pendingControl = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const checkboxMatch = line.match(CHECKBOX_PATTERN);
    if (checkboxMatch) {
      pendingControl = checkboxMatch[1].trim();
      continue;
    }

    const recordMatch = line.match(RECORD_PATTERN);
    if (!recordMatch) {
      continue;
    }

    records.push({
      id: recordMatch[1],
      control: pendingControl,
      framework: recordMatch[2].trim(),
      owner: recordMatch[3].trim(),
      targetDate: recordMatch[4].trim(),
      status: recordMatch[5].trim(),
      evidenceLocation: recordMatch[6].trim(),
      line: index + 1,
    });
  }

  return records;
}

function main() {
  const guide = readFileSync(GUIDE_PATH, 'utf8');
  const parsed = parseGuideRecords(guide);
  const statusPayload = JSON.parse(readFileSync(STATUS_PATH, 'utf8'));
  const controls = Array.isArray(statusPayload.controls) ? statusPayload.controls : [];
  const byId = new Map(controls.map((control) => [control.id, control]));

  const errors = [];

  for (const record of parsed) {
    const control = byId.get(record.id);
    if (!control) {
      errors.push(`MISSING_CONTROL ${record.id}: referenced at compliance-guide.md:${record.line}`);
      continue;
    }

    if (record.control && control.control !== record.control) {
      errors.push(`CONTROL_TEXT_MISMATCH ${record.id}: guide=\"${record.control}\" status=\"${control.control}\"`);
    }

    const frameworks = Array.isArray(control.frameworks) ? control.frameworks.map((framework) => String(framework).trim()) : [];
    if (!frameworks.includes(record.framework)) {
      errors.push(`FRAMEWORK_MISMATCH ${record.id}: guide=${record.framework}, status=${frameworks.join(',') || '<none>'}`);
    }

    if ((control.owner ?? '').trim() !== record.owner) {
      errors.push(`OWNER_MISMATCH ${record.id}: guide=${record.owner}, status=${(control.owner ?? '').trim() || '<empty>'}`);
    }

    if ((control.targetDate ?? '').trim() !== record.targetDate) {
      errors.push(`TARGET_DATE_MISMATCH ${record.id}: guide=${record.targetDate}, status=${(control.targetDate ?? '').trim() || '<empty>'}`);
    }

    if ((control.status ?? '').trim().toLowerCase() !== record.status.toLowerCase()) {
      errors.push(`STATUS_MISMATCH ${record.id}: guide=${record.status}, status=${(control.status ?? '').trim() || '<empty>'}`);
    }

    if ((control.evidenceLocation ?? '').trim() !== record.evidenceLocation) {
      errors.push(`EVIDENCE_LOCATION_MISMATCH ${record.id}: guide=${record.evidenceLocation}, status=${(control.evidenceLocation ?? '').trim() || '<empty>'}`);
    }
  }

  for (const control of controls) {
    const existsInGuide = parsed.some((record) => record.id === control.id);
    if (!existsInGuide) {
      errors.push(`ORPHAN_CONTROL ${control.id}: present in control-status.json but not referenced by a Remediation Record`);
    }
  }

  if (errors.length > 0) {
    console.error('Control status sync check failed:');
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log(`Control status sync check passed (${parsed.length} remediation records parsed from compliance-guide.md).`);
}

main();
