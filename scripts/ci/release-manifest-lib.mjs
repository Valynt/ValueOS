#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

export function loadCanonicalReleaseGateManifest() {
  return JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/release-gate-manifest.json'), 'utf8'));
}

export function parseRepository(repository) {
  const [owner, repo] = String(repository ?? '').split('/');
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPOSITORY must be owner/repo, received: ${repository || '<empty>'}`);
  }

  return { owner, repo };
}

export function parseLocalResults() {
  const raw = process.env.RELEASE_GATE_LOCAL_RESULTS_JSON;
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('RELEASE_GATE_LOCAL_RESULTS_JSON must be a JSON object keyed by job id.');
  }

  return parsed;
}

export async function fetchCheckRuns({ owner, repo, sha, token, page }) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100&page=${page}&filter=latest`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'valueos-release-gate-check',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub Checks API request failed (${response.status} ${response.statusText}).`);
  }

  return response.json();
}

export async function listAllCheckRuns({ owner, repo, sha, token }) {
  const checkRuns = [];
  let page = 1;

  while (true) {
    const payload = await fetchCheckRuns({ owner, repo, sha, token, page });
    checkRuns.push(...payload.check_runs);

    if (payload.check_runs.length < 100) {
      break;
    }

    page += 1;
  }

  return checkRuns;
}

export function evaluateExternalChecksFromCheckRuns({ checkRuns, manifest }) {
  const checkMap = new Map(checkRuns.map((checkRun) => [checkRun.name, checkRun]));
  const summary = [];
  const missing = [];
  const pending = [];
  const failed = [];
  const checks = [];

  for (const check of manifest.externalRequiredChecks) {
    const match = checkMap.get(check.checkName);

    if (!match) {
      missing.push(check.checkName);
      continue;
    }

    const status = match.status;
    const conclusion = match.conclusion;
    summary.push(`${check.checkName}: status=${status}, conclusion=${conclusion ?? 'null'}`);
    checks.push({
      job_id: check.jobId,
      check_name: check.checkName,
      workflow: check.workflow,
      status,
      conclusion,
      details_url: match.details_url ?? '',
    });

    if (status !== 'completed') {
      pending.push(check.checkName);
      continue;
    }

    if (conclusion !== 'success') {
      failed.push(`${check.checkName} (${conclusion ?? 'null'})`);
    }
  }

  return { summary, missing, pending, failed, checks };
}

export function evaluateExternalChecksFromReleaseManifest({ releaseManifest, manifest }) {
  const summary = [];
  const missing = [];
  const pending = [];
  const failed = [];
  const manifestChecks = new Map(
    (releaseManifest.required_upstream_checks ?? []).map((check) => [check.check_name, check]),
  );

  for (const check of manifest.externalRequiredChecks) {
    const match = manifestChecks.get(check.checkName);

    if (!match) {
      missing.push(check.checkName);
      continue;
    }

    const status = match.status;
    const conclusion = match.conclusion;
    summary.push(`${check.checkName}: status=${status}, conclusion=${conclusion ?? 'null'}`);

    if (status !== 'completed') {
      pending.push(check.checkName);
      continue;
    }

    if (conclusion !== 'success') {
      failed.push(`${check.checkName} (${conclusion ?? 'null'})`);
    }
  }

  return { summary, missing, pending, failed };
}

export function evaluateLocalChecks({ localResults, manifest }) {
  const failed = [];
  const summary = [];

  for (const jobId of manifest.deployWorkflow.localNeeds) {
    const result = localResults[jobId];
    summary.push(`${jobId}: ${result ?? 'missing'}`);

    if (result !== 'success') {
      failed.push(`${jobId} (${result ?? 'missing'})`);
    }
  }

  return { failed, summary };
}

export function loadReleaseManifest(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

export function validateReleaseManifestShape({ releaseManifest, sha }) {
  if (releaseManifest.commit_sha !== sha) {
    throw new Error(`Release manifest commit SHA mismatch: expected ${sha}, received ${releaseManifest.commit_sha ?? '<missing>'}.`);
  }

  const backendDigest = releaseManifest.images?.backend?.digest;
  const frontendDigest = releaseManifest.images?.frontend?.digest;
  const backendRef = releaseManifest.images?.backend?.ref;
  const frontendRef = releaseManifest.images?.frontend?.ref;
  const cyclonedxPath = releaseManifest.supply_chain?.sboms?.cyclonedx?.artifact_path;
  const spdxPath = releaseManifest.supply_chain?.sboms?.spdx?.artifact_path;
  const cyclonedxSignature = releaseManifest.supply_chain?.signatures?.cyclonedx?.artifact_path;
  const spdxSignature = releaseManifest.supply_chain?.signatures?.spdx?.artifact_path;

  const missing = [];
  if (!backendDigest) missing.push('images.backend.digest');
  if (!frontendDigest) missing.push('images.frontend.digest');
  if (!backendRef) missing.push('images.backend.ref');
  if (!frontendRef) missing.push('images.frontend.ref');
  if (!cyclonedxPath) missing.push('supply_chain.sboms.cyclonedx.artifact_path');
  if (!spdxPath) missing.push('supply_chain.sboms.spdx.artifact_path');
  if (!cyclonedxSignature) missing.push('supply_chain.signatures.cyclonedx.artifact_path');
  if (!spdxSignature) missing.push('supply_chain.signatures.spdx.artifact_path');

  if (missing.length > 0) {
    throw new Error(`Release manifest is missing required fields: ${missing.join(', ')}.`);
  }
}
