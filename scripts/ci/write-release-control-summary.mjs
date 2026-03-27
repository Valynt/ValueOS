#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function normalizeOutcome(status, conclusion) {
  if (status === 'completed' && conclusion === 'success') {
    return 'passed';
  }
  if (status === 'completed' && conclusion && conclusion !== 'success') {
    return 'failed';
  }
  if (status && status !== 'completed') {
    return 'pending';
  }
  return 'not_observed';
}

function main() {
  const releaseGateManifestPath = resolve(process.env.RELEASE_GATE_MANIFEST_PATH ?? 'scripts/ci/release-gate-manifest.json');
  const releaseManifestPath = resolve(requiredEnv('RELEASE_MANIFEST_PATH'));
  const outputJsonPath = resolve(process.env.RELEASE_CONTROL_SUMMARY_JSON ?? 'release-artifacts/release-control-summary.json');
  const outputMarkdownPath = resolve(process.env.RELEASE_CONTROL_SUMMARY_MD ?? 'release-artifacts/release-control-summary.md');

  const releaseGateManifest = JSON.parse(readFileSync(releaseGateManifestPath, 'utf8'));
  const releaseManifest = JSON.parse(readFileSync(releaseManifestPath, 'utf8'));

  const upstreamChecks = new Map((releaseManifest.required_upstream_checks ?? []).map((check) => [check.check_name, check]));

  const rows = releaseGateManifest.releaseBlockingGates.map((gate) => {
    const observed = upstreamChecks.get(gate.jobName);
    const status = observed?.status ?? null;
    const conclusion = observed?.conclusion ?? null;

    return {
      gate_id: gate.id,
      workflow: gate.workflow,
      job_id: gate.jobId,
      check_name: gate.jobName,
      owner: gate.owner ?? 'unassigned',
      remediation: gate.remediation ?? 'See owning team runbook.',
      outcome: normalizeOutcome(status, conclusion),
      status: status ?? 'not_observed',
      conclusion: conclusion ?? 'not_observed',
    };
  });

  const summary = {
    version: 1,
    generated_at_utc: new Date().toISOString(),
    commit_sha: releaseManifest.commit_sha,
    source_workflow: releaseManifest.source_workflow,
    gates: rows,
  };

  mkdirSync(dirname(outputJsonPath), { recursive: true });
  mkdirSync(dirname(outputMarkdownPath), { recursive: true });

  writeFileSync(outputJsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  const markdown = [
    '# Release Control Summary',
    '',
    `- commit_sha: ${summary.commit_sha}`,
    `- generated_at_utc: ${summary.generated_at_utc}`,
    `- source_workflow: ${summary.source_workflow?.name ?? 'unknown'} (${summary.source_workflow?.run_url ?? 'n/a'})`,
    '',
    '| Gate | Outcome | Owner | Remediation Pointer |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.gate_id} | ${row.outcome} | ${row.owner} | ${row.remediation} |`),
    '',
  ].join('\n');

  writeFileSync(outputMarkdownPath, markdown, 'utf8');
  console.log(`✅ Wrote release control summary to ${outputJsonPath} and ${outputMarkdownPath}`);
}

main();
