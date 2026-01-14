#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const allDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

console.log('🔍 Comprehensive package usage analysis...\n');

// Function to check if package is used by searching files directly
function isPackageUsed(packageName) {
  // Always needed packages
  if (packageName.startsWith('@types/') ||
      packageName === 'typescript' ||
      packageName === 'esbuild' ||
      packageName === 'node') {
    return true;
  }

  const searchPaths = ['src', 'scripts', 'tests', '.config', 'infra', 'docs', 'backend'];

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;

    try {
      // Search for the package name in all files
      const result = execSync(`rg "${packageName}" "${searchPath}" --type-add 'source:*.{ts,tsx,js,jsx}' -t source`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      if (result.trim()) {
        // Check if it's actually used as an import/require
        const lines = result.split('\n');
        for (const line of lines) {
          if (line.includes('import') || line.includes('require') ||
              line.includes('from') || line.includes('package.json') ||
              line.includes('vite') || line.includes('eslint') ||
              line.includes('tailwind') || line.includes('postcss')) {
            return true;
          }
        }
      }
    } catch (e) {
      // No matches found
    }
  }

  return false;
}

// Manual verification for commonly used packages
const criticalPackages = [
  'react', 'react-dom', '@supabase/supabase-js', 'express',
  'vite', 'typescript', 'tailwindcss', 'postcss', 'autoprefixer',
  'eslint', 'prettier', 'playwright', 'vitest'
];

// Track usage
const usedPackages = new Set();
const unusedPackages = new Set(Object.keys(allDependencies));

// Check critical packages first
for (const pkg of criticalPackages) {
  if (allDependencies[pkg]) {
    usedPackages.add(pkg);
    unusedPackages.delete(pkg);
  }
}

// Check all other packages
for (const packageName of Object.keys(allDependencies)) {
  if (usedPackages.has(packageName) || unusedPackages.has(packageName) === false) {
    continue;
  }

  if (isPackageUsed(packageName)) {
    usedPackages.add(packageName);
    unusedPackages.delete(packageName);
  }
}

// Categorize packages
const dependencies = Object.keys(packageJson.dependencies);
const devDependencies = Object.keys(packageJson.devDependencies);

const unusedDeps = dependencies.filter(dep => unusedPackages.has(dep));
const unusedDevDeps = devDependencies.filter(dep => unusedPackages.has(dep));

// Results
console.log(`📦 Total packages: ${Object.keys(allDependencies).length}`);
console.log(`✅ Used packages: ${usedPackages.size}`);
console.log(`❌ Potentially unused packages: ${unusedPackages.size}\n`);

// Show some used packages for verification
console.log('✅ Sample of used packages:');
Array.from(usedPackages).slice(0, 10).forEach(pkg => {
  console.log(`   - ${pkg}`);
});
console.log('   ... and more\n');

if (unusedDeps.length > 0) {
  console.log('🚨 Potentially unused DEPENDENCIES (production):');
  unusedDeps.forEach(pkg => {
    console.log(`   - ${pkg}@${packageJson.dependencies[pkg]}`);
  });
  console.log('');
}

if (unusedDevDeps.length > 0) {
  console.log('🚨 Potentially unused DEV DEPENDENCIES:');
  unusedDevDeps.slice(0, 20).forEach(pkg => {
    console.log(`   - ${pkg}@${packageJson.devDependencies[pkg]}`);
  });
  if (unusedDevDeps.length > 20) {
    console.log(`   ... and ${unusedDevDeps.length - 20} more`);
  }
  console.log('');
}

if (unusedPackages.size === 0) {
  console.log('✅ All packages appear to be in use!');
} else {
  console.log(`⚠️  Found ${unusedPackages.size} potentially unused packages`);
  console.log(`💡 Manual verification recommended before removal`);
  console.log(`💡 Some packages may be used indirectly or in build processes`);
  console.log(`💡 Run 'npm ls <package>' to check for dependents`);
}

// Save detailed report
const report = {
  summary: {
    total: Object.keys(allDependencies).length,
    used: usedPackages.size,
    potentially_unused: unusedPackages.size
  },
  unusedDependencies: unusedDeps,
  unusedDevDependencies: unusedDevDeps,
  usedPackages: Array.from(usedPackages).sort(),
  critical_packages_verified: criticalPackages.filter(pkg => allDependencies[pkg])
};

fs.writeFileSync('package-audit-report.json', JSON.stringify(report, null, 2));
console.log('\n📄 Detailed report saved to package-audit-report.json');
