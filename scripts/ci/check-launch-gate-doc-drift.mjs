import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const goNoGoPath = path.join(repoRoot, 'docs/go-no-go-criteria.md');
const matrixPath = path.join(repoRoot, 'docs/operations/launch-evidence/gate-control-matrix.md');
const dashboardPath = path.join(repoRoot, 'docs/launch-readiness.md');

const goNoGoText = readFileSync(goNoGoPath, 'utf8');
const matrixText = readFileSync(matrixPath, 'utf8');
const dashboardText = readFileSync(dashboardPath, 'utf8');

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseMarkdownTableRows(markdown, anchorHeading) {
  const anchorIndex = markdown.indexOf(anchorHeading);
  if (anchorIndex === -1) {
    return [];
  }

  const section = markdown.slice(anchorIndex);
  const lines = section.split('\n');
  const tableStart = lines.findIndex((line) => line.trim().startsWith('|'));
  if (tableStart === -1) {
    return [];
  }

  const rows = [];
  for (let i = tableStart + 2; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) {
      break;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    rows.push(cells);
  }
  return rows;
}

function extractGateIdsFromHeadings(markdown) {
  const matches = [...markdown.matchAll(/^###\s+(G\d+)\s+—/gm)];
  return matches.map((match) => match[1]);
}

function extractGateOwnersFromHeadings(markdown) {
  const owners = new Map();
  for (const match of markdown.matchAll(/^###\s+(G\d+)\s+—[\s\S]*?\*\*Owner:\*\*\s+(.+)$/gm)) {
    owners.set(match[1], match[2].trim());
  }
  return owners;
}

function extractNumericThresholdTokens(text) {
  const matches = text.match(/\b\d+(?:\.\d+)?%?\b/g);
  return matches ? [...new Set(matches)] : [];
}

const errors = [];

const goNoGoGateIds = extractGateIdsFromHeadings(goNoGoText);
const matrixRows = parseMarkdownTableRows(matrixText, '| Gate ID | Owner | CI job(s) | Pass threshold | Artifact path | Waiver policy |');
const dashboardRows = parseMarkdownTableRows(dashboardText, '| Gate ID | Status | Owner | Evidence package | Notes |');

const matrixGateIds = matrixRows.map((row) => row[0]);
const dashboardGateIds = dashboardRows.map((row) => row[0]);

const expectedGateIds = [...goNoGoGateIds].sort();
const matrixGateIdsSorted = [...matrixGateIds].sort();
const dashboardGateIdsSorted = [...dashboardGateIds].sort();

if (JSON.stringify(expectedGateIds) !== JSON.stringify(matrixGateIdsSorted)) {
  errors.push(`Gate ID mismatch between go-no-go and control matrix. go-no-go=${expectedGateIds.join(', ')} matrix=${matrixGateIdsSorted.join(', ')}`);
}

if (JSON.stringify(expectedGateIds) !== JSON.stringify(dashboardGateIdsSorted)) {
  errors.push(`Gate ID mismatch between go-no-go and launch dashboard. go-no-go=${expectedGateIds.join(', ')} dashboard=${dashboardGateIdsSorted.join(', ')}`);
}

const goNoGoOwners = extractGateOwnersFromHeadings(goNoGoText);
const matrixOwnerByGate = new Map(matrixRows.map((row) => [row[0], row[1]]));

for (const gateId of expectedGateIds) {
  const goOwner = goNoGoOwners.get(gateId);
  const matrixOwner = matrixOwnerByGate.get(gateId);
  if (!goOwner || !matrixOwner) {
    continue;
  }
  if (normalize(goOwner) !== normalize(matrixOwner)) {
    errors.push(`Owner mismatch for ${gateId}. go-no-go='${goOwner}' matrix='${matrixOwner}'`);
  }
}

for (const gateId of expectedGateIds) {
  const goSectionMatch = goNoGoText.match(new RegExp(`###\\s+${gateId}\\s+—[\\s\\S]*?(?=\\n###\\s+G\\d+\\s+—|\\n##\\s+Soft Gates|$)`, 'm'));
  const matrixRow = matrixRows.find((row) => row[0] === gateId);
  if (!goSectionMatch || !matrixRow) {
    continue;
  }

  const goNumbers = extractNumericThresholdTokens(goSectionMatch[0]);
  const matrixThresholdNumbers = extractNumericThresholdTokens(matrixRow[3]);

  if (goNumbers.length === 0) {
    continue;
  }

  const missing = goNumbers.filter((token) => !matrixThresholdNumbers.includes(token));
  if (missing.length > 0) {
    errors.push(`Threshold drift for ${gateId}. Missing numeric threshold token(s) in matrix pass threshold: ${missing.join(', ')}`);
  }
}

if (errors.length > 0) {
  console.error('❌ Launch gate doc drift check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`✅ Launch gate doc drift check passed for ${expectedGateIds.length} gate(s).`);
