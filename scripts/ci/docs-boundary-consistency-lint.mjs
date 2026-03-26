#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();

const files = [
  'README.md',
  'DEPLOY.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'PR_ANALYSIS_SUMMARY.md',
  'docs/README.md',
  'docs/architecture/README.md',
  'docs/architecture/infrastructure-architecture.md',
  'docs/architecture/architecture-overview.md',
  'docs/architecture/component-interaction-diagram.md',
  'docs/engineering/adr-index.md',
  'infra/README.md',
  'infra/k8s/README.md',
].sort();

const staleMarkers = [
  {
    name: 'Legacy product name',
    regex: /\bValueCanvas\b/g,
    hint: 'Use ValueOS for canonical product naming in docs.',
  },
  {
    name: 'Invalid duplicated k8s path',
    regex: /\binfra\/infra\/k8s\//g,
    hint: 'Use infra/k8s/ repository paths.',
  },
  {
    name: 'Legacy agent file location',
    regex: /\bapps\/ValyntApp\/src\/lib\/agent-fabric\/agents\//g,
    hint: 'Use packages/backend/src/lib/agent-fabric/agents/.',
  },
];

const archiveBoundaryRules = [
  {
    name: 'Archived ECS path referenced as active',
    regex: /infra\/archive\/terraform\/ecs-reference|infra\/reference\/terraform-archived-ecs/i,
    hint: 'Archive paths must be described as archived/reference-only, never as active runtime sources.',
  },
  {
    name: 'Archived migration path referenced as active',
    regex: /infra\/supabase\/supabase\/migrations\/(archive\/|_archived_|_deferred_archived|migrations_archive)/i,
    hint: 'Migration archive paths must be described as archived/superseded material, never as the active chain.',
  },
];

const legacyIdentifierRules = [
  {
    name: 'Legacy identifier "valynt"',
    regex: /\bvalynt(?:[-_][a-z0-9-]+)?\b/gi,
    hint: 'Use canonical ValueOS environment/resource names. Keep legacy strings only inside archival docs or lines tagged [legacy-id].',
  },
  {
    name: 'Legacy identifier "valuecanvas"',
    regex: /\bvaluecanvas\b/gi,
    hint: 'Use ValueOS naming unless documenting archived historical material.',
  },
];

const LEGACY_LINE_ALLOWLIST_RE = /\[legacy-id\]/i;
const LEGACY_FILE_ALLOWLIST = [
  /^docs\/runbooks\//,
  /^docs\/operations\/release-1\.0\//,
  /^docs\/reference\//,
  /^docs\/archive\//,
];

const ACTIVE_CONTEXT_RE = /\b(active|canonical|authoritative|source of truth|shared-environment|staging|production|deploy(?:ment)? path|runtime(?: target| platform)?|current(?:ly)? uses?)\b/i;
const ARCHIVE_CONTEXT_RE = /\b(archive|archived|reference|historical|deprecated|superseded|legacy|break-glass|local-only|not part of the active|non-production|inactive)\b/i;
const ECS_RUNTIME_RE = /\b(ECS|Fargate)\b/i;
const DOCKER_COMPOSE_RE = /\bDocker Compose\b|\bdocker compose\b/i;
const KUBERNETES_RE = /\bKubernetes\b|\bk8s\b/i;

const violations = [];

for (const file of files) {
  const absolute = path.resolve(repoRoot, file);
  const content = readFileSync(absolute, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    staleMarkers.forEach((marker) => {
      marker.regex.lastIndex = 0;
      if (marker.regex.test(line)) {
        violations.push({
          file,
          line: index + 1,
          marker: marker.name,
          text: line.trim(),
          hint: marker.hint,
        });
      }
    });

    archiveBoundaryRules.forEach((rule) => {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(line) && ACTIVE_CONTEXT_RE.test(line) && !ARCHIVE_CONTEXT_RE.test(line)) {
        violations.push({
          file,
          line: index + 1,
          marker: rule.name,
          text: line.trim(),
          hint: rule.hint,
        });
      }
    });

    if (ECS_RUNTIME_RE.test(line) && ACTIVE_CONTEXT_RE.test(line) && !ARCHIVE_CONTEXT_RE.test(line)) {
      violations.push({
        file,
        line: index + 1,
        marker: 'ECS described as active runtime',
        text: line.trim(),
        hint: 'ECS/Fargate is archived-reference only. Shared environments run on Kubernetes.',
      });
    }

    if (DOCKER_COMPOSE_RE.test(line) && ACTIVE_CONTEXT_RE.test(line) && !ARCHIVE_CONTEXT_RE.test(line) && !/\blocal\b|\bworkstation\b|\bdeveloper\b|\bvalidation\b/i.test(line)) {
      violations.push({
        file,
        line: index + 1,
        marker: 'Docker Compose described as shared-environment runtime',
        text: line.trim(),
        hint: 'Docker Compose may be documented only as local-only or isolated validation infrastructure.',
      });
    }

    if (KUBERNETES_RE.test(line) && /\baspirational\b/i.test(line) && !/\breadiness note\b/i.test(content)) {
      violations.push({
        file,
        line: index + 1,
        marker: 'Kubernetes marked aspirational in summary doc',
        text: line.trim(),
        hint: 'Summary docs must describe Kubernetes as the active shared-environment runtime.',
      });
    }
  });
}

const scanLegacyIdentifiersInDocs = (directory) => {
  const entries = readdirSync(path.resolve(repoRoot, directory));
  for (const entry of entries) {
    const relativePath = path.posix.join(directory, entry);
    const absolutePath = path.resolve(repoRoot, relativePath);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      scanLegacyIdentifiersInDocs(relativePath);
      continue;
    }

    if (!relativePath.endsWith('.md')) {
      continue;
    }

    if (LEGACY_FILE_ALLOWLIST.some((rule) => rule.test(relativePath))) {
      continue;
    }

    const content = readFileSync(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (LEGACY_LINE_ALLOWLIST_RE.test(line)) {
        return;
      }

      legacyIdentifierRules.forEach((rule) => {
        rule.regex.lastIndex = 0;
        if (rule.regex.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            marker: rule.name,
            text: line.trim(),
            hint: rule.hint,
          });
        }
      });
    });
  }
};

scanLegacyIdentifiersInDocs('docs/operations/runbooks');
scanLegacyIdentifiersInDocs('docs/runbooks');

if (violations.length > 0) {
  console.error('❌ Docs boundary consistency lint failed.');
  for (const violation of violations) {
    console.error(` - [${violation.file}:${violation.line}] ${violation.marker}: ${violation.text}`);
    console.error(`   ↳ ${violation.hint}`);
  }
  process.exit(1);
}

console.log(`✅ Docs boundary consistency lint passed (${files.length} canonical file(s) + runbook legacy-identifier scan).`);
