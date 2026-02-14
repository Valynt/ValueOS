#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const OPENAPI_PATH = 'scripts/openapi.yaml';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function getBaseRef() {
  const envBase = process.env.GITHUB_BASE_REF || process.env.BASE_BRANCH || 'main';
  const candidates = [`origin/${envBase}`, envBase, 'origin/develop', 'develop', 'HEAD~1'];
  for (const candidate of candidates) {
    try {
      run(`git rev-parse --verify ${candidate}`);
      return candidate;
    } catch {}
  }
  throw new Error(`Unable to resolve base branch for comparison (tried: ${candidates.join(', ')})`);
}

function extractOperations(yaml) {
  const lines = yaml.split(/\r?\n/);
  const operations = new Map();
  let inPaths = false;
  let currentPath = null;
  let currentMethod = null;
  let inResponses = false;

  const flush = () => {
    currentMethod = null;
    inResponses = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');

    if (!inPaths && /^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }

    if (!inPaths) continue;

    if (/^\S/.test(line) && !/^paths:/.test(line)) break;

    const pathMatch = line.match(/^\s{2}(['"]?\/[^:]+['"]?):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1].replace(/^['"]|['"]$/g, '');
      flush();
      continue;
    }

    const methodMatch = line.match(/^\s{4}(get|put|post|delete|patch|options|head|trace):\s*$/i);
    if (methodMatch && currentPath) {
      currentMethod = methodMatch[1].toLowerCase();
      inResponses = false;
      operations.set(`${currentPath}::${currentMethod}`, { responseCodes: new Set() });
      continue;
    }

    if (!currentPath || !currentMethod) continue;

    if (/^\s{6}responses:\s*$/.test(line)) {
      inResponses = true;
      continue;
    }

    if (inResponses) {
      if (/^\s{6}\S/.test(line)) {
        inResponses = false;
        continue;
      }
      const responseMatch = line.match(/^\s{8}['"]?([1-5]\d\d|default)['"]?:\s*$/i);
      if (responseMatch) {
        operations.get(`${currentPath}::${currentMethod}`)?.responseCodes.add(responseMatch[1]);
      }
    }
  }

  return operations;
}

function loadFileFromRef(ref) {
  return run(`git show ${ref}:${OPENAPI_PATH}`);
}

try {
  const baseRef = getBaseRef();
  const baseSpec = loadFileFromRef(baseRef);
  const headSpec = readFileSync(OPENAPI_PATH, 'utf8');

  const baseOps = extractOperations(baseSpec);
  const headOps = extractOperations(headSpec);

  const failures = [];

  for (const opKey of baseOps.keys()) {
    if (!headOps.has(opKey)) failures.push(`Removed operation: ${opKey.replace('::', ' ')}`);
  }

  for (const [opKey, baseOp] of baseOps.entries()) {
    if (!headOps.has(opKey)) continue;
    const headCodes = headOps.get(opKey).responseCodes;
    for (const code of baseOp.responseCodes) {
      if (!headCodes.has(code)) failures.push(`Removed response code ${code} from ${opKey.replace('::', ' ')}`);
    }
  }

  if (failures.length > 0) {
    console.error('❌ OpenAPI compatibility check failed: detected potential breaking changes.');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`✅ OpenAPI compatibility check passed against ${baseRef}.`);
} catch (error) {
  console.error(`❌ OpenAPI compatibility check failed: ${error.message}`);
  process.exit(1);
}
