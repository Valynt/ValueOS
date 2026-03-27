#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

type CanonicalFacts = {
  schemaVersion: number;
  lastReviewed: string;
  productName: string;
  agentFabric: {
    count: number;
    path: string;
  };
  runtimeServices: {
    count: number;
    names: string[];
    path: string;
  };
  packageManager: {
    name: string;
    version: string;
  };
};

const repoRoot = process.cwd();
const readUtf8 = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

const canonicalFacts = JSON.parse(readUtf8('docs/architecture/canonical-facts.json')) as CanonicalFacts;
const packageJson = JSON.parse(readUtf8('package.json')) as {
  packageManager?: string;
};

const violations: string[] = [];

const requiredTargets = {
  readme: readUtf8('README.md'),
  docsAgents: readUtf8('docs/AGENTS.md'),
};

const packageReadmes = readdirSync(path.join(repoRoot, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join('packages', entry.name, 'README.md'))
  .filter((readmePath) => existsSync(path.join(repoRoot, readmePath)));

const appReadmes = readdirSync(path.join(repoRoot, 'apps'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join('apps', entry.name, 'README.md'))
  .filter((readmePath) => existsSync(path.join(repoRoot, readmePath)));

const hasLegacyProductName = (content: string) => /ValueCanvas/i.test(content);

const assertContains = (label: string, content: string, needle: string) => {
  if (!content.includes(needle)) {
    violations.push(`${label} is missing canonical value: ${needle}`);
  }
};

for (const [label, content] of Object.entries(requiredTargets)) {
  assertContains(label, content, canonicalFacts.productName);

  for (const runtimeName of canonicalFacts.runtimeServices.names) {
    assertContains(label, content, runtimeName);
  }

  if (hasLegacyProductName(content)) {
    violations.push(`${label} still contains legacy product name: ValueCanvas`);
  }
}

if (!requiredTargets.readme.includes(`${canonicalFacts.agentFabric.count} agents`)) {
  violations.push(`README.md must declare the canonical agent count (${canonicalFacts.agentFabric.count} agents).`);
}

if (!requiredTargets.docsAgents.includes(`${canonicalFacts.agentFabric.count}-agent fabric`)) {
  violations.push(`docs/AGENTS.md must declare the canonical agent count (${canonicalFacts.agentFabric.count}-agent fabric).`);
}

const docsAgentsPackageManagerPattern = new RegExp(`${canonicalFacts.packageManager.name}\\s+${canonicalFacts.packageManager.version}`);
if (!docsAgentsPackageManagerPattern.test(requiredTargets.docsAgents)) {
  violations.push(
    `docs/AGENTS.md must declare canonical package manager version ${canonicalFacts.packageManager.name} ${canonicalFacts.packageManager.version}.`
  );
}

if (!requiredTargets.readme.includes(`\`${canonicalFacts.packageManager.name}@${canonicalFacts.packageManager.version}\``)) {
  violations.push(
    `README.md must declare canonical package manager version ${canonicalFacts.packageManager.name}@${canonicalFacts.packageManager.version}.`
  );
}

const packageManagerFromRoot = packageJson.packageManager?.match(/^([^@]+)@([^+]+)/);
if (!packageManagerFromRoot) {
  violations.push('package.json packageManager field is missing or invalid.');
} else {
  const [, managerName, managerVersion] = packageManagerFromRoot;
  if (managerName !== canonicalFacts.packageManager.name || managerVersion !== canonicalFacts.packageManager.version) {
    violations.push(
      `docs/architecture/canonical-facts.json packageManager (${canonicalFacts.packageManager.name}@${canonicalFacts.packageManager.version}) does not match package.json (${managerName}@${managerVersion}).`
    );
  }
}

const mentionedPnpmVersions = (content: string) => Array.from(content.matchAll(/pnpm@(?<version>\d+\.\d+\.\d+)/g)).map((m) => m.groups?.version ?? '');

for (const readmePath of [...appReadmes, ...packageReadmes]) {
  const content = readUtf8(readmePath);
  if (hasLegacyProductName(content)) {
    violations.push(`${readmePath} still contains legacy product name: ValueCanvas`);
  }

  for (const pnpmVersion of mentionedPnpmVersions(content)) {
    if (pnpmVersion !== canonicalFacts.packageManager.version) {
      violations.push(
        `${readmePath} pins ${canonicalFacts.packageManager.name}@${pnpmVersion}; expected ${canonicalFacts.packageManager.name}@${canonicalFacts.packageManager.version}.`
      );
    }
  }
}

const runtimeServiceDirMap: Record<string, string> = {
  DecisionRouter: 'decision-router',
  ExecutionRuntime: 'execution-runtime',
  PolicyEngine: 'policy-engine',
  ContextStore: 'context-store',
  ArtifactComposer: 'artifact-composer',
  RecommendationEngine: 'recommendation-engine',
};

if (canonicalFacts.runtimeServices.names.length !== canonicalFacts.runtimeServices.count) {
  violations.push(
    `docs/architecture/canonical-facts.json runtimeServices.count (${canonicalFacts.runtimeServices.count}) must match runtimeServices.names length (${canonicalFacts.runtimeServices.names.length}).`
  );
}

for (const runtimeName of canonicalFacts.runtimeServices.names) {
  const runtimeDir = runtimeServiceDirMap[runtimeName];
  if (!runtimeDir) {
    violations.push(`No runtime directory mapping configured for canonical runtime service ${runtimeName}.`);
    continue;
  }

  const runtimePath = path.join(repoRoot, canonicalFacts.runtimeServices.path, runtimeDir);
  if (!existsSync(runtimePath)) {
    violations.push(`Canonical runtime service ${runtimeName} is missing expected path: ${path.relative(repoRoot, runtimePath)}`);
  }
}

const agentFiles = readdirSync(path.join(repoRoot, canonicalFacts.agentFabric.path), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('Agent.ts') && entry.name !== 'BaseAgent.ts')
  .map((entry) => entry.name)
  .sort();

if (agentFiles.length !== canonicalFacts.agentFabric.count) {
  violations.push(
    `Canonical agent count mismatch: docs/architecture/canonical-facts.json declares ${canonicalFacts.agentFabric.count}, but found ${agentFiles.length} agent files.`
  );
}

if (violations.length > 0) {
  console.error('❌ Docs consistency check failed.');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `✅ Docs consistency check passed. Canonical facts validated for README.md, docs/AGENTS.md, ${appReadmes.length} app README(s), and ${packageReadmes.length} package README(s).`
);
