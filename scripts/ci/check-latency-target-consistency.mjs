import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = ''] = arg.split('=');
    return [key, value];
  }),
);

const baseSha = args.get('--base-sha');
const headSha = args.get('--head-sha');

const includePrefixes = [
  'infra/testing/',
  'infra/prometheus/alerts/',
  'infra/grafana/dashboards/',
  'infra/k8s/base/',
  'docs/operations/',
  'docs/runbooks/',
  'scripts/perf/',
  '.github/workflows/',
];

const includeExtensions = /\.(md|ya?ml|json|js|mjs|ts|py)$/u;
const legacyBudgetPattern = /(450\s*ms|600\s*ms|1000\s*ms|1200\s*ms|\b1\s*s\b)/iu;
const latencyContextPattern = /(latency|p95|acknowledg|ttfb|completion|benchmark|slo|hpa|alert)/iu;
const thresholdIndicatorPattern = /(target|threshold|budget|policy|p\(95\)|p95|<=|>=|<|>|\d+\s*ms|\d+s)/iu;

function listTrackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
}

function listChangedFiles() {
  if (!baseSha || !headSha) {
    const tracked = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=AMR', 'HEAD'],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    const untracked = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    return [...new Set([...tracked, ...untracked])];
  }

  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=AMR', baseSha, headSha],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  return output.trim().split('\n').filter(Boolean);
}

function isCandidate(filePath) {
  return includePrefixes.some((prefix) => filePath.startsWith(prefix)) && includeExtensions.test(filePath);
}

const files = listChangedFiles().filter(isCandidate);
const errors = [];

for (const relativePath of files) {
  const absolutePath = path.join(repoRoot, relativePath);
  const source = readFileSync(absolutePath, 'utf8');
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    if (!latencyContextPattern.test(line)) {
      return;
    }

    if (legacyBudgetPattern.test(line)) {
      errors.push(
        `${relativePath}:${index + 1} uses a legacy latency budget (${line.trim()}).`,
      );
    }

    if (/interactive/.test(lower) && thresholdIndicatorPattern.test(lower)) {
      const conflictingInteractive = /250\s*ms|300\s*ms|350\s*ms|450\s*ms|550\s*ms|600\s*ms|1000\s*ms|1500\s*ms|2000\s*ms|3000\s*ms|[<>]=?\s*(250|300|350|450|550|600|1000|1500|2000|3000)/.test(lower);
      const expectedInteractive = /200\s*ms|<=\s*200|<\s*200|>\s*200|p\(95\)<200/.test(lower);
      if (conflictingInteractive && !expectedInteractive) {
        errors.push(
          `${relativePath}:${index + 1} must keep the interactive completion p95 target at 200ms (${line.trim()}).`,
        );
      }
    }

    if (/orchestration/.test(lower) && /(acknowledg|ttfb)/.test(lower) && thresholdIndicatorPattern.test(lower)) {
      const conflictingAck = /250\s*ms|300\s*ms|350\s*ms|450\s*ms|550\s*ms|600\s*ms|1000\s*ms|1500\s*ms|2000\s*ms|3000\s*ms|[<>]=?\s*(250|300|350|450|550|600|1000|1500|2000|3000)/.test(lower);
      const expectedAck = /200\s*ms|<=\s*200|<\s*200|>\s*200|p\(95\)<200/.test(lower);
      if (conflictingAck && !expectedAck) {
        errors.push(
          `${relativePath}:${index + 1} must keep the orchestration acknowledgment p95 target at 200ms (${line.trim()}).`,
        );
      }
    }

    if (/orchestration/.test(lower) && /completion/.test(lower) && thresholdIndicatorPattern.test(lower)) {
      const conflictingCompletion = /450\s*ms|600\s*ms|1000\s*ms|1200\s*ms|1500\s*ms|2000\s*ms|[<>]=?\s*(450|600|1000|1200|1500|2000)/.test(lower);
      const expectedCompletion = /3000\s*ms|<=\s*3000|<\s*3000|>\s*3000|p\(95\)<3000|3s/.test(lower);
      if (conflictingCompletion && !expectedCompletion) {
        errors.push(
          `${relativePath}:${index + 1} must keep the orchestration completion exception policy at 3000ms (${line.trim()}).`,
        );
      }
    }
  });
}

if (errors.length > 0) {
  console.error('❌ Latency target consistency check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`✅ Latency target consistency check passed for ${files.length} file(s).`);
