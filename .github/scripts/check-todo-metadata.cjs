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

const TODO_TOKEN_PATTERN = /\bTODO\b/;
const FIXME_TOKEN_PATTERN = /\bFIXME\b/;
const METADATA_PATTERN =
  /\bTODO\(ticket:\s*\S+\s+owner:\s*\S+\s+date:\s*\d{4}-\d{2}-\d{2}\)|\bFIXME\(ticket:\s*\S+\s+owner:\s*\S+\s+date:\s*\d{4}-\d{2}-\d{2}\)/;

const PROD_PATH_PREFIXES = [
  path.join('packages', 'backend', 'src') + path.sep,
  path.join('apps', 'ValyntApp', 'src') + path.sep,
];

function isProductionPath(file) {
  const normalized = file.split(path.sep).join(path.sep);
  return PROD_PATH_PREFIXES.some((prefix) => normalized.includes(prefix));
}

function isTestPath(file) {
  return (
    file.includes(`${path.sep}__tests__${path.sep}`) ||
    /\.test\.(ts|tsx|js|jsx)$/.test(file) ||
    /\.spec\.(ts|tsx|js|jsx)$/.test(file)
  );
}

let failures = 0;

const files = walkDir(process.cwd());
for (const file of files) {
  if (!isProductionPath(file) || isTestPath(file)) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if ((TODO_TOKEN_PATTERN.test(line) || FIXME_TOKEN_PATTERN.test(line)) && !METADATA_PATTERN.test(line)) {
      console.error(
        `${file}:${idx + 1} Untracked TODO/FIXME in production path -> ${line.trim()}`
      );
      failures++;
    }
  });
}

if (failures > 0) {
  console.error(
    `\n${failures} untracked TODO/FIXME markers found in production paths. Use TODO(ticket: ... owner: ... date: YYYY-MM-DD).`
  );
  process.exit(1);
} else {
  console.log('All TODO/FIXME comments in production paths include required metadata.');
}
