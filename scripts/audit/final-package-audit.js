#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const allDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

console.log('🔍 Final comprehensive package usage analysis...\n');

// Manual mapping of packages that should definitely be kept
const essentialPackages = new Set([
  // Core dependencies
  'react', 'react-dom', '@tanstack/react-query', 'react-router-dom', 'zustand',
  '@supabase/supabase-js', 'express', 'cors', 'ws', 'uuid', 'zod',
  'lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority',
  'react-hotkeys-hook', 'react-markdown', 'react-syntax-highlighter',
  'date-fns', 'dompurify', 'html2canvas', 'jspdf', 'exceljs',
  'recharts', 'redis', 'stripe', 'winston', 'prom-client',
  'buffer', 'serve', 'speakeasy', 'otpauth', 'qrcode',

  // UI components
  '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-label',
  '@radix-ui/react-progress', '@radix-ui/react-select', '@radix-ui/react-slot',
  '@radix-ui/react-tabs', '@radix-ui/react-toast', '@radix-ui/react-tooltip',

  // Fonts
  '@fontsource/inter', '@fontsource/jetbrains-mono',

  // Dev dependencies (build tools)
  'vite', '@vitejs/plugin-react', 'typescript', 'tsx', 'ts-node',
  'tailwindcss', 'postcss', 'autoprefixer', 'eslint', 'prettier',
  'playwright', 'vitest', '@testing-library/react', '@testing-library/jest-dom',
  'husky', 'lint-staged', 'dotenv', 'supabase',

  // Type definitions
  '@types/react', '@types/react-dom', '@types/node', '@types/express',
  '@types/cors', '@types/dompurify', '@types/jsonwebtoken', '@types/pg',
  '@types/react-syntax-highlighter', '@types/speakeasy', '@types/supertest',

  // Observability
  '@opentelemetry/api', '@opentelemetry/auto-instrumentations-node',
  '@opentelemetry/exporter-metrics-otlp-http', '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/resources', '@opentelemetry/sdk-metrics', '@opentelemetry/sdk-node',
  '@opentelemetry/semantic-conventions', '@sentry/react', '@sentry/vite-plugin',

  // Security & auth
  '@simplewebauthn/browser', '@simplewebauthn/server',
  'express-rate-limit', 'rate-limiter-flexible', 'rate-limit-redis',

  // Testing
  '@vitest/coverage-v8', '@vitest/browser-playwright', '@vitest/runner',
  'happy-dom', 'jsdom', 'msw', 'supertest', 'testcontainers',
  '@testcontainers/postgresql',

  // Storybook
  '@storybook/react-vite', '@storybook/react-dom-shim', '@storybook/addon-docs',
  '@storybook/addon-a11y', '@storybook/addon-onboarding', '@chromatic-com/storybook',
  'eslint-plugin-storybook',

  // Other tools
  'node-fetch', 'openapi-typescript', 'js-yaml', 'jsonwebtoken',
  'pg', 'stylelint', 'stylelint-config-standard', 'snyk',
  'globals', '@eslint/js', 'eslint-plugin-jsx-a11y',
  'eslint-plugin-react-hooks', 'eslint-plugin-react-refresh',
  'typescript-eslint', 'opossum', 'node-vault', 'winston-cloudwatch',
  'p-queue', 'lz-string', 'isomorphic-dompurify', 'remark-gfm',
  'tailwindcss-animate', '@tanstack/react-virtual'
]);

// Additional packages to check based on actual usage patterns
const additionalUsedPackages = new Set([
  'aws-sdk/client-secrets-manager', '@apidevtools/swagger-parser', '@axe-core/playwright'
]);

// Combine all used packages
const usedPackages = new Set([...essentialPackages, ...additionalUsedPackages]);

// Find unused packages
const unusedPackages = new Set(Object.keys(allDependencies));
for (const pkg of usedPackages) {
  unusedPackages.delete(pkg);
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
  console.log(`💡 These packages may be candidates for removal after manual verification`);
  console.log(`💡 Some packages may be used indirectly or in specific build/deployment scenarios`);

  if (unusedPackages.size > 0) {
    console.log(`\n💡 To remove unused packages (verify first!):`);
    console.log(`   npm uninstall ${Array.from(unusedPackages).join(' ')}`);
  }
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
  analysis_method: 'Manual verification + grep search + essential package mapping'
};

fs.writeFileSync('package-audit-final.json', JSON.stringify(report, null, 2));
console.log('\n📄 Detailed report saved to package-audit-final.json');
