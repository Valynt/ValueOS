#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MANIFEST_PATH = 'scripts/ci/layer3-release-readiness-manifest.json';
const DEFAULT_REPORT_PATH = 'artifacts/ci/layer3-readiness-report.md';
const DEFAULT_L3_MIGRATION_MATCHERS = [
  /^artifacts\/layer3\/tenant-migration-readiness-checklist\.md$/,
  /^docs\/runbooks\/layer3-tenant-migration-readiness\.md$/,
  /^scripts\/ci\/check-layer3-readiness-evidence\.mjs$/,
  /^scripts\/ci\/layer3-release-readiness-manifest\.json$/,
  /^scripts\/layer3\/.*tenant.*$/,
  /^scripts\/layer3\/.*migrat.*$/,
  /^scripts\/db\/migrations\/.*(layer3|tenant|migration).*/,
  /^.*migrate_tenant_ids\.py$/,
  /^.*028_l3_tenant_standardization\.py$/,
  /^.*create_composite_tenant_indexes\.py$/,
];

function nowMs() { return Date.now(); }
function loadManifest(manifestPath) { return JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
function changedControlsFromManifest(manifest) { return manifest.checks.map((check) => check.id).sort(); }

function readPathValue(source, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object' || !(key in acc)) throw new Error(`missing required path: ${dottedPath}`);
    return acc[key];
  }, source);
}

function parseBoolean(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return null;
}

function parseChangedFiles(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/\r?\n|,/) 
    .map((file) => file.trim())
    .filter(Boolean);
}

function detectLayer3TenantMigrationChanged(changedFiles) {
  return changedFiles.some((file) => DEFAULT_L3_MIGRATION_MATCHERS.some((matcher) => matcher.test(file)));
}

function buildApplicabilityContext() {
  const override = parseBoolean(process.env.LAYER3_TENANT_MIGRATION_APPLICABLE);
  const changedFiles = parseChangedFiles(process.env.LAYER3_CHANGED_FILES);
  const detected = detectLayer3TenantMigrationChanged(changedFiles);
  const layer3TenantMigrationChanged = override ?? detected;

  return {
    layer3TenantMigrationChanged,
    changedFiles,
    source: override == null ? 'changed-files' : 'override',
  };
}

function isCheckApplicable(check, context) {
  if (!check.requiredWhen) return true;
  if (check.requiredWhen.contextFlag && check.requiredWhen.contextFlag in context) {
    return Boolean(context[check.requiredWhen.contextFlag]);
  }
  throw new Error(`unsupported requiredWhen config for check ${check.id}`);
}

function validateJsonArtifact({ check, artifactPath, artifact }) { /* unchanged */
  const rawPayload = fs.readFileSync(artifactPath, 'utf8'); let parsed;
  try { parsed = JSON.parse(rawPayload); } catch { throw new Error(`artifact is not valid JSON: ${artifact}`); }
  if (check.formatVersion == null) throw new Error('manifest missing required field: formatVersion');
  const actualVersion = readPathValue(parsed, 'formatVersion');
  if (actualVersion !== check.formatVersion) throw new Error(`schema version mismatch for ${artifact}: expected ${check.formatVersion}, got ${actualVersion}`);
  for (const requiredPath of check.requiredPaths ?? []) readPathValue(parsed, requiredPath);
  if (!check.successPath) throw new Error('manifest missing required field: successPath');
  const actualValue = readPathValue(parsed, check.successPath);
  if (actualValue !== check.expectedValue) throw new Error(`semantic success check failed at ${check.successPath}: expected ${JSON.stringify(check.expectedValue)}, got ${JSON.stringify(actualValue)}`);
}

function validateLogArtifact({ check, artifactPath, artifact }) {
  const rawPayload = fs.readFileSync(artifactPath, 'utf8');
  for (const marker of check.successMarkers ?? []) if (!rawPayload.includes(marker)) throw new Error(`missing required success marker "${marker}" in ${artifact}`);
  for (const marker of check.failureMarkers ?? []) if (rawPayload.includes(marker)) throw new Error(`found failure marker "${marker}" in ${artifact}`);
}

function validateArtifactSemantics({ check, artifactPath, artifact }) {
  if (!check.validator) throw new Error('manifest missing required field: validator');
  if (check.validator === 'json-path-equals') return validateJsonArtifact({ check, artifactPath, artifact });
  if (check.validator === 'text-markers') return validateLogArtifact({ check, artifactPath, artifact });
  throw new Error(`unknown validator type: ${check.validator}`);
}

export function evaluateLayer3Readiness({ manifest, baseDir = process.cwd(), now = nowMs(), applicabilityContext = buildApplicabilityContext() }) {
  const maxArtifactAgeHours = Number(manifest.maxArtifactAgeHours ?? 24);
  const maxArtifactAgeMs = maxArtifactAgeHours * 60 * 60 * 1000;
  const passedChecks = []; const failedChecks = []; const skippedChecks = []; const openRisks = [];

  for (const check of manifest.checks ?? []) {
    if (!isCheckApplicable(check, applicabilityContext)) {
      skippedChecks.push({ id: check.id, name: check.name, reason: 'not applicable' });
      continue;
    }

    const failures = []; const staleArtifacts = [];
    for (const artifact of check.artifacts ?? []) {
      const artifactPath = path.resolve(baseDir, artifact);
      if (!fs.existsSync(artifactPath)) { failures.push(`missing artifact: ${artifact}`); continue; }
      const stat = fs.statSync(artifactPath); const artifactAgeMs = now - stat.mtimeMs;
      if (artifactAgeMs > maxArtifactAgeMs) { staleArtifacts.push(`${artifact} (${(artifactAgeMs / (60 * 60 * 1000)).toFixed(2)}h old)`); continue; }
      try { validateArtifactSemantics({ check, artifactPath, artifact }); } catch (error) { failures.push(`semantic validation failed for ${artifact}: ${error.message}`); }
    }
    if (staleArtifacts.length > 0) failures.push(`stale artifact(s): ${staleArtifacts.join(', ')}`);
    if (failures.length > 0) { failedChecks.push({ id: check.id, name: check.name, failures }); openRisks.push(`${check.id}: ${failures.join('; ')}`); }
    else { passedChecks.push({ id: check.id, name: check.name }); }
  }

  return {
    maxArtifactAgeHours, passedChecks, failedChecks, skippedChecks,
    changedControls: changedControlsFromManifest(manifest), openRisks,
    applicabilityContext,
    productionReady: failedChecks.length === 0,
  };
}

export function buildLayer3ReadinessReport(result) {
  const lines = [];
  lines.push('# Layer 3 Readiness Report', '', `- Generated at: ${new Date().toISOString()}`, `- Max artifact age (hours): ${result.maxArtifactAgeHours}`, `- Applicability source: ${result.applicabilityContext.source}`, `- Layer 3 tenant migration changed: ${result.applicabilityContext.layer3TenantMigrationChanged}`, `- Production-ready verdict: ${result.productionReady ? 'PASS' : 'FAIL'}`, '');
  lines.push('## Passed checks');
  if (result.passedChecks.length === 0) lines.push('- None'); else for (const check of result.passedChecks) lines.push(`- ✅ ${check.id} (${check.name})`);
  lines.push('', '## Skipped checks');
  if (result.skippedChecks.length === 0) lines.push('- None'); else for (const check of result.skippedChecks) lines.push(`- ⏭️ ${check.id} (${check.name}) — skipped (not applicable)`);
  lines.push('', '## Failed checks');
  if (result.failedChecks.length === 0) lines.push('- None'); else for (const check of result.failedChecks) { lines.push(`- ❌ ${check.id} (${check.name})`); for (const failure of check.failures) lines.push(`  - ${failure}`); }
  lines.push('', '## Changed controls'); for (const control of result.changedControls) lines.push(`- ${control}`);
  lines.push('', '## Open risks'); if (result.openRisks.length === 0) lines.push('- None'); else for (const risk of result.openRisks) lines.push(`- ${risk}`);
  lines.push('', '## Production-ready verdict'); lines.push(result.productionReady ? '- ✅ Ready for additive pre-promotion Layer 3 gate.' : '- ❌ Not ready for promotion: required Layer 3 evidence is missing, stale, or semantically invalid.');
  return `${lines.join('\n')}\n`;
}

function writeReport(reportPath, reportMarkdown) { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, reportMarkdown, 'utf8'); }

function main() {
  const manifestPath = process.env.LAYER3_READINESS_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;
  const reportPath = process.env.LAYER3_READINESS_REPORT_PATH ?? DEFAULT_REPORT_PATH;
  const manifest = loadManifest(manifestPath);
  const result = evaluateLayer3Readiness({ manifest });
  const report = buildLayer3ReadinessReport(result);
  writeReport(reportPath, report);
  console.log(`Layer 3 readiness report written to ${reportPath}`);
  if (!result.productionReady) { console.error('❌ Layer 3 readiness evidence gate failed. See report for missing/stale/invalid artifacts.'); process.exit(1); }
  console.log('✅ Layer 3 readiness evidence gate passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
