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

function normalizeReleaseDiff(releaseDiff = {}) {
  return {
    changedFiles: Array.isArray(releaseDiff.changedFiles) ? releaseDiff.changedFiles : [],
    changedChecks: Array.isArray(releaseDiff.changedChecks) ? releaseDiff.changedChecks : [],
    changedInterfaces: Array.isArray(releaseDiff.changedInterfaces) ? releaseDiff.changedInterfaces : [],
  };
}

function changedControlsFromManifest(manifest, releaseDiff = {}) {
  const { changedFiles, changedChecks, changedInterfaces } = normalizeReleaseDiff(releaseDiff);
  const changedCheckSet = new Set(changedChecks);
  const changedInterfaceSet = new Set(changedInterfaces);

  const impacted = [];
  for (const check of manifest.checks ?? []) {
    const ownership = manifest.controlOwnership?.[check.id] ?? {};
    const ownedPaths = Array.isArray(ownership.paths) ? ownership.paths : [];
    const ownedInterfaces = Array.isArray(ownership.interfaces) ? ownership.interfaces : [];

    const hasChangedPath = changedFiles.some((changedFile) => ownedPaths.some((ownedPath) => changedFile.startsWith(ownedPath)));
    const hasChangedInterface = ownedInterfaces.some((entry) => changedInterfaceSet.has(entry));
    const hasChangedCheck = changedCheckSet.has(check.id);

    if (hasChangedPath || hasChangedInterface || hasChangedCheck) {
      impacted.push(check.id);
    }
  }

  return impacted.sort();
}

function readPathValue(source, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object' || !(key in acc)) {
      throw new Error(`missing required path: ${dottedPath}`);
    }
    return acc[key];
  }, source);
}

function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function parseBooleanFromEnv(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return null;
}

function checkRequiredWhen(check, releaseDiff) {
  const config = check.requiredWhen;
  if (!config) {
    return { applicable: true, reason: 'always required' };
  }

  const { changedFiles } = normalizeReleaseDiff(releaseDiff);
  const changedFilesNormalized = changedFiles.map((entry) => String(entry));

  if (config.envVar) {
    const parsed = parseBooleanFromEnv(process.env[config.envVar]);
    if (parsed != null) {
      return {
        applicable: parsed,
        reason: `${config.envVar}=${process.env[config.envVar]} (CI override)`,
      };
    }
  }

  const pathPrefixes = Array.isArray(config.anyChangedPathPrefixes) ? config.anyChangedPathPrefixes : [];
  const patterns = Array.isArray(config.anyChangedPatterns) ? config.anyChangedPatterns : [];
  const patternRegexes = patterns.map(globToRegExp);

  const prefixMatch = changedFilesNormalized.some((changedFile) => pathPrefixes.some((prefix) => changedFile.startsWith(prefix)));
  const patternMatch = changedFilesNormalized.some((changedFile) => patternRegexes.some((pattern) => pattern.test(changedFile)));
  const applicable = prefixMatch || patternMatch;

  return {
    applicable,
    reason: applicable
      ? 'matched changed files in release scope'
      : 'no Layer 3 tenant graph/migration files changed in release scope',
  };
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

export function evaluateLayer3Readiness({ manifest, baseDir = process.cwd(), now = nowMs(), releaseDiff = {} }) {
  const maxArtifactAgeHours = Number(manifest.maxArtifactAgeHours ?? 24);
  const maxArtifactAgeMs = maxArtifactAgeHours * 60 * 60 * 1000;

  const passedChecks = [];
  const failedChecks = [];
  const skippedChecks = [];
  const openRisks = [];

  for (const check of manifest.checks ?? []) {
    const applicability = checkRequiredWhen(check, releaseDiff);
    if (!applicability.applicable) {
      skippedChecks.push({
        id: check.id,
        name: check.name,
        reason: applicability.reason,
        status: 'skipped (not applicable)',
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

  const controlsImpacted = changedControlsFromManifest(manifest, releaseDiff);
  const allControls = (manifest.checks ?? []).map((check) => check.id).sort();
  const controlsImpactedSet = new Set(controlsImpacted);
  const controlsUnchanged = allControls.filter((checkId) => !controlsImpactedSet.has(checkId));
  const failedImpacted = failedChecks
    .filter((check) => controlsImpactedSet.has(check.id))
    .map((check) => check.id)
    .sort();

  return {
    maxArtifactAgeHours,
    passedChecks,
    failedChecks,
    skippedChecks,
    controlsImpacted,
    controlsUnchanged,
    controlsMissingEvidenceDespiteImpact: failedImpacted,
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

  lines.push('## Skipped checks');
  if (result.skippedChecks.length === 0) {
    lines.push('- None');
  } else {
    for (const check of result.skippedChecks) {
      lines.push(`- ⏭️ ${check.id} (${check.name}) — skipped (not applicable): ${check.reason}`);
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

  lines.push('## Controls impacted by this release');
  if (result.controlsImpacted.length === 0) {
    lines.push('- None');
  } else {
    for (const control of result.controlsImpacted) {
      lines.push(`- ${control}`);
    }
  }
  lines.push('');

  lines.push('## Controls unchanged');
  if (result.controlsUnchanged.length === 0) {
    lines.push('- None');
  } else {
    for (const control of result.controlsUnchanged) {
      lines.push(`- ${control}`);
    }
  }
  lines.push('');

  lines.push('## Controls with missing evidence despite impact');
  if (result.controlsMissingEvidenceDespiteImpact.length === 0) {
    lines.push('- None');
  } else {
    for (const control of result.controlsMissingEvidenceDespiteImpact) {
      lines.push(`- ${control}`);
    }
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
  return lines.join('\n');
}

function loadReleaseDiffFromEnv() {
  const raw = process.env.LAYER3_RELEASE_DIFF_JSON;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch (error) {
    throw new Error(`invalid LAYER3_RELEASE_DIFF_JSON: ${error.message}`);
  }
}

function main() {
  const manifestPath = process.env.LAYER3_READINESS_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;
  const reportPath = process.env.LAYER3_READINESS_REPORT_PATH ?? DEFAULT_REPORT_PATH;

  const manifest = loadManifest(manifestPath);
  const releaseDiff = loadReleaseDiffFromEnv();

  const result = evaluateLayer3Readiness({
    manifest,
    baseDir: process.cwd(),
    releaseDiff,
  });

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, buildLayer3ReadinessReport(result), 'utf8');

  if (!result.productionReady) {
    console.error(`Layer 3 readiness failed. See report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`Layer 3 readiness passed. Report: ${reportPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
