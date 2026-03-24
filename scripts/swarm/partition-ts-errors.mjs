#!/usr/bin/env node
/**
 * TypeScript Error Partitioning Script
 * 
 * Parses tsc --noEmit output and distributes errors to agent batches
 * based on file location, error type, and dependencies.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve, relative } from 'path';

interface TSError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  fullPath: string;
}

interface ErrorBatch {
  id: string;
  agentRole: string;
  files: string[];
  errors: TSError[];
  estimatedEffort: number; // in minutes
  dependencies: string[];
}

interface PackageErrors {
  name: string;
  path: string;
  errors: TSError[];
  errorCount: number;
  fileCount: number;
  byErrorCode: Record<string, TSError[]>;
  byFile: Record<string, TSError[]>;
}

const CONFIG_PATH = resolve('.windsurf/swarm/agent-swarm-config.json');
const OUTPUT_DIR = resolve('.windsurf/swarm/batches');

function loadConfig() {
  const configRaw = readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(configRaw);
}

function runTypeCheck(): string {
  console.log('Running TypeScript type check...');
  try {
    const output = execSync('pnpm run typecheck:full 2>&1', {
      cwd: resolve('.'),
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });
    return output;
  } catch (error: any) {
    // tsc returns non-zero when there are errors, which is expected
    return error.stdout || error.message;
  }
}

function parseErrors(output: string): TSError[] {
  const errors: TSError[] = [];
  const lines = output.split('\n');
  
  // Pattern: file(line,column): error TSXXXX: message
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

function categorizeByPackage(errors: TSError[], config: any): PackageErrors[] {
  const packages = config.packages.map((p: any) => ({
    ...p,
    errors: [] as TSError[],
    byErrorCode: {} as Record<string, TSError[]>,
    byFile: {} as Record<string, TSError[]>,
  }));
  
  for (const error of errors) {
    const pkg = packages.find((p: any) => 
      error.fullPath.includes(resolve(p.path))
    );
    
    if (pkg) {
      pkg.errors.push(error);
      
      // By error code
      if (!pkg.byErrorCode[error.code]) {
        pkg.byErrorCode[error.code] = [];
      }
      pkg.byErrorCode[error.code].push(error);
      
      // By file
      if (!pkg.byFile[error.file]) {
        pkg.byFile[error.file] = [];
      }
      pkg.byFile[error.file].push(error);
    }
  }
  
  return packages.map((p: any) => ({
    name: p.name,
    path: p.path,
    errors: p.errors,
    errorCount: p.errors.length,
    fileCount: Object.keys(p.byFile).length,
    byErrorCode: p.byErrorCode,
    byFile: p.byFile,
  }));
}

function determineAgentRole(error: TSError, config: any): string {
  // Check file patterns first
  for (const role of config.agentRoles) {
    if (role.filePatterns) {
      for (const pattern of role.filePatterns) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(error.file)) {
          return role.id;
        }
      }
    }
  }
  
  // Then check error codes
  for (const role of config.agentRoles) {
    if (role.errorCodes.includes(error.code)) {
      return role.id;
    }
  }
  
  // Default to compatibility role for unknown codes
  return 'ts-compatibility';
}

function estimateEffort(errors: TSError[]): number {
  // Rough effort estimation in minutes
  let effort = 0;
  
  for (const error of errors) {
    switch (error.code) {
      case 'TS7006': // implicit any
        effort += 2;
        break;
      case 'TS18047':
      case 'TS18048': // null/undefined
        effort += 1;
        break;
      case 'TS2339': // property does not exist
        effort += 5;
        break;
      case 'TS2322':
      case 'TS2345': // type incompatibility
        effort += 8;
        break;
      default:
        effort += 5;
    }
  }
  
  return effort;
}

function createBatches(packages: PackageErrors[], config: any): ErrorBatch[] {
  const batches: ErrorBatch[] = [];
  
  for (const pkg of packages) {
    if (pkg.errorCount === 0) continue;
    
    // Group errors by agent role
    const byRole: Record<string, TSError[]> = {};
    
    for (const error of pkg.errors) {
      const role = determineAgentRole(error, config);
      if (!byRole[role]) {
        byRole[role] = [];
      }
      byRole[role].push(error);
    }
    
    // Create batches per role, respecting maxErrorsPerBatch
    const maxPerBatch = config.parallelism.maxErrorsPerBatch;
    
    for (const [roleId, errors] of Object.entries(byRole)) {
      // Sort errors by file for better locality
      errors.sort((a, b) => a.file.localeCompare(b.file));
      
      // Chunk into batches
      for (let i = 0; i < errors.length; i += maxPerBatch) {
        const chunk = errors.slice(i, i + maxPerBatch);
        const files = [...new Set(chunk.map(e => e.file))];
        
        batches.push({
          id: `${pkg.name.replace(/[@/]/g, '-')}-${roleId}-${Math.floor(i / maxPerBatch) + 1}`,
          agentRole: roleId,
          files,
          errors: chunk,
          estimatedEffort: estimateEffort(chunk),
          dependencies: [], // Will be populated later
        });
      }
    }
  }
  
  return batches;
}

function addDependencies(batches: ErrorBatch[], packages: PackageErrors[]): void {
  // Build dependency graph based on file imports
  const fileToBatch = new Map<string, ErrorBatch>();
  
  for (const batch of batches) {
    for (const file of batch.files) {
      fileToBatch.set(file, batch);
    }
  }
  
  // Simple heuristic: if a file is in a shared package, other packages depend on it
  const sharedBatchIds = batches
    .filter(b => b.id.includes('shared'))
    .map(b => b.id);
  
  for (const batch of batches) {
    if (!batch.id.includes('shared')) {
      // Non-shared packages may depend on shared
      batch.dependencies.push(...sharedBatchIds);
    }
  }
  
  // Deduplicate
  for (const batch of batches) {
    batch.dependencies = [...new Set(batch.dependencies)];
  }
}

function generateBatchFiles(batches: ErrorBatch[]): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  for (const batch of batches) {
    const filename = `${batch.id}.json`;
    const filepath = resolve(OUTPUT_DIR, filename);
    
    writeFileSync(filepath, JSON.stringify(batch, null, 2));
  }
  
  // Write batch manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalBatches: batches.length,
    totalErrors: batches.reduce((sum, b) => sum + b.errors.length, 0),
    totalEstimatedMinutes: batches.reduce((sum, b) => sum + b.estimatedEffort, 0),
    batches: batches.map(b => ({
      id: b.id,
      role: b.agentRole,
      errorCount: b.errors.length,
      fileCount: b.files.length,
      effortMinutes: b.estimatedEffort,
      dependencies: b.dependencies,
    })),
  };
  
  writeFileSync(
    resolve(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log(`\nGenerated ${batches.length} batches in ${OUTPUT_DIR}`);
  console.log(`Total errors: ${manifest.totalErrors}`);
  console.log(`Estimated effort: ${Math.ceil(manifest.totalEstimatedMinutes / 60)} hours`);
}

function generateReport(packages: PackageErrors[]): void {
  const reportPath = resolve('.windsurf/swarm/error-report.json');
  
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalErrors: packages.reduce((sum, p) => sum + p.errorCount, 0),
      totalFiles: packages.reduce((sum, p) => sum + p.fileCount, 0),
      packages: packages.length,
    },
    packages: packages.map(p => ({
      name: p.name,
      path: p.path,
      errorCount: p.errorCount,
      fileCount: p.fileCount,
      topErrorCodes: Object.entries(p.byErrorCode)
        .map(([code, errors]) => ({ code, count: errors.length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topFiles: Object.entries(p.byFile)
        .map(([file, errors]) => ({ file, count: errors.length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    })),
  };
  
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved to ${reportPath}`);
}

async function main() {
  console.log('TypeScript Error Partitioner\n');
  
  const config = loadConfig();
  const typeCheckOutput = runTypeCheck();
  const errors = parseErrors(typeCheckOutput);
  
  console.log(`Found ${errors.length} TypeScript errors`);
  
  if (errors.length === 0) {
    console.log('No errors to partition. Exiting.');
    return;
  }
  
  const packages = categorizeByPackage(errors, config);
  
  console.log('\nPackage breakdown:');
  for (const pkg of packages) {
    console.log(`  ${pkg.name}: ${pkg.errorCount} errors in ${pkg.fileCount} files`);
  }
  
  const batches = createBatches(packages, config);
  addDependencies(batches, packages);
  generateBatchFiles(batches);
  generateReport(packages);
  
  console.log('\nPartitioning complete.');
  console.log(`Next step: Run swarm orchestrator with batches from ${OUTPUT_DIR}`);
}

main().catch(console.error);
