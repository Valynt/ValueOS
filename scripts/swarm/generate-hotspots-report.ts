#!/usr/bin/env node
/**
 * TypeScript Error Hotspots Report Generator
 * 
 * Generates detailed analysis of error distribution and hotspots
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface TSError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  fullPath: string;
}

interface FileHotspot {
  file: string;
  errorCount: number;
  codes: Record<string, number>;
  lines: number[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface ErrorCategory {
  code: string;
  description: string;
  count: number;
  autoFixable: boolean;
  avgEffort: number; // minutes per error
}

interface HotspotReport {
  generatedAt: string;
  summary: {
    totalErrors: number;
    totalFiles: number;
    uniqueCodes: number;
    criticalFiles: number;
    estimatedHours: number;
  };
  errorCategories: ErrorCategory[];
  fileHotspots: FileHotspot[];
  packageBreakdown: Record<string, {
    errors: number;
    files: number;
    topCodes: string[];
  }>;
  recommendations: string[];
}

const REPORT_PATH = resolve('.windsurf/swarm/hotspots-report.json');

const ERROR_DESCRIPTIONS: Record<string, { desc: string; autoFixable: boolean; effort: number }> = {
  'TS2339': { desc: 'Property does not exist on type', autoFixable: false, effort: 5 },
  'TS2322': { desc: 'Type is not assignable to type', autoFixable: false, effort: 8 },
  'TS2345': { desc: 'Argument type not assignable', autoFixable: false, effort: 6 },
  'TS18047': { desc: 'Object is possibly null', autoFixable: true, effort: 2 },
  'TS18048': { desc: 'Object is possibly undefined', autoFixable: true, effort: 2 },
  'TS2532': { desc: 'Object is possibly undefined', autoFixable: true, effort: 2 },
  'TS7006': { desc: 'Parameter implicitly has an any type', autoFixable: true, effort: 2 },
  'TS2769': { desc: 'No overload matches this call', autoFixable: false, effort: 10 },
  'TS2741': { desc: 'Property is missing in type', autoFixable: false, effort: 4 },
  'TS2304': { desc: 'Cannot find name', autoFixable: false, effort: 3 },
  'TS7019': { desc: 'Rest parameter implicitly has an any[] type', autoFixable: true, effort: 2 },
};

function runTypeCheck(): string {
  console.log('Collecting TypeScript errors...');
  try {
    return execSync('pnpm run typecheck:full 2>&1', {
      cwd: resolve('.'),
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error: any) {
    return error.stdout || error.message;
  }
}

function parseErrors(output: string): TSError[] {
  const errors: TSError[] = [];
  const lines = output.split('\n');
  const errorPattern = /^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
  
  for (const line of lines) {
    const match = line.match(errorPattern);
    if (match) {
      const [_, file, lineNum, col, code, message] = match;
      errors.push({
        file: file.trim(),
        line: parseInt(lineNum, 10),
        column: parseInt(col, 10),
        code,
        message: message.trim(),
        fullPath: resolve(file.trim()),
      });
    }
  }
  
  return errors;
}

function analyzeFileHotspots(errors: TSError[]): FileHotspot[] {
  const byFile: Record<string, TSError[]> = {};
  
  for (const error of errors) {
    if (!byFile[error.file]) {
      byFile[error.file] = [];
    }
    byFile[error.file].push(error);
  }
  
  return Object.entries(byFile).map(([file, fileErrors]) => {
    const codes: Record<string, number> = {};
    const lines: number[] = [];
    
    for (const e of fileErrors) {
      codes[e.code] = (codes[e.code] || 0) + 1;
      lines.push(e.line);
    }
    
    const count = fileErrors.length;
    let severity: FileHotspot['severity'] = 'low';
    if (count >= 50) severity = 'critical';
    else if (count >= 20) severity = 'high';
    else if (count >= 5) severity = 'medium';
    
    return {
      file,
      errorCount: count,
      codes,
      lines: [...new Set(lines)].sort((a, b) => a - b),
      severity,
    };
  }).sort((a, b) => b.errorCount - a.errorCount);
}

function analyzeErrorCategories(errors: TSError[]): ErrorCategory[] {
  const byCode: Record<string, number> = {};
  
  for (const error of errors) {
    byCode[error.code] = (byCode[error.code] || 0) + 1;
  }
  
  return Object.entries(byCode).map(([code, count]) => {
    const info = ERROR_DESCRIPTIONS[code] || { 
      desc: 'Unknown error', 
      autoFixable: false, 
      effort: 5 
    };
    
    return {
      code,
      description: info.desc,
      count,
      autoFixable: info.autoFixable,
      avgEffort: info.effort,
    };
  }).sort((a, b) => b.count - a.count);
}

function analyzePackages(errors: TSError[]) {
  const packages = {
    'packages/backend': { name: '@valueos/backend', errors: [] as TSError[] },
    'apps/ValyntApp': { name: 'valynt-app', errors: [] as TSError[] },
    'packages/sdui': { name: '@valueos/sdui', errors: [] as TSError[] },
    'packages/shared': { name: '@valueos/shared', errors: [] as TSError[] },
    'packages/memory': { name: '@valueos/memory', errors: [] as TSError[] },
    'packages/infra': { name: '@valueos/infra', errors: [] as TSError[] },
  };
  
  for (const error of errors) {
    for (const [path, pkg] of Object.entries(packages)) {
      if (error.fullPath.includes(path)) {
        pkg.errors.push(error);
        break;
      }
    }
  }
  
  const result: Record<string, { errors: number; files: number; topCodes: string[] }> = {};
  
  for (const [, pkg] of Object.entries(packages)) {
    if (pkg.errors.length === 0) continue;
    
    const files = new Set(pkg.errors.map(e => e.file));
    const codeCounts: Record<string, number> = {};
    
    for (const e of pkg.errors) {
      codeCounts[e.code] = (codeCounts[e.code] || 0) + 1;
    }
    
    const topCodes = Object.entries(codeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code]) => code);
    
    result[pkg.name] = {
      errors: pkg.errors.length,
      files: files.size,
      topCodes,
    };
  }
  
  return result;
}

function generateRecommendations(hotspots: FileHotspot[], categories: ErrorCategory[]): string[] {
  const recommendations: string[] = [];
  
  // Critical files
  const critical = hotspots.filter(h => h.severity === 'critical');
  if (critical.length > 0) {
    recommendations.push(
      `⚠️ ${critical.length} files have 50+ errors each. Prioritize: ${critical.slice(0, 3).map(h => h.file).join(', ')}`
    );
  }
  
  // Auto-fixable opportunities
  const autoFixable = categories.filter(c => c.autoFixable);
  const autoFixableTotal = autoFixable.reduce((sum, c) => sum + c.count, 0);
  if (autoFixableTotal > 500) {
    recommendations.push(
      `🤖 ${autoFixableTotal} errors are auto-fixable (${autoFixable.map(c => c.code).join(', ')}). Use ts-inference and ts-null-safety agents.`
    );
  }
  
  // High effort errors
  const highEffort = categories.filter(c => c.avgEffort >= 8);
  if (highEffort.length > 0) {
    recommendations.push(
      `⚡ ${highEffort.map(c => c.code).join(', ')} require 8+ min per error. Allocate experienced agents.`
    );
  }
  
  // Property definition errors
  const propErrors = categories.find(c => c.code === 'TS2339');
  if (propErrors && propErrors.count > 1000) {
    recommendations.push(
      `🏗️ ${propErrors.count} property errors suggest shared type definitions need updating. Review @valueos/shared domain types.`
    );
  }
  
  return recommendations;
}

async function generateReport() {
  const output = runTypeCheck();
  const errors = parseErrors(output);
  
  if (errors.length === 0) {
    console.log('✅ No TypeScript errors found!');
    return;
  }
  
  console.log(`Analyzing ${errors.length} errors...`);
  
  const hotspots = analyzeFileHotspots(errors);
  const categories = analyzeErrorCategories(errors);
  const packages = analyzePackages(errors);
  
  const totalEffort = categories.reduce(
    (sum, c) => sum + c.count * c.avgEffort, 
    0
  );
  
  const report: HotspotReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalErrors: errors.length,
      totalFiles: hotspots.length,
      uniqueCodes: categories.length,
      criticalFiles: hotspots.filter(h => h.severity === 'critical').length,
      estimatedHours: Math.ceil(totalEffort / 60),
    },
    errorCategories: categories,
    fileHotspots: hotspots.slice(0, 50), // Top 50
    packageBreakdown: packages,
    recommendations: generateRecommendations(hotspots, categories),
  };
  
  const dir = resolve('.windsurf/swarm');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  
  // Print summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         TypeScript Error Hotspots Report                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nGenerated: ${report.generatedAt}`);
  console.log(`\n📊 Summary:`);
  console.log(`  Total Errors:    ${report.summary.totalErrors.toLocaleString()}`);
  console.log(`  Files Affected:  ${report.summary.totalFiles}`);
  console.log(`  Error Types:     ${report.summary.uniqueCodes}`);
  console.log(`  Critical Files:  ${report.summary.criticalFiles}`);
  console.log(`  Est. Effort:     ${report.summary.estimatedHours} hours`);
  
  console.log('\n🔥 Top 10 Error Hotspots:');
  hotspots.slice(0, 10).forEach((h, i) => {
    const icon = h.severity === 'critical' ? '🔴' : h.severity === 'high' ? '🟠' : '🟡';
    console.log(`  ${icon} ${h.file} (${h.errorCount} errors)`);
  });
  
  console.log('\n📦 Package Breakdown:');
  Object.entries(packages).forEach(([name, data]) => {
    console.log(`  ${name}: ${data.errors} errors in ${data.files} files`);
  });
  
  console.log('\n🎯 Recommendations:');
  report.recommendations.forEach(r => console.log(`  ${r}`));
  
  console.log(`\nFull report saved to: ${REPORT_PATH}`);
}

generateReport().catch(console.error);
