#!/usr/bin/env node

import fs from 'node:fs';

const GO_NO_GO_PATH = 'docs/go-no-go-criteria.md';
const MATRIX_PATH = 'docs/operations/launch-evidence/gate-control-matrix.md';
const DASHBOARD_PATH = 'docs/launch-readiness.md';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function parseJsonBlock(markdown, label, path) {
  const re = new RegExp('```json\\s+' + label + '\\s*\\n([\\s\\S]*?)\\n```', 'm');
  const match = markdown.match(re);
  if (!match) {
    throw new Error(`Missing \`${label}\` JSON block in ${path}`);
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Invalid JSON in \`${label}\` block in ${path}: ${error.message}`);
  }
}

function parseMatrixRows(markdown) {
  const heading = '## Gate control matrix';
  const start = markdown.indexOf(heading);
  if (start === -1) {
    throw new Error(`Missing heading \`${heading}\` in ${MATRIX_PATH}`);
  }

  const lines = markdown.slice(start + heading.length).split('\n');
  const table = [];
  let inTable = false;

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      inTable = true;
      table.push(line);
      continue;
    }

    if (inTable) {
      break;
    }
  }

  if (table.length < 3) {
    throw new Error(`Could not parse gate table in ${MATRIX_PATH}`);
  }

  return table
    .slice(2)
    .map((row) => {
      const cols = row.split('|').map((cell) => cell.trim());
      return {
        gateId: cols[1],
        passThreshold: cols[4],
      };
    })
    .filter((row) => /^G\d+$/.test(row.gateId));
}

function normalizeThreshold(text) {
  return text
    .replaceAll('≥', '>=')
    .replaceAll('≤', '<=')
    .replaceAll('`', '')
    .replaceAll('“', '"')
    .replaceAll('”', '"')
    .replaceAll("'", '')
    .replace(/\s+/g, ' ')
    .trim();
}

const goNoGo = read(GO_NO_GO_PATH);
const matrix = read(MATRIX_PATH);
const dashboard = read(DASHBOARD_PATH);

const goNoGoCatalog = parseJsonBlock(goNoGo, 'gate-threshold-catalog', GO_NO_GO_PATH);
const matrixCatalog = parseJsonBlock(matrix, 'gate-threshold-catalog', MATRIX_PATH);
const matrixRows = parseMatrixRows(matrix);

const errors = [];

const goNoGoIds = Object.keys(goNoGoCatalog).sort();
const matrixCatalogIds = Object.keys(matrixCatalog).sort();
const matrixRowIds = matrixRows.map((row) => row.gateId).sort();

if (JSON.stringify(goNoGoIds) !== JSON.stringify(matrixCatalogIds)) {
  errors.push(`Gate IDs differ between ${GO_NO_GO_PATH} and ${MATRIX_PATH} JSON catalogs.`);
}

if (JSON.stringify(goNoGoIds) !== JSON.stringify(matrixRowIds)) {
  errors.push(`Gate IDs differ between ${GO_NO_GO_PATH} catalog and ${MATRIX_PATH} table rows.`);
}

for (const gateId of goNoGoIds) {
  const sourceThreshold = normalizeThreshold(String(goNoGoCatalog[gateId] ?? ''));
  const matrixThreshold = normalizeThreshold(String(matrixCatalog[gateId] ?? ''));
  if (sourceThreshold !== matrixThreshold) {
    errors.push(`${gateId} threshold differs between ${GO_NO_GO_PATH} and ${MATRIX_PATH} JSON catalogs.`);
  }

  const matrixRow = matrixRows.find((row) => row.gateId === gateId);
  if (!matrixRow) {
    errors.push(`${gateId} missing from ${MATRIX_PATH} table.`);
    continue;
  }

  if (normalizeThreshold(matrixRow.passThreshold) !== matrixThreshold) {
    errors.push(`${gateId} pass threshold in ${MATRIX_PATH} table diverges from its JSON catalog entry.`);
  }
}

if (!dashboard.includes('./operations/launch-evidence/gate-control-matrix.md')) {
  errors.push(`${DASHBOARD_PATH} must reference the launch gate control matrix.`);
}

if (!dashboard.includes('./go-no-go-criteria.md')) {
  errors.push(`${DASHBOARD_PATH} must reference canonical go/no-go criteria.`);
}

if (errors.length > 0) {
  console.error('❌ Launch gate docs consistency check failed.');
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('✅ Launch gate docs consistency check passed.');
