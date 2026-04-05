#!/usr/bin/env node

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const utcToday = new Date().toISOString().slice(0, 10);
const reportDir = path.resolve(repoRoot, 'artifacts/security');
const reportJsonPath = path.join(reportDir, 'date-integrity-report.json');
const reportMdPath = path.join(reportDir, 'date-integrity-report.md');

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const ACTIONABLE_DOC_STALE_DAYS = Number.parseInt(process.env.ACTIONABLE_DOC_STALE_DAYS ?? '30', 10);
const STALE_DOC_BANNER_START = '<!-- stale-doc-banner:start -->';

function toIsoDate(rawValue) {
  const value = String(rawValue).trim();
  if (DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  if (DATE_TIME_PATTERN.test(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }

  return null;
}

function collectFiles(directory, predicate) {
  const absoluteDirectory = path.resolve(repoRoot, directory);
  const files = [];

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absoluteEntry = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path.relative(repoRoot, absoluteEntry), predicate));
      continue;
    }

    const relativeEntry = path.relative(repoRoot, absoluteEntry);
    if (predicate(relativeEntry)) {
      files.push(relativeEntry);
    }
  }

  return files.sort();
}

function parseMarkdownTableRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .filter((line) => !line.includes('---'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function parseAdrIndexDates(indexPath) {
  const absolutePath = path.resolve(repoRoot, indexPath);
  const markdown = readFileSync(absolutePath, 'utf8');
  const tableRows = parseMarkdownTableRows(markdown);

  const adrRows = tableRows.filter((row) => row.length >= 7 && /^ADR-\d{4}$/.test(row[0]));
  const exceptions = new Map();

  const exceptionSectionMatch = markdown.match(/##\s+Date Integrity Exceptions[\s\S]*?\n\n|##\s+Date Integrity Exceptions[\s\S]*$/);
  if (exceptionSectionMatch) {
    const exceptionRows = parseMarkdownTableRows(exceptionSectionMatch[0]);
    for (const row of exceptionRows) {
      if (row.length >= 3 && /^ADR-\d{4}$/.test(row[0])) {
        exceptions.set(row[0], {
          metadataKey: row[1],
          metadataValue: row[2],
          justification: row[3] ?? '',
        });
      }
    }
  }

  const findings = [];

  for (const row of adrRows) {
    const [adrId, , , dateValue] = row;
    const parsedDate = toIsoDate(dateValue);
    if (!parsedDate) {
      findings.push({
        type: 'invalid-date-format',
        source: indexPath,
        scope: `ADR index (${adrId})`,
        field: 'Date',
        value: dateValue,
        message: `ADR ${adrId} has an invalid Date format in docs/engineering/adr-index.md`,
      });
      continue;
    }

    const isFuture = parsedDate > utcToday;
    if (!isFuture) {
      continue;
    }

    const exception = exceptions.get(adrId);
    if (exception?.metadataKey === 'planned_effective_date' && toIsoDate(exception.metadataValue) === parsedDate) {
      findings.push({
        type: 'allowed-future-date',
        source: indexPath,
        scope: `ADR index (${adrId})`,
        field: 'Date',
        value: parsedDate,
        metadataKey: exception.metadataKey,
        metadataValue: exception.metadataValue,
        justification: exception.justification,
        blocking: false,
      });
      continue;
    }

    findings.push({
      type: 'future-date',
      source: indexPath,
      scope: `ADR index (${adrId})`,
      field: 'Date',
      value: parsedDate,
      message: `ADR ${adrId} Date (${parsedDate}) is in the future relative to UTC run date (${utcToday}) and is missing planned_effective_date exception metadata.`,
      blocking: true,
    });
  }

  return findings;
}

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return null;
  }

  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const fieldMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.+)\s*$/);
    if (fieldMatch) {
      fields.set(fieldMatch[1], fieldMatch[2].replace(/^['"]|['"]$/g, ''));
    }
  }

  return fields;
}

function getActionableDocOwner(filePath) {
  if (filePath.startsWith('docs/operations/')) {
    return 'team-operations';
  }

  if (filePath.startsWith('docs/release/')) {
    return 'team-release';
  }

  return 'team-platform';
}

function isActionableDoc(filePath) {
  if (filePath === 'docs/spec-backlog.md') {
    return true;
  }

  if (/^docs\/(?:specs\/)?sprint-plan-[^/]+\.md$/i.test(filePath)) {
    return true;
  }

  return /(^docs\/|\/)[^/]*readiness[^/]*\.md$/i.test(filePath);
}

function calculateAgeInDays(isoDate) {
  const today = new Date(`${utcToday}T00:00:00.000Z`);
  const targetDate = new Date(`${isoDate}T00:00:00.000Z`);
  const ageMs = today.getTime() - targetDate.getTime();
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}

function getCurrentSourceCommit() {
  try {
    return execSync('git rev-parse --short=12 HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

function parseMarkdownFrontMatterDates() {
  const markdownFiles = collectFiles('docs', (file) => file.endsWith('.md'));
  const findings = [];

  for (const file of markdownFiles) {
    const content = readFileSync(path.resolve(repoRoot, file), 'utf8');
    const frontMatter = parseFrontMatter(content);
    if (!frontMatter) {
      continue;
    }

    for (const key of ['review_date', 'last_updated']) {
      if (!frontMatter.has(key)) {
        continue;
      }

      const rawValue = frontMatter.get(key);
      const parsedDate = toIsoDate(rawValue);

      if (!parsedDate) {
        findings.push({
          type: 'invalid-date-format',
          source: file,
          scope: 'front-matter',
          field: key,
          value: rawValue,
          message: `${file} has invalid front-matter date for ${key}.`,
          blocking: true,
        });
        continue;
      }

      if (parsedDate <= utcToday) {
        continue;
      }

      const isBlocking = key !== 'review_date';
      findings.push({
        type: 'future-date',
        source: file,
        scope: 'front-matter',
        field: key,
        value: parsedDate,
        message: `${file} has ${key}=${parsedDate}, which is in the future relative to UTC run date (${utcToday}).`,
        blocking: isBlocking,
      });
    }
  }

  return findings;
}

function walkJsonDates(input, onDate, pathPrefix = '$') {
  if (Array.isArray(input)) {
    input.forEach((item, index) => walkJsonDates(item, onDate, `${pathPrefix}[${index}]`));
    return;
  }

  if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      const nextPath = `${pathPrefix}.${key}`;

      if (typeof value === 'string') {
        const parsedDate = toIsoDate(value);
        if (!parsedDate) {
          continue;
        }

        const keyLooksTemporal = /date|updated|timestamp|generated|exported|effective|version/i.test(key);
        if (!keyLooksTemporal) {
          continue;
        }

        onDate({ key, value, parsedDate, jsonPath: nextPath });
        continue;
      }

      walkJsonDates(value, onDate, nextPath);
    }
  }
}

function parseComplianceManifestDates() {
  const manifestFiles = collectFiles('docs/security-compliance', (file) => file.endsWith('.json') && file.includes('manifest'));
  const findings = [];

  for (const file of manifestFiles) {
    const parsed = JSON.parse(readFileSync(path.resolve(repoRoot, file), 'utf8'));

    walkJsonDates(parsed, ({ key, parsedDate, jsonPath }) => {
      if (parsedDate <= utcToday) {
        return;
      }

      findings.push({
        type: 'future-date',
        source: file,
        scope: 'compliance-manifest',
        field: key,
        value: parsedDate,
        jsonPath,
        message: `${file} has ${key}=${parsedDate} at ${jsonPath}, which is in the future relative to UTC run date (${utcToday}).`,
        blocking: true,
      });
    });
  }

  return findings;
}

function parseActionableDocsMetadata() {
  const markdownFiles = collectFiles('docs', (file) => file.endsWith('.md') && isActionableDoc(file));
  const findings = [];
  const expectedSourceCommit = getCurrentSourceCommit();

  for (const file of markdownFiles) {
    const content = readFileSync(path.resolve(repoRoot, file), 'utf8');
    const frontMatter = parseFrontMatter(content);
    const bannerPresent = content.includes(STALE_DOC_BANNER_START);

    if (!frontMatter) {
      findings.push({
        type: 'missing-front-matter',
        source: file,
        scope: 'actionable-doc',
        field: 'frontmatter',
        value: '',
        message: `${file} is an actionable document and must include YAML front-matter with generated_at, owner, and source_commit.`,
        blocking: true,
      });
      continue;
    }

    for (const requiredField of ['generated_at', 'owner', 'source_commit']) {
      const rawValue = frontMatter.get(requiredField);
      if (!rawValue || !String(rawValue).trim()) {
        findings.push({
          type: 'missing-required-field',
          source: file,
          scope: 'actionable-doc',
          field: requiredField,
          value: rawValue ?? '',
          message: `${file} is missing required front-matter field: ${requiredField}.`,
          blocking: true,
        });
      }
    }

    const generatedAtRaw = frontMatter.get('generated_at');
    const generatedAt = generatedAtRaw ? toIsoDate(generatedAtRaw) : null;
    if (!generatedAt) {
      findings.push({
        type: 'invalid-date-format',
        source: file,
        scope: 'actionable-doc',
        field: 'generated_at',
        value: generatedAtRaw ?? '',
        message: `${file} has invalid generated_at value (${generatedAtRaw ?? 'missing'}); expected YYYY-MM-DD or ISO-8601 datetime.`,
        blocking: true,
      });
      continue;
    }

    if (generatedAt > utcToday) {
      findings.push({
        type: 'future-date',
        source: file,
        scope: 'actionable-doc',
        field: 'generated_at',
        value: generatedAt,
        message: `${file} has generated_at=${generatedAt}, which is in the future relative to UTC run date (${utcToday}).`,
        blocking: true,
      });
      continue;
    }

    const ageDays = calculateAgeInDays(generatedAt);
    const status = (frontMatter.get('status') ?? '').toLowerCase();
    if (ageDays > ACTIONABLE_DOC_STALE_DAYS) {
      if (status === 'archived') {
        if (!bannerPresent) {
          findings.push({
            type: 'missing-stale-banner',
            source: file,
            scope: 'actionable-doc',
            field: 'status',
            value: status,
            message: `${file} is archived due to staleness but is missing the stale warning banner.`,
            blocking: true,
          });
        } else {
          findings.push({
            type: 'archived-stale-doc',
            source: file,
            scope: 'actionable-doc',
            field: 'generated_at',
            value: generatedAt,
            message: `${file} is archived and stale (${ageDays} days old). Regenerate to reactivate.`,
            blocking: false,
          });
        }
      } else {
        findings.push({
          type: 'stale-doc',
          source: file,
          scope: 'actionable-doc',
          field: 'generated_at',
          value: generatedAt,
          message: `${file} is stale (${ageDays} days old; threshold=${ACTIONABLE_DOC_STALE_DAYS} days). Refresh or archive it.`,
          blocking: true,
        });
      }
    }

    const owner = frontMatter.get('owner');
    const expectedOwner = getActionableDocOwner(file);
    if (owner && owner !== expectedOwner) {
      findings.push({
        type: 'owner-mismatch',
        source: file,
        scope: 'actionable-doc',
        field: 'owner',
        value: owner,
        message: `${file} owner=${owner} differs from inferred owner ${expectedOwner}.`,
        blocking: false,
      });
    }

    const sourceCommit = frontMatter.get('source_commit');
    if (sourceCommit && expectedSourceCommit && !/^[0-9a-f]{7,40}$/i.test(sourceCommit)) {
      findings.push({
        type: 'invalid-source-commit',
        source: file,
        scope: 'actionable-doc',
        field: 'source_commit',
        value: sourceCommit,
        message: `${file} has source_commit=${sourceCommit}, which is not a valid git commit hash.`,
        blocking: true,
      });
    }
  }

  return findings;
}

const findings = [
  ...parseAdrIndexDates('docs/engineering/adr-index.md'),
  ...parseMarkdownFrontMatterDates(),
  ...parseComplianceManifestDates(),
  ...parseActionableDocsMetadata(),
];

const blockingFindings = findings.filter((finding) => finding.blocking);
const warningFindings = findings.filter((finding) => !finding.blocking);

const report = {
  generated_at_utc: new Date().toISOString(),
  utc_run_date: utcToday,
  summary: {
    blocking_count: blockingFindings.length,
    warning_count: warningFindings.length,
    total_count: findings.length,
    status: blockingFindings.length === 0 ? 'pass' : 'fail',
  },
  policy: {
    adr_date: 'must_not_be_future_without planned_effective_date metadata in docs/engineering/adr-index.md exception table',
    last_updated: 'must_not_be_future',
    review_date: 'tracked_for_visibility_only (non-blocking)',
    compliance_manifest_timestamps: 'must_not_be_future',
    actionable_docs_metadata: `docs/spec-backlog.md, sprint plans, and readiness docs require generated_at/owner/source_commit front-matter`,
    actionable_docs_staleness: `generated_at age must be <= ${ACTIONABLE_DOC_STALE_DAYS} days unless status=archived with stale banner`,
  },
  findings,
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const markdownLines = [
  '# Date Integrity Report',
  '',
  `- UTC run date: ${utcToday}`,
  `- Generated at: ${report.generated_at_utc}`,
  `- Status: **${report.summary.status.toUpperCase()}**`,
  `- Blocking findings: ${report.summary.blocking_count}`,
  `- Non-blocking findings: ${report.summary.warning_count}`,
  '',
  '## Findings',
  '',
];

if (findings.length === 0) {
  markdownLines.push('- ✅ No date-integrity issues found.');
} else {
  for (const finding of findings) {
    const severity = finding.blocking ? 'BLOCKING' : 'WARNING';
    markdownLines.push(`- **${severity}** ${finding.message}`);
  }
}

writeFileSync(reportMdPath, `${markdownLines.join('\n')}\n`, 'utf8');

if (blockingFindings.length > 0) {
  console.error('❌ Docs date-integrity check failed.');
  for (const finding of blockingFindings) {
    console.error(` - ${finding.message}`);
  }
  console.error(`Report written to ${path.relative(repoRoot, reportJsonPath)} and ${path.relative(repoRoot, reportMdPath)}.`);
  process.exit(1);
}

console.log('✅ Docs date-integrity check passed.');
console.log(`Generated report: ${path.relative(repoRoot, reportJsonPath)}`);
console.log(`Generated report: ${path.relative(repoRoot, reportMdPath)}`);
if (warningFindings.length > 0) {
  console.log(`Warnings: ${warningFindings.length}`);
}
