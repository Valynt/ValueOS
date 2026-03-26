#!/usr/bin/env tsx
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { DOCS_BRANDING, renderDocsLandingPage } from '../../packages/backend/src/api/docsContent.ts';

const repoRoot = process.cwd();

type RuntimeStatus = 'active' | 'experimental' | 'archived';

interface RuntimeInventoryEntry {
  path: string;
  workspace: string;
  status: RuntimeStatus;
  owner: string;
  deployPath: string;
}

interface RuntimeInventory {
  schemaVersion: number;
  lastReviewed: string;
  apps: RuntimeInventoryEntry[];
  productionPackages: RuntimeInventoryEntry[];
}

const targetContents = {
  readme: readFileSync(path.join(repoRoot, 'README.md'), 'utf8'),
  openapi: readFileSync(path.join(repoRoot, 'packages/backend/openapi.yaml'), 'utf8'),
  architecture: readFileSync(path.join(repoRoot, 'docs/architecture/README.md'), 'utf8'),
  runtimeInventory: readFileSync(path.join(repoRoot, 'docs/architecture/runtime-inventory.json'), 'utf8'),
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
  runtimeInventory: [
    DOCS_BRANDING.appUrl,
    DOCS_BRANDING.apiBaseUrl,
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

const runtimeInventory = JSON.parse(targetContents.runtimeInventory) as RuntimeInventory;
const validStatuses: RuntimeStatus[] = ['active', 'experimental', 'archived'];

const ensureEntryFields = (entry: RuntimeInventoryEntry, collectionName: 'apps' | 'productionPackages') => {
  const metadataFields: Array<keyof Pick<RuntimeInventoryEntry, 'status' | 'owner' | 'deployPath'>> = ['status', 'owner', 'deployPath'];
  for (const field of metadataFields) {
    if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
      violations.push(`runtime-inventory ${collectionName} entry ${entry.path} is missing required field: ${field}`);
    }
  }

  if (!validStatuses.includes(entry.status)) {
    violations.push(`runtime-inventory ${collectionName} entry ${entry.path} has invalid status: ${entry.status}`);
  }
};

for (const appEntry of runtimeInventory.apps) {
  ensureEntryFields(appEntry, 'apps');
}

for (const packageEntry of runtimeInventory.productionPackages) {
  ensureEntryFields(packageEntry, 'productionPackages');
}

const appDirs = readdirSync(path.join(repoRoot, 'apps'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const documentedAppDirs = runtimeInventory.apps
  .map((entry) => entry.path.replace(/^apps\//, ''))
  .sort();

if (JSON.stringify(appDirs) !== JSON.stringify(documentedAppDirs)) {
  violations.push(`apps/ inventory drift detected. Expected ${documentedAppDirs.join(', ')}, found ${appDirs.join(', ')}`);
}

for (const appDir of appDirs) {
  if (!targetContents.readme.includes(`apps/${appDir}`) && !targetContents.readme.includes(`${appDir}/`)) {
    violations.push(`README.md is missing apps inventory entry for ${appDir}`);
  }
}

if (!targetContents.readme.includes('runtime-inventory.json') || !targetContents.architecture.includes('runtime-inventory.json')) {
  violations.push('README.md and docs/architecture/README.md must both reference docs/architecture/runtime-inventory.json.');
}

const productionPackageDirs = readdirSync(path.join(repoRoot, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((dirName) => {
    try {
      const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'packages', dirName, 'package.json'), 'utf8')) as { private?: boolean };
      return packageJson.private !== true;
    } catch {
      return false;
    }
  })
  .sort();

const documentedProductionPackageDirs = runtimeInventory.productionPackages
  .map((entry) => entry.path.replace(/^packages\//, ''))
  .sort();

if (JSON.stringify(productionPackageDirs) !== JSON.stringify(documentedProductionPackageDirs)) {
  violations.push(
    `production packages inventory drift detected. Expected ${documentedProductionPackageDirs.join(', ')}, found ${productionPackageDirs.join(', ')}`
  );
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

console.log(
  `✅ Docs consistency check passed for README, OpenAPI, backend docs route output, architecture docs, and runtime inventory. Verified apps inventory: ${appDirs.join(', ')}. Verified production package inventory: ${productionPackageDirs.join(', ')}.`
);
