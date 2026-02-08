#!/usr/bin/env node

/**
 * Lint Analysis Script
 * Generates baseline reports and analysis for ESLint issues
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const LINT_DIR = '.lint';
const PACKAGES = [
  'backend',
  'shared',
  'agents',
  'components',
  'valynt-app',
  'vosacademy',
  'mcp-dashboard'
];

function ensureLintDir() {
  if (!fs.existsSync(LINT_DIR)) {
    fs.mkdirSync(LINT_DIR, { recursive: true });
  }
}

function runLintAnalysis(packageName) {
  const packagePath = path.join('packages', packageName);
  const appPath = path.join('apps', packageName);

  let targetPath;
  if (fs.existsSync(packagePath)) {
    targetPath = packagePath;
  } else if (fs.existsSync(appPath)) {
    targetPath = appPath;
  } else {
    console.log(`Package ${packageName} not found, skipping...`);
    return null;
  }

  const outputFile = path.join(LINT_DIR, `${packageName}.json`);

  try {
    console.log(`Analyzing ${packageName}...`);

    // Run eslint and capture output
    const eslintCmd = `npx --yes eslint "${targetPath}/src/" --format json`;
    const output = execSync(eslintCmd, {
      encoding: 'utf8',
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    const results = JSON.parse(output);

    // Write to file
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

    // Calculate summary
    const totalIssues = results.reduce((sum, file) => sum + file.messages.length, 0);
    const errorCount = results.reduce((sum, file) =>
      sum + file.messages.filter(m => m.severity === 2).length, 0);
    const warningCount = results.reduce((sum, file) =>
      sum + file.messages.filter(m => m.severity === 1).length, 0);

    console.log(`  ${packageName}: ${totalIssues} issues (${errorCount} errors, ${warningCount} warnings)`);

    return { packageName, totalIssues, errorCount, warningCount, results };

  } catch (error) {
    console.error(`Failed to analyze ${packageName}:`, error.message);
    return null;
  }
}

function generateSummaryReport(allResults) {
  const summary = {
    generatedAt: new Date().toISOString(),
    totalPackages: allResults.length,
    totalIssues: allResults.reduce((sum, r) => sum + r.totalIssues, 0),
    totalErrors: allResults.reduce((sum, r) => sum + r.errorCount, 0),
    totalWarnings: allResults.reduce((sum, r) => sum + r.warningCount, 0),
    packages: allResults.map(r => ({
      name: r.packageName,
      issues: r.totalIssues,
      errors: r.errorCount,
      warnings: r.warningCount
    }))
  };

  // Find top rules
  const ruleCounts = {};
  allResults.forEach(pkg => {
    pkg.results.forEach(file => {
      file.messages.forEach(msg => {
        const rule = msg.ruleId || 'unknown';
        ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
      });
    });
  });

  const topRules = Object.entries(ruleCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([rule, count]) => ({ rule, count }));

  summary.topRules = topRules;

  fs.writeFileSync(path.join(LINT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== LINT ANALYSIS SUMMARY ===');
  console.log(`Total packages analyzed: ${summary.totalPackages}`);
  console.log(`Total issues: ${summary.totalIssues}`);
  console.log(`Total errors: ${summary.totalErrors}`);
  console.log(`Total warnings: ${summary.totalWarnings}`);
  console.log('\nTop 10 rules:');
  topRules.forEach(({ rule, count }, i) => {
    console.log(`  ${i + 1}. ${rule}: ${count}`);
  });
}

function main() {
  console.log('Starting lint analysis...');
  ensureLintDir();

  const results = [];

  for (const packageName of PACKAGES) {
    const result = runLintAnalysis(packageName);
    if (result) {
      results.push(result);
    }
  }

  if (results.length > 0) {
    generateSummaryReport(results);
    console.log(`\nReports saved to ${LINT_DIR}/ directory`);
  } else {
    console.log('No packages were successfully analyzed');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}