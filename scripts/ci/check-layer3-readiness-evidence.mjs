#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MANIFEST_PATH = 'scripts/ci/layer3-release-readiness-manifest.json';
const DEFAULT_REPORT_PATH = 'artifacts/ci/layer3-readiness-report.md';

function nowMs() {
  return Date.now();
}

function loadManifest(manifestPath) {
  const payload = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(payload);
}

function changedControlsFromManifest(manifest) {
  return manifest.checks
    .map((check) => check.id)
    .sort();
}

function parseChangedFiles(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
    }
  } catch {
    // Fall through to newline/CSV parsing below.
  }

  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function globPatternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${regexPattern}$`);
}

function resolveApplicabilityFromCondition(requiredWhen, changedFiles) {
  if (!requiredWhen) {
    return { applicable: true, reason: 'always required' };
  }

  const patterns = Array.isArray(requiredWhen.anyChangedFileMatches)
    ? requiredWhen.anyChangedFileMatches
    : [];
  if (patterns.length === 0) {
    return { applicable: true, reason: 'requiredWhen provided without anyChangedFileMatches patterns' };
  }

  const matchedFiles = [];
  for (const pattern of patterns) {
    const matcher = globPatternToRegExp(pattern);
    for (const file of changedFiles) {
      if (matcher.test(file)) {
        matchedFiles.push(file);
      }
    }
  }

  if (matchedFiles.length > 0) {
    return {
      applicable: true,
      reason: `requiredWhen matched changed file(s): ${[...new Set(matchedFiles)].join(', ')}`,
    };
  }

  return {
    applicable: false,
    reason: `requiredWhen not met (patterns: ${patterns.join(', ')})`,
  };
}

export function evaluateLayer3Readiness({ manifest, changedFiles = [], baseDir = process.cwd(), now = nowMs() }) {
  const maxArtifactAgeHours = Number(manifest.maxArtifactAgeHours ?? 24);
  const maxArtifactAgeMs = maxArtifactAgeHours * 60 * 60 * 1000;

  const passedChecks = [];
  const failedChecks = [];
  const skippedChecks = [];
  const openRisks = [];

  for (const check of manifest.checks ?? []) {
    const applicability = resolveApplicabilityFromCondition(check.requiredWhen, changedFiles);
    if (!applicability.applicable) {
      skippedChecks.push({
        id: check.id,
        name: check.name,
        reason: applicability.reason,
      });
      continue;
    }

    const failures = [];
    const staleArtifacts = [];

    for (const artifact of check.artifacts ?? []) {
      const artifactPath = path.resolve(baseDir, artifact);
      if (!fs.existsSync(artifactPath)) {
        failures.push(`missing artifact: ${artifact}`);
        continue;
      }

      const stat = fs.statSync(artifactPath);
      const artifactAgeMs = now - stat.mtimeMs;
      if (artifactAgeMs > maxArtifactAgeMs) {
        const ageHours = (artifactAgeMs / (60 * 60 * 1000)).toFixed(2);
        staleArtifacts.push(`${artifact} (${ageHours}h old)`);
      }
    }

    if (staleArtifacts.length > 0) {
      failures.push(`stale artifact(s): ${staleArtifacts.join(', ')}`);
    }

    if (failures.length > 0) {
      failedChecks.push({
        id: check.id,
        name: check.name,
        failures,
      });
      openRisks.push(`${check.id}: ${failures.join('; ')}`);
      continue;
    }

    passedChecks.push({ id: check.id, name: check.name });
  }

  return {
    maxArtifactAgeHours,
    passedChecks,
    failedChecks,
    skippedChecks,
    changedControls: changedControlsFromManifest(manifest),
    changedFiles,
    openRisks,
    productionReady: failedChecks.length === 0,
  };
}

export function buildLayer3ReadinessReport(result) {
  const lines = [];
  lines.push('# Layer 3 Readiness Report');
  lines.push('');
  lines.push(`- Generated at: ${new Date().toISOString()}`);
  lines.push(`- Max artifact age (hours): ${result.maxArtifactAgeHours}`);
  lines.push(`- Production-ready verdict: ${result.productionReady ? 'PASS' : 'FAIL'}`);
  lines.push('');

  lines.push('## Passed checks');
  if (result.passedChecks.length === 0) {
    lines.push('- None');
  } else {
    for (const check of result.passedChecks) {
      lines.push(`- ✅ ${check.id} (${check.name})`);
    }
  }
  lines.push('');

  lines.push('## Failed checks');
  if (result.failedChecks.length === 0) {
    lines.push('- None');
  } else {
    for (const check of result.failedChecks) {
      lines.push(`- ❌ ${check.id} (${check.name})`);
      for (const failure of check.failures) {
        lines.push(`  - ${failure}`);
      }
    }
  }
  lines.push('');

  lines.push('## Skipped checks');
  if (result.skippedChecks.length === 0) {
    lines.push('- None');
  } else {
    for (const check of result.skippedChecks) {
      lines.push(`- ⏭️ ${check.id} (${check.name}): skipped (not applicable)`);
      lines.push(`  - ${check.reason}`);
    }
  }
  lines.push('');

  lines.push('## Changed controls');
  for (const control of result.changedControls) {
    lines.push(`- ${control}`);
  }
  lines.push('');

  lines.push('## Open risks');
  if (result.openRisks.length === 0) {
    lines.push('- None');
  } else {
    for (const risk of result.openRisks) {
      lines.push(`- ${risk}`);
    }
  }
  lines.push('');

  lines.push('## Production-ready verdict');
  lines.push(result.productionReady
    ? '- ✅ Ready for additive pre-promotion Layer 3 gate.'
    : '- ❌ Not ready for promotion: required Layer 3 evidence is missing or stale.');

  return `${lines.join('\n')}\n`;
}

function writeReport(reportPath, reportMarkdown) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, reportMarkdown, 'utf8');
}

function main() {
  const manifestPath = process.env.LAYER3_READINESS_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;
  const reportPath = process.env.LAYER3_READINESS_REPORT_PATH ?? DEFAULT_REPORT_PATH;

  const manifest = loadManifest(manifestPath);
  const changedFiles = parseChangedFiles(
    process.env.LAYER3_CHANGED_FILES
      ?? process.env.CHANGED_FILES
      ?? process.env.GITHUB_CHANGED_FILES
      ?? ''
  );
  const result = evaluateLayer3Readiness({ manifest, changedFiles });
  const report = buildLayer3ReadinessReport(result);

  writeReport(reportPath, report);
  console.log(`Layer 3 readiness report written to ${reportPath}`);

  if (!result.productionReady) {
    console.error('❌ Layer 3 readiness evidence gate failed. See report for missing/stale artifacts.');
    process.exit(1);
  }

  console.log('✅ Layer 3 readiness evidence gate passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
