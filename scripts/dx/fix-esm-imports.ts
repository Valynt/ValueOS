#!/usr/bin/env tsx
/**
 * ESM Import Fixer
 * 
 * Automatically adds .js extensions to all relative imports in TypeScript files.
 * ESM requires explicit extensions even when importing .ts files.
 * 
 * Usage:
 *   pnpm dlx tsx scripts/dx/fix-esm-imports.ts [--dry-run] [--path=packages/backend/src]
 */

import fs from 'fs';
import path from 'path';

interface FixResult {
  filePath: string;
  originalImport: string;
  fixedImport: string;
  line: number;
}

const fixes: FixResult[] = [];
const errors: string[] = [];

function isRelativeImport(importPath: string): boolean {
  return importPath.startsWith('./') || importPath.startsWith('../');
}

function hasExtension(importPath: string): boolean {
  return /\.(js|ts|jsx|tsx|mjs|cjs)$/.test(importPath);
}

function resolveImportPath(sourceFile: string, importPath: string): string | null {
  const sourceDir = path.dirname(sourceFile);
  const absolutePath = path.resolve(sourceDir, importPath);
  
  // Check if it's a directory first
  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
    // Check for index file in directory
    const indexExtensions = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
    for (const indexFile of indexExtensions) {
      if (fs.existsSync(path.join(absolutePath, indexFile))) {
        // For directories with index files, explicitly add /index.js
        return importPath + '/index.js';
      }
    }
    return null; // Directory exists but no index file
  }
  
  // Try direct file
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    if (fs.existsSync(absolutePath + ext)) {
      return importPath + '.js'; // Always use .js for ESM
    }
  }
  
  return null;
}

function fixImportsInFile(filePath: string, dryRun: boolean): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let fixCount = 0;
  
  // Match various import patterns
  const importPatterns = [
    /^(\s*import\s+.*?\s+from\s+['"])([^'"]+)(['"])/,
    /^(\s*import\s+['"])([^'"]+)(['"])/,
    /^(\s*export\s+.*?\s+from\s+['"])([^'"]+)(['"])/,
  ];
  
  const fixedLines = lines.map((line, index) => {
    for (const pattern of importPatterns) {
      const match = line.match(pattern);
      if (match) {
        const prefix = match[1];
        const importPath = match[2];
        const suffix = match[3];

        if (!prefix || !importPath || !suffix) {
          return line;
        }
        
        // Skip if not relative or already has extension
        if (!isRelativeImport(importPath) || hasExtension(importPath)) {
          return line;
        }
        
        // Resolve the actual file
        const fixedPath = resolveImportPath(filePath, importPath);
        if (fixedPath) {
          const fixedLine = `${prefix}${fixedPath}${suffix}`;
          fixes.push({
            filePath: path.relative(process.cwd(), filePath),
            originalImport: importPath,
            fixedImport: fixedPath,
            line: index + 1,
          });
          fixCount++;
          return fixedLine;
        } else {
          errors.push(`⚠️  ${path.relative(process.cwd(), filePath)}:${index + 1} - Cannot resolve: ${importPath}`);
        }
      }
    }
    return line;
  });
  
  if (fixCount > 0 && !dryRun) {
    fs.writeFileSync(filePath, fixedLines.join('\n'), 'utf-8');
  }
  
  return fixCount;
}

function scanDirectory(dirPath: string): string[] {
  const files: string[] = [];
  
  function scan(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and common build dirs
        if (!['node_modules', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dirPath);
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const pathArg = args.find(arg => arg.startsWith('--path='));
  const targetPath = pathArg
    ? path.resolve(process.cwd(), pathArg.slice('--path='.length))
    : path.resolve(process.cwd(), 'packages/backend/src');
  
  console.log('🔧 ESM Import Fixer\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify files)'}`);
  console.log(`Path: ${path.relative(process.cwd(), targetPath)}\n`);
  
  const files = scanDirectory(targetPath);
  console.log(`Found ${files.length} TypeScript files\n`);
  
  let totalFixes = 0;
  for (const file of files) {
    const fileFixCount = fixImportsInFile(file, dryRun);
    totalFixes += fileFixCount;
  }
  
  console.log(`\n📊 Results:\n`);
  console.log(`✅ Fixed ${totalFixes} imports in ${fixes.length > 0 ? new Set(fixes.map(f => f.filePath)).size : 0} files`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} unresolved imports:\n`);
    errors.forEach(err => console.log(err));
  }
  
  if (dryRun && fixes.length > 0) {
    console.log(`\n🔍 Sample fixes (showing first 20):\n`);
    fixes.slice(0, 20).forEach(fix => {
      console.log(`${fix.filePath}:${fix.line}`);
      console.log(`  - ${fix.originalImport}`);
      console.log(`  + ${fix.fixedImport}`);
    });
    console.log(`\nRun without --dry-run to apply changes.`);
  }
  
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
