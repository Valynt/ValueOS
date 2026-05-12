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

function parseBooleanEnv(value) {
  if (value == null || value === '') {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  throw new Error(`invalid boolean env value: ${value}`);
}

function parseChangedFilesInput(rawValue) {
  if (!rawValue) {
    return [];
  }
  return rawValue
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function evaluateApplicabilityContext() {
  const explicitRequired = parseBooleanEnv(process.env.LAYER3_TENANT_MIGRATION_REQUIRED);
  const changedFiles = parseChangedFilesInput(process.env.LAYER3_CHANGED_FILES);

  const matchers = [
    /^scripts\/migrations\/migrate_tenant_ids\.py$/,
    /^scripts\/migrations\/028_l3_tenant_standardization\.py$/,
    /^scripts\/migrations\/create_composite_tenant_indexes\.py$/,
    /^scripts\/migrations\/layer3\//,
    /^packages\/backend\/src\/lib\/graph\//,
  ];

  const matchedChangedFiles = changedFiles.filter((changedFile) => matchers.some((matcher) => matcher.test(changedFile)));
  const derivedRequired = matchedChangedFiles.length > 0;
  const layer3TenantMigrationChanged = explicitRequired ?? derivedRequired;

  return {
    layer3TenantMigrationChanged,
    explicitRequired,
    changedFiles,
    matchedChangedFiles,
    source: explicitRequired == null ? 'changed-files' : 'env-override',
  };
}

function isCheckRequired(check, applicabilityContext) {
  if (!check.requiredWhen) {
    return check.required !== false;
  }
  if (!(check.requiredWhen in applicabilityContext)) {
    throw new Error(`unknown requiredWhen condition: ${check.requiredWhen}`);
  }
  return Boolean(applicabilityContext[check.requiredWhen]);
}

function readPathValue(source, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object' || !(key in acc)) {
      throw new Error(`missing required path: ${dottedPath}`);
    }
    return acc[key];
  }, source);
}

function validateJsonArtifact({ check, artifactPath, artifact }) {
  const rawPayload = fs.readFileSync(artifactPath, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error(`artifact is not valid JSON: ${artifact}`);
  }

  if (check.formatVersion == null) {
    throw new Error('manifest missing required field: formatVersion');
  }

  const actualVersion = readPathValue(parsed, 'formatVersion');
  if (actualVersion !== check.formatVersion) {
    throw new Error(`schema version mismatch for ${artifact}: expected ${check.formatVersion}, got ${actualVersion}`);
  }

  for (const requiredPath of check.requiredPaths ?? []) {
    readPathValue(parsed, requiredPath);
  }

  if (!check.successPath) {
    throw new Error('manifest missing required field: successPath');
  }

  const actualValue = readPathValue(parsed, check.successPath);
  if (actualValue !== check.expectedValue) {
    throw new Error(`semantic success check failed at ${check.successPath}: expected ${JSON.stringify(check.expectedValue)}, got ${JSON.stringify(actualValue)}`);
  }
}

function validateLogArtifact({ check, artifactPath, artifact }) {
  const rawPayload = fs.readFileSync(artifactPath, 'utf8');

  for (const marker of check.successMarkers ?? []) {
    if (!rawPayload.includes(marker)) {
      throw new Error(`missing required success marker "${marker}" in ${artifact}`);
    }
  }

  for (const marker of check.failureMarkers ?? []) {
    if (rawPayload.includes(marker)) {
      throw new Error(`found failure marker "${marker}" in ${artifact}`);
    }
  }
}

function validateArtifactSemantics({ check, artifactPath, artifact }) {
  if (!check.validator) {
    throw new Error('manifest missing required field: validator');
  }

  if (check.validator === 'json-path-equals') {
    validateJsonArtifact({ check, artifactPath, artifact });
    return;
  }

  if (check.validator === 'text-markers') {
    validateLogArtifact({ check, artifactPath, artifact });
    return;
  }

  throw new Error(`unknown validator type: ${check.validator}`);
}

export function evaluateLayer3Readiness({ manifest, baseDir = process.cwd(), now = nowMs() }) {
  const maxArtifactAgeHours = Number(manifest.maxArtifactAgeHours ?? 24);
  const maxArtifactAgeMs = maxArtifactAgeHours * 60 * 60 * 1000;

  const passedChecks = [];
  const failedChecks = [];
  const openRisks = [];
  const skippedChecks = [];
  const applicabilityContext = evaluateApplicabilityContext();

  for (const check of manifest.checks ?? []) {
    if (!isCheckRequired(check, applicabilityContext)) {
      skippedChecks.push({
        id: check.id,
        name: check.name,
        reason: 'not applicable',
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
        continue;
      }

      try {
        validateArtifactSemantics({ check, artifactPath, artifact });
      } catch (error) {
        failures.push(`semantic validation failed for ${artifact}: ${error.message}`);
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
    changedControls: changedControlsFromManifest(manifest),
    openRisks,
    skippedChecks,
    applicabilityContext,
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
  lines.push(`- Layer 3 tenant migration changed: ${result.applicabilityContext.layer3TenantMigrationChanged ? 'yes' : 'no'} (${result.applicabilityContext.source})`);
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

  lines.push('## Skipped checks');
  if (result.skippedChecks.length === 0) {
    lines.push('- None');
  } else {
    for (const check of result.skippedChecks) {
      lines.push(`- ⏭️ ${check.id} (${check.name}): skipped (${check.reason})`);
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
    : '- ❌ Not ready for promotion: required Layer 3 evidence is missing, stale, or semantically invalid.');

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
  const result = evaluateLayer3Readiness({ manifest });
  const report = buildLayer3ReadinessReport(result);

  writeReport(reportPath, report);
  console.log(`Layer 3 readiness report written to ${reportPath}`);

  if (!result.productionReady) {
    console.error('❌ Layer 3 readiness evidence gate failed. See report for missing/stale/invalid artifacts.');
    process.exit(1);
  }

  console.log('✅ Layer 3 readiness evidence gate passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
