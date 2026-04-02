#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EVIDENCE_INDEX_PATH = resolve('docs/security-compliance/evidence-index.md');
const DEFAULT_EVIDENCE_ROOT = resolve('evidence');
const DEFAULT_ARTIFACT_DIR = resolve('artifacts/compliance/evidence-completeness');

function parseArgs(argv) {
  const parsed = {
    evidenceRoot: DEFAULT_EVIDENCE_ROOT,
    outputDir: DEFAULT_ARTIFACT_DIR,
  };

  for (const arg of argv) {
    if (arg.startsWith('--evidence-root=')) {
      parsed.evidenceRoot = resolve(arg.slice('--evidence-root='.length));
    } else if (arg.startsWith('--output-dir=')) {
      parsed.outputDir = resolve(arg.slice('--output-dir='.length));
    }
  }

  return parsed;
}

function extractRequiredArtifacts(markdown) {
  const lines = markdown.split(/\r?\n/);
  const required = new Set();
  let inPrimaryList = false;
  let inSecretRotationList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'Each bundle contains:') {
      inPrimaryList = true;
      inSecretRotationList = false;
      continue;
    }

    if (trimmed === 'Each secret-rotation bundle contains:') {
      inPrimaryList = false;
      inSecretRotationList = true;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      inPrimaryList = false;
      inSecretRotationList = false;
    }

    if (!inPrimaryList && !inSecretRotationList) {
      continue;
    }

    const bulletMatch = trimmed.match(/^-\s+`([^`]+)`/);
    if (!bulletMatch) {
      if (trimmed.length === 0) {
        continue;
      }
      if (!trimmed.startsWith('-')) {
        inPrimaryList = false;
        inSecretRotationList = false;
      }
      continue;
    }

    const rawPath = bulletMatch[1].trim();
    if (!rawPath.includes('<')) {
      required.add(rawPath);
    }
  }

  return [...required].sort();
}

function resolveArtifactPath(evidenceRoot, requiredPath) {
  if (requiredPath.startsWith('artifacts/security/secret-rotation/')) {
    const suffix = requiredPath.replace('artifacts/security/secret-rotation/', 'security/secret-rotation/');
    return resolve(evidenceRoot, suffix);
  }

  if (requiredPath.startsWith('evidence/')) {
    return resolve(evidenceRoot, requiredPath.slice('evidence/'.length));
  }

  return resolve(evidenceRoot, requiredPath);
}

function main() {
  const { evidenceRoot, outputDir } = parseArgs(process.argv.slice(2));
  const markdown = readFileSync(EVIDENCE_INDEX_PATH, 'utf8');
  const requiredArtifacts = extractRequiredArtifacts(markdown);

  const missing = [];
  const empty = [];
  const present = [];

  for (const artifactPath of requiredArtifacts) {
    const resolvedPath = resolveArtifactPath(evidenceRoot, artifactPath);
    if (!existsSync(resolvedPath)) {
      missing.push({ artifactPath, resolvedPath });
      continue;
    }

    const stats = statSync(resolvedPath);
    if (!stats.isFile() || stats.size === 0) {
      empty.push({ artifactPath, resolvedPath });
      continue;
    }

    present.push({ artifactPath, resolvedPath, size: stats.size });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    evidenceRoot,
    source: EVIDENCE_INDEX_PATH,
    requiredArtifactCount: requiredArtifacts.length,
    presentCount: present.length,
    missing,
    empty,
    result: missing.length === 0 && empty.length === 0 ? 'pass' : 'fail',
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, 'quarterly-evidence-completeness.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const markdownReport = [
    '# Quarterly Evidence Completeness',
    '',
    `- generatedAt: ${report.generatedAt}`,
    `- evidenceRoot: ${report.evidenceRoot}`,
    `- requiredArtifactCount: ${report.requiredArtifactCount}`,
    `- presentCount: ${report.presentCount}`,
    `- result: ${report.result}`,
    '',
  ];

  if (missing.length > 0) {
    markdownReport.push('## Missing', '');
    for (const item of missing) {
      markdownReport.push(`- ${item.artifactPath} (expected: ${item.resolvedPath})`);
    }
    markdownReport.push('');
  }

  if (empty.length > 0) {
    markdownReport.push('## Empty', '');
    for (const item of empty) {
      markdownReport.push(`- ${item.artifactPath} (found: ${item.resolvedPath})`);
    }
    markdownReport.push('');
  }

  writeFileSync(resolve(outputDir, 'quarterly-evidence-completeness.md'), `${markdownReport.join('\n')}\n`, 'utf8');

  if (report.result !== 'pass') {
    console.error('Quarterly evidence completeness check failed.');
    process.exit(1);
  }

  console.log(`Quarterly evidence completeness check passed (${present.length}/${requiredArtifacts.length} artifacts present).`);
}

main();
