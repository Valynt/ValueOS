#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'scripts/ci/release-gate-manifest.json'), 'utf8'));

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function parseRepository(repository) {
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPOSITORY must be owner/repo, received: ${repository || '<empty>'}`);
  }

  return { owner, repo };
}

function parseLocalResults() {
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

async function fetchCheckRuns({ owner, repo, sha, token, page }) {
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

async function listAllCheckRuns({ owner, repo, sha, token }) {
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

function evaluateExternalChecks(checkRuns) {
  const checkMap = new Map(checkRuns.map((checkRun) => [checkRun.name, checkRun]));
  const summary = [];
  const missing = [];
  const pending = [];
  const failed = [];

  for (const check of manifest.externalRequiredChecks) {
    const match = checkMap.get(check.checkName);

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

function evaluateLocalChecks(localResults) {
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

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  const timeoutSeconds = Number(process.env.RELEASE_GATE_POLL_TIMEOUT_SECONDS ?? '5400');
  const intervalSeconds = Number(process.env.RELEASE_GATE_POLL_INTERVAL_SECONDS ?? '30');
  const localResults = parseLocalResults();

  if (!token) {
    throw new Error('GITHUB_TOKEN is required.');
  }
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY is required.');
  }
  if (!sha) {
    throw new Error('GITHUB_SHA is required.');
  }

  const { owner, repo } = parseRepository(repository);
  const localEvaluation = evaluateLocalChecks(localResults);
  if (localEvaluation.failed.length > 0) {
    console.error('❌ Local deploy gates are not green:');
    for (const line of localEvaluation.summary) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }

  const deadline = Date.now() + timeoutSeconds * 1000;
  let lastEvaluation = null;

  while (Date.now() <= deadline) {
    const checkRuns = await listAllCheckRuns({ owner, repo, sha, token });
    const evaluation = evaluateExternalChecks(checkRuns);
    lastEvaluation = evaluation;

    console.log('Release gate poll snapshot:');
    for (const line of localEvaluation.summary) {
      console.log(`- local ${line}`);
    }
    for (const line of evaluation.summary) {
      console.log(`- external ${line}`);
    }
    if (evaluation.missing.length > 0) {
      console.log(`- waiting for missing checks: ${evaluation.missing.join(', ')}`);
    }
    if (evaluation.pending.length > 0) {
      console.log(`- waiting for pending checks: ${evaluation.pending.join(', ')}`);
    }

    if (evaluation.failed.length > 0) {
      console.error(`❌ Release gate failed because required checks concluded unsuccessfully: ${evaluation.failed.join(', ')}`);
      process.exit(1);
    }

    if (evaluation.missing.length === 0 && evaluation.pending.length === 0) {
      console.log('✅ Canonical release gate set is green for this commit.');
      return;
    }

    await sleep(intervalSeconds * 1000);
  }

  console.error('❌ Timed out waiting for canonical release gates to complete.');
  if (lastEvaluation) {
    if (lastEvaluation.summary.length > 0) {
      console.error('Last observed check states:');
      for (const line of lastEvaluation.summary) {
        console.error(`- ${line}`);
      }
    }
    if (lastEvaluation.missing.length > 0) {
      console.error(`Missing checks: ${lastEvaluation.missing.join(', ')}`);
    }
    if (lastEvaluation.pending.length > 0) {
      console.error(`Pending checks: ${lastEvaluation.pending.join(', ')}`);
    }
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
