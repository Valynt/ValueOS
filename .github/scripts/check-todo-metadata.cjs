const fs = require('fs');
const path = require('path');

// simple recursive directory reader to avoid bringing in glob
function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      walkDir(fullPath, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// This script scans the repository for TODO/FIXME comments inside strict
// zones and verifies that they include the required metadata pattern.
// It is intended to be run in CI as part of the stability seal or pre-merge
// checks.

const TODO_PATTERN = /\bTODO\(/; // pattern for TODO(ticket:... owner:... date:...)
const FIXME_PATTERN = /\bFIXME\(/;
const METADATA_PATTERN = /\bTODO\(ticket:\s*\S+\s+owner:\s*\S+\s+date:\s*\d{4}-\d{2}-\d{2}\)|\bFIXME\(ticket:\s*\S+\s+owner:\s*\S+\s+date:\s*\d{4}-\d{2}-\d{2}\)/;

function fileHasStrictZone(file) {
  // simple heuristic: file path contains "strict-zone" configuration
  // or is inside a directory listed in config/strict-zones.json
  // For now we'll assume any file under packages/ that is referenced there.
  return true; // we check everything; the inventory script will gate counts
}

let failures = 0;

const files = walkDir(process.cwd());
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if ((TODO_PATTERN.test(line) || FIXME_PATTERN.test(line)) && !METADATA_PATTERN.test(line)) {
      console.error(`${file}:${idx + 1} Missing metadata on strict-zone TODO/FIXME -> ${line.trim()}`);
      failures++;
    }
  });
}

if (failures > 0) {
  console.error(`\n${failures} TODO/FIXME comments missing metadata. See project standards.`);
  process.exit(1);
} else {
  console.log('All TODO/FIXME comments include required metadata.');
}
