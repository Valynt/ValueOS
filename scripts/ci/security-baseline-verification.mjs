import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();

async function assertContains(filePath, checks) {
  const absolutePath = path.join(repoRoot, filePath);
  const content = await readFile(absolutePath, 'utf8');
  const failures = checks.filter((check) => !check.pattern.test(content));

  if (failures.length > 0) {
    const details = failures.map((failure) => `- ${failure.message}`).join('\n');
    throw new Error(`Security baseline check failed for ${filePath}:\n${details}`);
  }
}

await assertContains('packages/backend/src/server.ts', [
  {
    pattern: /import\s*\{[^}]*securityHeadersMiddleware[^}]*\}\s*from\s*["']\.\/middleware\/securityHeaders\.js["'];?/m,
    message: 'Missing securityHeadersMiddleware import from middleware/securityHeaders.js',
  },
  {
    pattern: /app\.use\(securityHeadersMiddleware\);/m,
    message: 'Missing app.use(securityHeadersMiddleware); middleware wiring',
  },
]);

await assertContains('.github/workflows/ci.yml', [
  {
    pattern: /^\s{2}sast:$/m,
    message: 'Missing SAST job definition (job id: sast)',
  },
  {
    pattern: /uses:\s*semgrep\/semgrep-action@/m,
    message: 'Missing Semgrep action in SAST job',
  },
  {
    pattern: /^\s{2}sca-license:$/m,
    message: 'Missing SCA job definition (job id: sca-license)',
  },
  {
    pattern: /uses:\s*aquasecurity\/trivy-action@/m,
    message: 'Missing Trivy action in SCA job',
  },
]);

console.log('✅ Security baseline verification passed (headers middleware + SAST/SCA controls present).');
