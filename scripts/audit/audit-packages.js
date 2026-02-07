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

console.log('🔍 Analyzing package usage...\n');

// Track which packages are used
const usedPackages = new Set();
const unusedPackages = new Set(Object.keys(allDependencies));

// Function to search for package usage
function searchPackageUsage(packageName, searchPaths) {
  const patterns = [
    // Import patterns
    `import.*from\\s+['"]${packageName}['"]`,
    `import\\s+['"]${packageName}['"]`,
    `require\\s*\\(\\s*['"]${packageName}['"]\\s*\\)`,
    // Dynamic imports
    `import\\s*\\(\\s*['"]${packageName}['"]\\s*\\)`,
    // Package references in config files
    `"${packageName}"`,
    `'${packageName}'`,
  ];

  let found = false;

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;

    try {
      for (const pattern of patterns) {
        try {
          const result = execSync(`rg -l "${pattern}" "${searchPath}" --type-add 'config:*.{json,js,ts,tsx,yaml,yml}' -t config`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
          if (result.trim()) {
            found = true;
            break;
          }
        } catch (e) {
          // rg returns non-zero exit code when no matches found
        }
      }
    } catch (e) {
      // Continue silently
    }
  }

  return found;
}

// Search paths to check
const searchPaths = [
  'src',
  'scripts',
  'tests',
  '.config',
  'infra',
  'docs',
  'backend'
];

// Analyze each package
for (const packageName of Object.keys(allDependencies)) {
  // Skip special packages that are always needed
  if (packageName.startsWith('@types/') ||
      packageName === 'typescript' ||
      packageName === 'esbuild' ||
      packageName === 'node') {
    usedPackages.add(packageName);
    unusedPackages.delete(packageName);
    continue;
  }

  if (searchPackageUsage(packageName, searchPaths)) {
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
console.log(`❌ Unused packages: ${unusedPackages.size}\n`);

if (unusedDeps.length > 0) {
  console.log('🚨 Unused DEPENDENCIES (production):');
  unusedDeps.forEach(pkg => {
    console.log(`   - ${pkg}@${packageJson.dependencies[pkg]}`);
  });
  console.log('');
}

if (unusedDevDeps.length > 0) {
  console.log('🚨 Unused DEV DEPENDENCIES:');
  unusedDevDeps.forEach(pkg => {
    console.log(`   - ${pkg}@${packageJson.devDependencies[pkg]}`);
  });
  console.log('');
}

if (unusedPackages.size === 0) {
  console.log('✅ All packages appear to be in use!');
} else {
  console.log(`💡 To remove unused packages:`);
  console.log(`   npm uninstall ${Array.from(unusedPackages).join(' ')}`);
}

// Save detailed report
const report = {
  summary: {
    total: Object.keys(allDependencies).length,
    used: usedPackages.size,
    unused: unusedPackages.size
  },
  unusedDependencies: unusedDeps,
  unusedDevDependencies: unusedDevDeps,
  usedPackages: Array.from(usedPackages).sort()
};

fs.writeFileSync('package-audit-report.json', JSON.stringify(report, null, 2));
console.log('\n📄 Detailed report saved to package-audit-report.json');
