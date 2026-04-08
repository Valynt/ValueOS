#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const auditRoot = path.join(repoRoot, 'docs/operations/launch-evidence');
const templatePath = path.join(auditRoot, 'launch-readiness-audit-template.md');

const mdFiles = collectMarkdownFiles(auditRoot);

if (mdFiles.length === 0) {
  console.log('✅ No launch-readiness audit markdown files found to lint.');
  process.exit(0);
}

const violations = [];

for (const filePath of mdFiles) {
  const relPath = path.relative(repoRoot, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  const sections = parseTopLevelNumberedSections(lines);
  if (sections.length === 0) {
    continue;
  }

  const numberMap = new Map();
  const titleMap = new Map();

  for (const section of sections) {
    pushLine(numberMap, String(section.number), section.line);
    pushLine(titleMap, normalizeTitle(section.title), section.line);
  }

  for (const [sectionNumber, sectionLines] of numberMap) {
    if (sectionLines.length > 1) {
      violations.push(
        `${relPath}: duplicated heading number "${sectionNumber}" at lines ${sectionLines.join(', ')}`
      );
    }
  }

  for (const [normalizedTitle, titleLines] of titleMap) {
    if (titleLines.length > 1) {
      const heading = sections.find((section) => normalizeTitle(section.title) === normalizedTitle)?.title ?? normalizedTitle;
      violations.push(
        `${relPath}: duplicated heading title "${heading}" at lines ${titleLines.join(', ')}`
      );
    }
  }

  const sectionBodyMap = new Map();
  for (const section of sections) {
    const signature = `${section.number}|${normalizeTitle(section.title)}|${normalizeBody(section.body)}`;
    if (sectionBodyMap.has(signature)) {
      const firstLine = sectionBodyMap.get(signature);
      violations.push(
        `${relPath}: repeated full section "${section.number}. ${section.title}" at lines ${firstLine} and ${section.line}`
      );
    } else {
      sectionBodyMap.set(signature, section.line);
    }
  }

  const numberSequence = sections.map((section) => section.number);
  const duplicatedSequence = findDuplicatedContiguousSequence(numberSequence);
  if (duplicatedSequence) {
    const [startA, startB, length] = duplicatedSequence;
    violations.push(
      `${relPath}: duplicated heading sequence [${numberSequence.slice(startA, startA + length).join(', ')}] at heading indexes ${startA + 1}-${startA + length} and ${startB + 1}-${startB + length}`
    );
  }

  if (filePath === templatePath) {
    for (let expected = 1; expected <= 11; expected += 1) {
      const count = numberSequence.filter((n) => n === expected).length;
      if (count !== 1) {
        violations.push(
          `${relPath}: template must contain section "${expected}." exactly once; found ${count}`
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Launch-readiness audit markdown lint failed:');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log('✅ Launch-readiness audit markdown lint passed.');

function collectMarkdownFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(absolute));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(absolute);
    }
  }

  return files;
}

function parseTopLevelNumberedSections(lines) {
  const headingRegex = /^##\s+(\d+)\.\s+(.+?)\s*$/;
  const sections = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(headingRegex);
    if (!match) {
      continue;
    }

    const number = Number.parseInt(match[1], 10);
    const title = match[2].trim();

    let end = i + 1;
    while (end < lines.length && !lines[end].startsWith('## ')) {
      end += 1;
    }

    sections.push({
      number,
      title,
      line: i + 1,
      body: lines.slice(i + 1, end).join('\n').trim(),
    });
  }

  return sections;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeBody(body) {
  return body.replace(/\s+/g, ' ').trim();
}

function pushLine(map, key, line) {
  const existing = map.get(key) ?? [];
  existing.push(line);
  map.set(key, existing);
}

function findDuplicatedContiguousSequence(values) {
  const n = values.length;

  for (let length = Math.floor(n / 2); length >= 2; length -= 1) {
    for (let i = 0; i + (2 * length) <= n; i += 1) {
      for (let j = i + length; j + length <= n; j += 1) {
        let identical = true;
        for (let k = 0; k < length; k += 1) {
          if (values[i + k] !== values[j + k]) {
            identical = false;
            break;
          }
        }

        if (identical) {
          return [i, j, length];
        }
      }
    }
  }

  return null;
}
