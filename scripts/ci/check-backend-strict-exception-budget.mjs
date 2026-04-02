#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const backendRoot = path.join(repoRoot, 'packages', 'backend');
const tsconfigPath = path.join(backendRoot, 'tsconfig.strict-exceptions.json');
const budgetPath = path.join(repoRoot, 'config', 'backend-strict-exception-budgets.json');

const isTsSource = (filePath) => {
  if (!filePath.endsWith('.ts')) return false;
  if (filePath.endsWith('.d.ts')) return true;
  if (filePath.includes('__tests__/')) return false;
  if (/\.(test|spec)\.ts$/.test(filePath)) return false;
  return true;
};

const toPosix = (value) => value.split(path.sep).join('/');

function countTsFiles(folderPath) {
  const abs = path.join(backendRoot, folderPath);
  if (!fs.existsSync(abs)) {
    return 0;
  }

  let count = 0;
  const stack = [abs];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      const relative = toPosix(path.relative(backendRoot, fullPath));
      if (isTsSource(relative)) {
        count += 1;
      }
    }
  }

  return count;
}

function toFolderFromInclude(pattern) {
  return pattern
    .replace(/\*\*\/\*\.d\.ts$/, '')
    .replace(/\*\*\/\*\.ts$/, '')
    .replace(/\/$/, '');
}

const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
const budgetDoc = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));

const includePatterns = (tsconfig.include ?? []).filter((entry) => entry.endsWith('/**/*.ts') || entry.endsWith('/**/*.d.ts'));
const includeFolders = new Set(includePatterns.map(toFolderFromInclude));

const exceptionsByPath = new Map((budgetDoc.exceptionFolders ?? []).map((entry) => [entry.path, entry]));
let failures = 0;

console.log('Backend strict-exception budget status');

for (const folder of includeFolders) {
  if (!exceptionsByPath.has(folder)) {
    console.error(`❌ include path \"${folder}\" is not listed in ${path.relative(repoRoot, budgetPath)} exceptionFolders.`);
    failures += 1;
  }
}

for (const [folder, cfg] of exceptionsByPath.entries()) {
  const current = countTsFiles(folder);
  const budget = Number(cfg.budget);
  const status = current <= budget ? '✅' : '❌';
  console.log(`${status} ${folder}: ${current} files (budget ${budget}, nextTarget ${cfg.nextTarget ?? 'n/a'}, sunset ${cfg.sunsetDate ?? budgetDoc.meta?.defaultSunsetDate ?? 'n/a'})`);
  if (current > budget) {
    failures += 1;
  }
  if (!includeFolders.has(folder) && budget > 0) {
    console.error(`❌ ${folder} has budget ${budget} but is missing from tsconfig.strict-exceptions includes.`);
    failures += 1;
  }
}

for (const critical of budgetDoc.criticalModules ?? []) {
  const criticalPath = critical.path;
  const hasException = [...includeFolders].some((folder) => folder === criticalPath || folder.startsWith(`${criticalPath}/`));
  const current = hasException ? countTsFiles(criticalPath) : 0;
  const status = hasException || current > 0 ? '❌' : '✅';
  console.log(`${status} critical ${criticalPath}: ${current} exception files (budget ${critical.budget}, sunset ${critical.sunsetDate})`);
  if (hasException || current > Number(critical.budget ?? 0)) {
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\nBackend strict-exception budget failed with ${failures} violation(s).`);
  process.exit(1);
}

console.log('\nBackend strict-exception budget passed.');
