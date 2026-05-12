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

function normalizeReleaseDiff(releaseDiff) {
  const changedFiles = Array.isArray(releaseDiff?.changedFiles) ? releaseDiff.changedFiles : [];
  const changedChecks = Array.isArray(releaseDiff?.changedChecks) ? releaseDiff.changedChecks : [];
  const changedInterfaces = Array.isArray(releaseDiff?.changedInterfaces) ? releaseDiff.changedInterfaces : [];

  return {
    changedFiles,
    changedChecks,
    changedInterfaces,
  };
}

function hasPrefixMatch(targetPath, changedFiles) {
  return changedFiles.some((changedFile) => changedFile === targetPath || changedFile.startsWith(`${targetPath}/`));
}

function changedControlsFromManifest(manifest, releaseDiffInput = {}) {
  const releaseDiff = normalizeReleaseDiff(releaseDiffInput);

  const impactedControls = [];

  for (const check of manifest.checks ?? []) {
    const ownership = manifest.checkOwnership?.[check.id] ?? {};
    const ownershipPaths = Array.isArray(ownership.paths) ? ownership.paths : [];
    const ownershipInterfaces = Array.isArray(ownership.interfaces) ? ownership.interfaces : [];

    const impactedByCheckId = releaseDiff.changedChecks.includes(check.id);
    const impactedByPath = ownershipPaths.some((ownedPath) => hasPrefixMatch(ownedPath, releaseDiff.changedFiles));
    const impactedByInterface = ownershipInterfaces.some((ownedInterface) => releaseDiff.changedInterfaces.includes(ownedInterface));

    if (impactedByCheckId || impactedByPath || impactedByInterface) {
      impactedControls.push(check.id);
    }
  }

  return impactedControls.sort();
}

export function evaluateLayer3Readiness({ manifest, baseDir = process.cwd(), now = nowMs(), releaseDiff = {} }) {
  const maxArtifactAgeHours = Number(manifest.maxArtifactAgeHours ?? 24);
  const maxArtifactAgeMs = maxArtifactAgeHours * 60 * 60 * 1000;
  const changedControls = changedControlsFromManifest(manifest, releaseDiff);
  const changedControlSet = new Set(changedControls);

  const passedChecks = [];
  const failedChecks = [];
  const openRisks = [];

  for (const check of manifest.checks ?? []) {
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

  const unchangedControls = (manifest.checks ?? [])
    .map((check) => check.id)
    .filter((checkId) => !changedControlSet.has(checkId))
    .sort();

  const missingEvidenceImpactedControls = failedChecks
    .map((check) => check.id)
    .filter((checkId) => changedControlSet.has(checkId))
    .sort();

  return {
    maxArtifactAgeHours,
    passedChecks,
    failedChecks,
    changedControls,
    unchangedControls,
    missingEvidenceImpactedControls,
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

  lines.push('## Controls impacted by this release');
  if (result.changedControls.length === 0) {
    lines.push('- None');
  } else {
    for (const control of result.changedControls) {
      lines.push(`- ${control}`);
    }
  }
  lines.push('');

  lines.push('## Controls unchanged in this release');
  if (result.unchangedControls.length === 0) {
    lines.push('- None');
  } else {
    for (const control of result.unchangedControls) {
      lines.push(`- ${control}`);
    }
  }
  lines.push('');

  lines.push('## Impacted controls with missing evidence');
  if (result.missingEvidenceImpactedControls.length === 0) {
    lines.push('- None');
  } else {
    for (const control of result.missingEvidenceImpactedControls) {
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

function parseReleaseDiffFromEnv() {
  const payload = process.env.LAYER3_RELEASE_DIFF_JSON;
  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(payload);
  } catch (error) {
    console.error('❌ Invalid LAYER3_RELEASE_DIFF_JSON payload. Expected valid JSON.');
    throw error;
  }
}

function main() {
  const manifestPath = process.env.LAYER3_READINESS_MANIFEST_PATH ?? DEFAULT_MANIFEST_PATH;
  const reportPath = process.env.LAYER3_READINESS_REPORT_PATH ?? DEFAULT_REPORT_PATH;

  const manifest = loadManifest(manifestPath);
  const releaseDiff = parseReleaseDiffFromEnv();
  const result = evaluateLayer3Readiness({ manifest, releaseDiff });
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
