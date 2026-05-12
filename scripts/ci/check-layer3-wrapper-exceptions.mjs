#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MARKER = 'Allowed service-local exception for Layer 3 service wrapper';
const TRACKING_DOC = path.resolve('docs/architecture/layer3-wrapper-exceptions.md');
const SCAN_DIRS = [
  path.resolve('services/layer3-knowledge/src'),
  path.resolve('value_fabric/layer3'),
];
const SUNSET_ENFORCEMENT_DATE = '2026-09-30';

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, files);
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function collectMarkers() {
  const findings = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walkFiles(dir)) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!line.includes(MARKER)) return;
        const idMatch = line.match(/L3W-EXC-\d{3}/);
        findings.push({
          file: path.relative(process.cwd(), file),
          line: index + 1,
          id: idMatch?.[0] ?? null,
        });
      });
    }
  }
  return findings;
}

function parseDoc(docText) {
  const docIds = [...docText.matchAll(/id:\s*(L3W-EXC-\d{3})/g)].map((m) => m[1]);
  const entries = [...docText.matchAll(/-\s+id:\s*(L3W-EXC-\d{3})[\s\S]*?(?=\n-\s+id:|$)/g)].map(
    (m) => m[0]
  );
  return { docIds, entriesById: new Map(entries.map((entry) => [entry.match(/L3W-EXC-\d{3}/)[0], entry])) };
}

function enforceSunset(entriesById) {
  const today = new Date().toISOString().slice(0, 10);
  if (today <= SUNSET_ENFORCEMENT_DATE) return [];

  const violations = [];
  for (const [id, entry] of entriesById.entries()) {
    const sunset = entry.match(/sunset_date:\s*(\d{4}-\d{2}-\d{2})/);
    const extension = /extension_approved:\s*true/.test(entry);
    if (sunset && sunset[1] <= SUNSET_ENFORCEMENT_DATE && !extension) {
      violations.push(`${id} is past sunset and missing extension_approved: true`);
    }
  }
  return violations;
}

function main() {
  const findings = collectMarkers();
  const docText = fs.readFileSync(TRACKING_DOC, 'utf8');
  const { docIds, entriesById } = parseDoc(docText);

  const errors = [];
  const findingIds = findings.map((f) => f.id).filter(Boolean);

  for (const finding of findings) {
    if (!finding.id) {
      errors.push(
        `${finding.file}:${finding.line} marker is missing ID (expected L3W-EXC-###).`
      );
    }
  }

  for (const id of findingIds) {
    if (!docIds.includes(id)) {
      errors.push(`Marker ID ${id} exists in code but is missing from ${path.relative(process.cwd(), TRACKING_DOC)}.`);
    }
  }

  for (const id of docIds) {
    if (!findingIds.includes(id)) {
      errors.push(`Tracking doc ID ${id} has no matching marker in scoped source trees.`);
    }
  }

  errors.push(...enforceSunset(entriesById));

  if (errors.length) {
    console.error('Layer 3 wrapper exception policy check failed:\n');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `Layer 3 wrapper exception policy check passed. Scoped markers found: ${findings.length}.`
  );
}

main();
