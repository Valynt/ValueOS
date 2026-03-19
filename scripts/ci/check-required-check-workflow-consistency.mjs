#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const DOC_ROOTS = ['.github', 'docs'];
const WORKFLOW_DIR = '.github/workflows';
const CHECK_SECTION_HEADINGS = new Set([
  '## Branch Protection Required Checks',
  '## Required Status Checks',
]);

function resolveFromRoot(relativePath) {
  return resolve(ROOT, relativePath);
}

function read(relativePath) {
  return readFileSync(resolveFromRoot(relativePath), 'utf8');
}

function walk(relativeDir, predicate) {
  const results = [];
  const absoluteDir = resolveFromRoot(relativeDir);

  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = resolve(absoluteDir, entry);
    const relativePath = relative(ROOT, absolutePath);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      results.push(...walk(relativePath, predicate));
      continue;
    }

    if (predicate(relativePath)) {
      results.push(relativePath);
    }
  }

  return results.sort();
}

function stripWrappingQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function collectWorkflowJobNames() {
  const workflowFiles = walk(WORKFLOW_DIR, (file) => /\.ya?ml$/u.test(file));
  const jobNames = new Map();

  for (const file of workflowFiles) {
    const lines = read(file).split(/\r?\n/u);
    let inJobsBlock = false;
    let currentJobId = null;

    for (const line of lines) {
      if (!inJobsBlock) {
        if (line === 'jobs:') {
          inJobsBlock = true;
        }
        continue;
      }

      if (/^\S/u.test(line)) {
        inJobsBlock = false;
        currentJobId = null;
        continue;
      }

      const jobMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/u);
      if (jobMatch) {
        currentJobId = jobMatch[1];
        continue;
      }

      if (!currentJobId) {
        continue;
      }

      const nameMatch = line.match(/^    name:\s*(.+?)\s*$/u);
      if (nameMatch) {
        const jobName = stripWrappingQuotes(nameMatch[1].trim());
        jobNames.set(jobName, { file, jobId: currentJobId });
        currentJobId = null;
      }
    }
  }

  return jobNames;
}

function extractRequiredCheckSections(file) {
  const lines = read(file).split(/\r?\n/u);
  const sections = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!CHECK_SECTION_HEADINGS.has(line)) {
      continue;
    }

    const checks = [];
    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const currentLine = lines[innerIndex];
      const trimmed = currentLine.trim();

      if (trimmed.startsWith('## ')) {
        break;
      }

      const bulletMatch = trimmed.match(/^- `([^`]+)`$/u);
      if (bulletMatch) {
        checks.push({ name: bulletMatch[1], lineNumber: innerIndex + 1 });
      }
    }

    if (checks.length > 0) {
      sections.push({ heading: line, checks });
    }
  }

  return sections;
}

function collectDocumentedRequiredChecks() {
  const markdownFiles = DOC_ROOTS.flatMap((dir) => walk(dir, (file) => file.endsWith('.md')));
  const documentedChecks = [];

  for (const file of markdownFiles) {
    const sections = extractRequiredCheckSections(file);
    for (const section of sections) {
      for (const check of section.checks) {
        documentedChecks.push({ ...check, file, heading: section.heading });
      }
    }
  }

  return documentedChecks;
}

const workflowJobNames = collectWorkflowJobNames();
const documentedChecks = collectDocumentedRequiredChecks();
const failures = [];

if (documentedChecks.length === 0) {
  failures.push('- No documented required-check sections were found under .github/ or docs/.');
}

for (const documentedCheck of documentedChecks) {
  if (!workflowJobNames.has(documentedCheck.name)) {
    failures.push(
      `- ${documentedCheck.file}:${documentedCheck.lineNumber} documents required check \`${documentedCheck.name}\`, but no workflow job emits that exact \`name:\` value.`,
    );
  }
}

if (failures.length > 0) {
  console.error('❌ Required-check documentation/workflow drift detected:');
  console.error(failures.join('\n'));
  console.error('\nKnown workflow job names:');
  for (const [jobName, metadata] of [...workflowJobNames.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    console.error(`- ${jobName} (${metadata.file} :: ${metadata.jobId})`);
  }
  process.exit(1);
}

console.log(
  `✅ Required-check documentation/workflow consistency verified (${documentedChecks.length} documented checks, ${workflowJobNames.size} workflow job names)`,
);
