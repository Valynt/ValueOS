#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const deployWorkflowPath = resolve(root, '.github/workflows/deploy.yml');
const deployWorkflow = readFileSync(deployWorkflowPath, 'utf8');

const failures = [];

if (!/^\s{2}dast-gate:\s*$/m.test(deployWorkflow)) {
  failures.push('- Missing `dast-gate` job in .github/workflows/deploy.yml.');
}

if (!/name:\s*DAST Gate/.test(deployWorkflow)) {
  failures.push('- `dast-gate` must expose the required check name `DAST Gate`.');
}

if (!/DAST_FAIL_ON_HIGH:\s*"1"/.test(deployWorkflow)) {
  failures.push('- `dast-gate` must set DAST_FAIL_ON_HIGH="1" (any high finding fails).');
}

if (!/DAST_FAIL_ON_MEDIUM:\s*"5"/.test(deployWorkflow)) {
  failures.push('- `dast-gate` must set DAST_FAIL_ON_MEDIUM="5" (more than 5 medium findings fail).');
}

if (!/if\s+counts\["high"\]\s*>\s*max_high:\s*[\s\S]*breached\.append\(f"high\(\{counts\['high'\]\}\s*>\s*\{max_high\}\)"\)/m.test(deployWorkflow)) {
  failures.push('- `dast-gate` must enforce high severity threshold comparison in the gate script.');
}

if (!/if\s+counts\["medium"\]\s*>\s*max_medium:\s*[\s\S]*breached\.append\(f"medium\(\{counts\['medium'\]\}\s*>\s*\{max_medium\}\)"\)/m.test(deployWorkflow)) {
  failures.push('- `dast-gate` must enforce medium severity threshold comparison in the gate script.');
}

if (!/if\s+breached:\s*[\s\S]*sys\.exit\(1\)/m.test(deployWorkflow)) {
  failures.push('- `dast-gate` must exit non-zero when thresholds are breached.');
}

if (failures.length > 0) {
  console.error('❌ DAST threshold policy drift detected:');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log('✅ DAST threshold policy verified: HIGH findings fail and MEDIUM findings >5 fail.');
