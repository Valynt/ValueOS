import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const governanceCommand = 'pnpm run typecheck:signal --verify';
const ciVerifyCommand = 'pnpm run ci:verify';

const requiredWorkflows = [
  '.github/workflows/ci-cd.yml',
  '.github/workflows/ci-tests.yml',
  '.github/workflows/pr-validation.yml',
  '.github/workflows/ci-bootstrap.yml',
  '.github/workflows/ci.yml',
];

async function checkCiVerifyContract() {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const ciVerifyScript = packageJson?.scripts?.['ci:verify'];

  if (!ciVerifyScript || !ciVerifyScript.includes(governanceCommand)) {
    throw new Error(
      `package.json script \"ci:verify\" must include \"${governanceCommand}\" as a blocking governance gate.`
    );
  }
}

async function checkWorkflowGates() {
  const failures = [];

  for (const workflow of requiredWorkflows) {
    const workflowPath = path.join(repoRoot, workflow);
    const content = await readFile(workflowPath, 'utf8');

    const hasCiVerify = content.includes(ciVerifyCommand);
    const hasDirectGovernance = content.includes(governanceCommand);

    if (!hasCiVerify && !hasDirectGovernance) {
      failures.push(`${workflow} (missing \"${ciVerifyCommand}\" or \"${governanceCommand}\")`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Governance gate missing in required workflows:\n- ${failures.join('\n- ')}`
    );
  }
}

await checkCiVerifyContract();
await checkWorkflowGates();

console.log('✅ Governance gate contract verified for ci:verify and required workflows.');
