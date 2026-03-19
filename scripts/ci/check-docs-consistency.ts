#!/usr/bin/env tsx
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { DOCS_BRANDING, renderDocsLandingPage } from '../../packages/backend/src/api/docsContent.ts';

const repoRoot = process.cwd();

const targetContents = {
  readme: readFileSync(path.join(repoRoot, 'README.md'), 'utf8'),
  openapi: readFileSync(path.join(repoRoot, 'packages/backend/openapi.yaml'), 'utf8'),
  architecture: readFileSync(path.join(repoRoot, 'docs/architecture/README.md'), 'utf8'),
  backendDocsRouteOutput: renderDocsLandingPage(),
};

const requiredByTarget: Record<keyof typeof targetContents, string[]> = {
  readme: [
    DOCS_BRANDING.productName,
    DOCS_BRANDING.marketingSiteUrl,
    DOCS_BRANDING.appUrl,
    DOCS_BRANDING.apiBaseUrl,
    DOCS_BRANDING.docsUrl,
    DOCS_BRANDING.statusUrl,
    DOCS_BRANDING.supportEmail,
    DOCS_BRANDING.docsEmail,
  ],
  openapi: [
    DOCS_BRANDING.apiTitle,
    DOCS_BRANDING.apiBaseUrl,
    DOCS_BRANDING.docsUrl,
    DOCS_BRANDING.supportEmail,
  ],
  architecture: [
    DOCS_BRANDING.productName,
    DOCS_BRANDING.marketingSiteUrl,
    DOCS_BRANDING.appUrl,
    DOCS_BRANDING.apiBaseUrl,
    DOCS_BRANDING.docsUrl,
    DOCS_BRANDING.statusUrl,
    DOCS_BRANDING.supportEmail,
    DOCS_BRANDING.docsEmail,
  ],
  backendDocsRouteOutput: [
    DOCS_BRANDING.productName,
    DOCS_BRANDING.apiTitle,
    DOCS_BRANDING.marketingSiteUrl,
    DOCS_BRANDING.appUrl,
    DOCS_BRANDING.apiBaseUrl,
    DOCS_BRANDING.docsUrl,
    DOCS_BRANDING.statusUrl,
    DOCS_BRANDING.supportEmail,
    DOCS_BRANDING.docsEmail,
  ],
};

const violations: string[] = [];

for (const [targetName, content] of Object.entries(targetContents) as Array<[keyof typeof targetContents, string]>) {
  for (const requiredValue of requiredByTarget[targetName]) {
    if (!content.includes(requiredValue)) {
      violations.push(`${targetName} is missing canonical value: ${requiredValue}`);
    }
  }

  if (/ValueCanvas/.test(content)) {
    violations.push(`${targetName} still contains legacy product name: ValueCanvas`);
  }

  if (/valueos\.io/.test(content)) {
    violations.push(`${targetName} still contains a valueos.io domain in canonical docs surfaces`);
  }
}

const appDirs = readdirSync(path.join(repoRoot, 'apps'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const expectedAppDirs = ['ValyntApp', 'mcp-dashboard'];
if (JSON.stringify(appDirs) !== JSON.stringify(expectedAppDirs)) {
  violations.push(`apps/ inventory drift detected. Expected ${expectedAppDirs.join(', ')}, found ${appDirs.join(', ')}`);
}

for (const appDir of expectedAppDirs) {
  if (!targetContents.readme.includes(`apps/${appDir}`) && !targetContents.readme.includes(`${appDir}/`)) {
    violations.push(`README.md is missing apps inventory entry for ${appDir}`);
  }
}

if (/VOSAcademy/.test(targetContents.readme)) {
  violations.push('README.md still references VOSAcademy even though it is not present in apps/.');
}

if (violations.length > 0) {
  console.error('❌ Docs consistency check failed.');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log(`✅ Docs consistency check passed for README, OpenAPI, backend docs route output, and architecture docs. Verified apps inventory: ${appDirs.join(', ')}.`);
