import fs from 'node:fs';
import path from 'node:path';

const coverageDir = process.argv[2] ?? 'coverage';
const finalPath = path.join(coverageDir, 'coverage-final.json');

if (!fs.existsSync(finalPath)) {
  console.error(`Coverage file not found: ${finalPath}`);
  process.exit(1);
}

const coverageData = JSON.parse(fs.readFileSync(finalPath, 'utf8'));

const packageBuckets = new Map();

const pct = (covered, total) => (total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2)));

const ensureBucket = (bucketName) => {
  if (!packageBuckets.has(bucketName)) {
    packageBuckets.set(bucketName, {
      files: 0,
      statements: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 },
      functions: { covered: 0, total: 0 },
      lines: { covered: 0, total: 0 },
    });
  }

  return packageBuckets.get(bucketName);
};

for (const [filePath, fileCoverage] of Object.entries(coverageData)) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const scopedPath = normalizedPath.split('/apps/')[1]
    ? `apps/${normalizedPath.split('/apps/')[1]}`
    : normalizedPath.split('/packages/')[1]
      ? `packages/${normalizedPath.split('/packages/')[1]}`
      : null;

  if (!scopedPath) continue;

  const [scope, packageName] = scopedPath.split('/');
  if (!scope || !packageName) continue;

  const bucket = ensureBucket(`${scope}/${packageName}`);
  bucket.files += 1;

  const statements = Object.values(fileCoverage.s ?? {});
  bucket.statements.total += statements.length;
  bucket.statements.covered += statements.filter((count) => count > 0).length;

  const functions = Object.values(fileCoverage.f ?? {});
  bucket.functions.total += functions.length;
  bucket.functions.covered += functions.filter((count) => count > 0).length;

  const branches = Object.values(fileCoverage.b ?? {}).flat();
  bucket.branches.total += branches.length;
  bucket.branches.covered += branches.filter((count) => count > 0).length;

  const lines = Object.values(fileCoverage.l ?? {});
  bucket.lines.total += lines.length;
  bucket.lines.covered += lines.filter((count) => count > 0).length;
}

const packages = Array.from(packageBuckets.entries())
  .map(([name, metrics]) => ({
    package: name,
    files: metrics.files,
    statements: pct(metrics.statements.covered, metrics.statements.total),
    branches: pct(metrics.branches.covered, metrics.branches.total),
    functions: pct(metrics.functions.covered, metrics.functions.total),
    lines: pct(metrics.lines.covered, metrics.lines.total),
  }))
  .sort((a, b) => a.package.localeCompare(b.package));

const snapshot = {
  generatedAt: new Date().toISOString(),
  gitSha: process.env.GITHUB_SHA ?? 'local',
  runId: process.env.GITHUB_RUN_ID ?? 'local',
  runNumber: process.env.GITHUB_RUN_NUMBER ?? 'local',
  packages,
};

const outDir = path.join(coverageDir, 'trend');
fs.mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, 'package-coverage-trend.json');
fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2));

const mdLines = [
  '# Coverage Trend Snapshot',
  '',
  `- Generated: ${snapshot.generatedAt}`,
  `- Commit: ${snapshot.gitSha}`,
  `- Run: ${snapshot.runNumber} (${snapshot.runId})`,
  '',
  '| Package | Files | Statements | Branches | Functions | Lines |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...packages.map((pkg) => `| ${pkg.package} | ${pkg.files} | ${pkg.statements}% | ${pkg.branches}% | ${pkg.functions}% | ${pkg.lines}% |`),
  '',
  '> Store this artifact across runs to monitor regressions over time by package.',
];

const mdPath = path.join(outDir, 'package-coverage-trend.md');
fs.writeFileSync(mdPath, mdLines.join('\n'));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);
