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

console.log('🔍 Analyzing package usage with improved detection...\n');

// Track which packages are used
const usedPackages = new Set();
const unusedPackages = new Set(Object.keys(allDependencies));

// Function to check if package is used
function isPackageUsed(packageName) {
  // Skip special packages that are always needed
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
      // Search for various import patterns
      const patterns = [
        `import.*from\\s+['"]${packageName}['"]`,
        `import\\s+['"]${packageName}['"]`,
        `require\\s*\\(\\s*['"]${packageName}['"]\\s*\\)`,
        `import\\s*\\(\\s*['"]${packageName}['"]\\s*\\)`
      ];

      for (const pattern of patterns) {
        try {
          const result = execSync(`rg -l "${pattern}" "${searchPath}"`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
          if (result.trim()) {
            return true;
          }
        } catch (e) {
          // No matches found
        }
      }

      // Also search for package name in config files
      try {
        const configResult = execSync(`rg -l "${packageName}" "${searchPath}" --type-add 'config:*.{json,js,ts,tsx,yaml,yml,md}' -t config`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });
        if (configResult.trim()) {
          return true;
        }
      } catch (e) {
        // No matches found
      }

    } catch (e) {
      // Continue silently
    }
  }

  return false;
}

// Check each package more thoroughly
for (const packageName of Object.keys(allDependencies)) {
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

if (unusedDeps.length > 0) {
  console.log('🚨 Potentially unused DEPENDENCIES (production):');
  unusedDeps.forEach(pkg => {
    console.log(`   - ${pkg}@${packageJson.dependencies[pkg]}`);
  });
  console.log('');
}

if (unusedDevDeps.length > 0) {
  console.log('🚨 Potentially unused DEV DEPENDENCIES:');
  unusedDevDeps.forEach(pkg => {
    console.log(`   - ${pkg}@${packageJson.devDependencies[pkg]}`);
  });
  console.log('');
}

if (unusedPackages.size === 0) {
  console.log('✅ All packages appear to be in use!');
} else {
  console.log(`⚠️  Found ${unusedPackages.size} potentially unused packages`);
  console.log(`💡 Manual verification recommended before removal`);
  console.log(`💡 Some packages may be used indirectly or in build processes`);
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
  usedPackages: Array.from(usedPackages).sort()
};

fs.writeFileSync('package-audit-report.json', JSON.stringify(report, null, 2));
console.log('\n📄 Detailed report saved to package-audit-report.json');
