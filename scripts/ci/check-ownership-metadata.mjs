#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const PLACEHOLDER_PATTERN = /(^|:)(todo|replace_me|tbd|unknown|none|n\/a|-|team:replace_me)$/i;
const TARGET_DIRS = ['docs/runbooks', 'docs/architecture'];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function isPlaceholder(value) {
  if (!value) return true;
  const normalized = value.trim().replace(/^['"]|['"]$/g, '');
  return normalized.length === 0 || PLACEHOLDER_PATTERN.test(normalized);
}

function extractFrontmatterField(text, field) {
  const match = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

function parseEntityDocuments(text) {
  return text
    .split(/^---\s*$/m)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({
      kind: (part.match(/^kind:\s*(.+)$/m) || [])[1]?.trim(),
      metadataName: (part.match(/^\s*name:\s*(.+)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, ''),
      specType: (part.match(/^\s*type:\s*(.+)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, ''),
      specOwner: (part.match(/^\s*owner:\s*(.+)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, ''),
    }));
}

function normalizeOwnerRef(owner) {
  const trimmed = owner.trim().replace(/^['"]|['"]$/g, '');
  if (trimmed.startsWith('group:')) {
    return trimmed.replace(/^group:(default\/)?/i, '');
  }
  if (trimmed.startsWith('team:')) {
    return trimmed.replace(/^team:/i, '');
  }
  return trimmed;
}

const catalogPath = resolve(ROOT, 'catalog-info.yaml');
if (!existsSync(catalogPath)) {
  fail('catalog-info.yaml is missing.');
} else {
  const catalogText = readFileSync(catalogPath, 'utf8');
  const owner = (catalogText.match(/^\s*owner:\s*(.+)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
  const system = (catalogText.match(/^\s*system:\s*(.+)$/m) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');

  if (isPlaceholder(owner)) {
    fail('catalog-info.yaml spec.owner is missing or uses a placeholder value.');
  }
  if (isPlaceholder(system)) {
    fail('catalog-info.yaml spec.system is missing or uses a placeholder value.');
  }

  const entities = parseEntityDocuments(catalogText);
  const normalizedOwner = owner ? normalizeOwnerRef(owner) : '';
  const groupEntity = entities.find((entity) => entity.kind === 'Group' && entity.metadataName === normalizedOwner);
  const systemEntity = entities.find((entity) => entity.kind === 'System' && entity.metadataName === system);

  if (!groupEntity) {
    fail(`Backstage Group entity '${normalizedOwner}' is missing from catalog-info.yaml.`);
  }

  if (!systemEntity) {
    fail(`Backstage System entity '${system}' is missing from catalog-info.yaml.`);
  }

  if (systemEntity?.specOwner && normalizeOwnerRef(systemEntity.specOwner) !== normalizedOwner) {
    fail(`Backstage System '${system}' owner (${systemEntity.specOwner}) does not match component owner (${owner}).`);
  }
}

for (const directory of TARGET_DIRS) {
  const output = execSync(`rg --files ${directory} -g '*.md'`, { cwd: ROOT, encoding: 'utf8' });
  const files = output.split(/\r?\n/).filter(Boolean);
  for (const file of files) {
    const text = readFileSync(resolve(ROOT, file), 'utf8');
    if (!text.startsWith('---\n')) {
      fail(`${file} is missing YAML frontmatter with owner/system metadata.`);
      continue;
    }

    const owner = extractFrontmatterField(text, 'owner');
    const system = extractFrontmatterField(text, 'system');

    if (isPlaceholder(owner)) {
      fail(`${file} frontmatter owner is missing or a placeholder.`);
    }

    if (isPlaceholder(system)) {
      fail(`${file} frontmatter system is missing or a placeholder.`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('✅ Ownership metadata validated for catalog-info.yaml, docs/runbooks, and docs/architecture.');
