#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);

function getArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const exactIndex = args.findIndex((arg) => arg === `--${name}`);
  if (exactIndex >= 0) {
    const value = args[exactIndex + 1];
    return value ?? defaultValue;
  }
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : defaultValue;
}

const inputPath = getArg('input', 'ci-artifacts/pnpm-outdated.json');
const summaryPath = getArg('summary', 'ci-artifacts/dependency-outdated-summary.md');
const reportPath = getArg('report', 'ci-artifacts/dependency-outdated-report.json');

const policyMode = (process.env.OUTDATED_POLICY_MODE ?? 'warn').toLowerCase();
const criticalPackages = new Set(
  (process.env.OUTDATED_CRITICAL_PACKAGES ?? 'react,react-dom,express,zod,vitest')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const criticalMajorMaxAgeDays = Number.parseInt(process.env.OUTDATED_CRITICAL_MAJOR_MAX_AGE_DAYS ?? '180', 10);
const failOnCriticalAge = (process.env.OUTDATED_FAIL_ON_CRITICAL_AGE ?? 'false').toLowerCase() === 'true';

function parseSemver(value) {
  if (!value || typeof value !== 'string') return null;
  const sanitized = value.trim().replace(/^[~^<>=\s]*/, '').split('-')[0];
  const match = sanitized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function classifyUpdate(current, latest) {
  const currentVersion = parseSemver(current);
  const latestVersion = parseSemver(latest);
  if (!currentVersion || !latestVersion) return 'unknown';
  if (latestVersion.major > currentVersion.major) return 'major';
  if (latestVersion.minor > currentVersion.minor) return 'minor';
  if (latestVersion.patch > currentVersion.patch) return 'patch';
  return 'none';
}

function daysBetween(isoDate) {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function getVersionPublishedAt(pkgName, version) {
  try {
    const output = execSync(`pnpm view ${pkgName}@${version} time --json`, { encoding: 'utf8' }).trim();
    const parsed = JSON.parse(output);
    if (typeof parsed?.[version] === 'string') return parsed[version];
    return null;
  } catch {
    return null;
  }
}

function renderRows(items) {
  if (!items.length) return ['| _None_ | - | - | - | - |', ''];
  return [
    '| Package | Current | Latest | Dependency Type | Notes |',
    '| --- | --- | --- | --- | --- |',
    ...items.map((item) => {
      const notes = [item.isDeprecated ? 'deprecated' : null, item.isCritical ? 'critical' : null, item.releaseAgeDays != null ? `${item.releaseAgeDays}d old` : null]
        .filter(Boolean)
        .join(', ');
      return `| ${item.name} | ${item.current} | ${item.latest} | ${item.dependencyType ?? 'unknown'} | ${notes || '-'} |`;
    }),
    '',
  ];
}

async function readOutdatedFile() {
  try {
    const raw = await fs.readFile(inputPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch (error) {
    console.error(`Unable to parse outdated data from ${inputPath}: ${error.message}`);
    process.exit(1);
  }
}

function shouldFail(report) {
  if (policyMode === 'fail' && report.counts.major > 0) {
    return { fail: true, reason: `Policy mode is fail and ${report.counts.major} major upgrade(s) were detected.` };
  }

  if (failOnCriticalAge && report.highRiskMajors.length > 0) {
    return {
      fail: true,
      reason: `${report.highRiskMajors.length} critical major upgrade(s) exceeded age threshold (${criticalMajorMaxAgeDays}d).`,
    };
  }

  return { fail: false, reason: 'Warn-only policy active.' };
}

async function writeOutputs(report) {
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const summaryLines = [
    '# Dependency Outdated Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Policy',
    '',
    `- mode: \`${policyMode}\``,
    `- fail_on_critical_age: \`${failOnCriticalAge}\``,
    `- critical_major_max_age_days: \`${criticalMajorMaxAgeDays}\``,
    `- critical_packages: ${Array.from(criticalPackages).join(', ') || 'none'}`,
    '',
    '## Counts',
    '',
    `- patch: **${report.counts.patch}**`,
    `- minor: **${report.counts.minor}**`,
    `- major: **${report.counts.major}**`,
    '',
    '## High-risk major upgrades',
    '',
    ...renderRows(report.highRiskMajors),
    '## Major upgrades',
    '',
    ...renderRows(report.groups.major),
    '## Minor upgrades',
    '',
    ...renderRows(report.groups.minor),
    '## Patch upgrades',
    '',
    ...renderRows(report.groups.patch),
  ];

  await fs.writeFile(summaryPath, `${summaryLines.join('\n')}\n`, 'utf8');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
}

const outdated = await readOutdatedFile();
const entries = Object.entries(outdated);

const groups = {
  patch: [],
  minor: [],
  major: [],
};

for (const [name, meta] of entries) {
  const updateType = classifyUpdate(meta.current, meta.latest);
  if (updateType === 'none' || updateType === 'unknown') continue;

  const item = {
    name,
    current: meta.current,
    latest: meta.latest,
    wanted: meta.wanted,
    dependencyType: meta.dependencyType,
    isDeprecated: Boolean(meta.isDeprecated),
    isCritical: criticalPackages.has(name),
    updateType,
    releasePublishedAt: null,
    releaseAgeDays: null,
  };

  if (updateType === 'major' && item.isCritical) {
    const publishedAt = getVersionPublishedAt(name, meta.latest);
    item.releasePublishedAt = publishedAt;
    item.releaseAgeDays = publishedAt ? daysBetween(publishedAt) : null;
  }

  groups[updateType].push(item);
}

const highRiskMajors = groups.major.filter(
  (item) => item.isCritical && item.releaseAgeDays != null && item.releaseAgeDays >= criticalMajorMaxAgeDays
);

const report = {
  generatedAt: new Date().toISOString(),
  policy: {
    mode: policyMode,
    failOnCriticalAge,
    criticalMajorMaxAgeDays,
    criticalPackages: Array.from(criticalPackages),
  },
  counts: {
    patch: groups.patch.length,
    minor: groups.minor.length,
    major: groups.major.length,
  },
  highRiskMajors,
  groups,
};

await writeOutputs(report);

const decision = shouldFail(report);
const statusIcon = decision.fail ? '❌' : policyMode === 'warn' ? '⚠️' : '✅';
console.log(`${statusIcon} ${decision.reason}`);
console.log(`Wrote markdown summary to ${summaryPath}`);
console.log(`Wrote structured report to ${reportPath}`);

if (decision.fail) {
  process.exit(1);
}
