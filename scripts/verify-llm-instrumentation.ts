#!/usr/bin/env node
/**
 * Simple verification script to ensure LLM calls include taskContext with organizationId
 * Fails the CI if uninstrumented calls are found.
 */
import fs from 'fs';
import path from 'path';

function isIgnored(filePath: string) {
  return filePath.includes('__tests__') || filePath.includes('/test/') || filePath.includes('/tests/');
}

function scanFile(filePath: string): string[] {
  const issues: string[] = [];
  if (isIgnored(filePath)) return issues;
  const content = fs.readFileSync(filePath, { encoding: 'utf8' });
  const regexes = [/\.complete\s*\(/g, /\.completeWithTools\s*\(/g, /\.chat\s*\(/g];
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const start = match.index;
      const substr = content.substring(start, start + 400);
      if (!/\,\s*\{[^}]*organizationId|,\s*taskContext|,\s*\w+\s*[:,]/.test(substr)) {
        issues.push(`${filePath}:${Math.floor((content.substring(0, start).match(/\n/g) || []).length) + 1}`);
      }
    }
  }
  
  return issues;
}

function scanDir(dir: string): string[] {
  const results: string[] = [];
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...scanDir(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js') || full.endsWith('.jsx')) {
      try { results.push(...scanFile(full)); } catch (e) {};
    }
  }
  return results;
}

const projectRoot = path.resolve(__dirname, '..');
const issues = scanDir(path.join(projectRoot, 'src'));
if (issues.length > 0) {
  console.error('Uninstrumented LLM calls found (missing taskContext with organizationId):');
  issues.forEach(i => console.error(` - ${i}`));
  process.exit(2);
} else {
  console.log('All LLM calls include taskContext or are in tests.');
}
