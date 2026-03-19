#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function usage() {
  console.error('Usage: node scripts/ci/verify-release-gate-check-runs.mjs --manifest <path> [--summary-out <path>] [--timeout-seconds <n>] [--poll-seconds <n>]');
}

function parseArgs(argv) {
  const args = {
    timeoutSeconds: 2700,
    pollSeconds: 30,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      throw new Error(`Unexpected argument: ${value}`);
    }

    const key = value.slice(2);
    const next = argv[index + 1];
    if (next == null || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    if (key === 'timeout-seconds') {
      args.timeoutSeconds = Number(next);
    } else if (key === 'poll-seconds') {
      args.pollSeconds = Number(next);
    } else if (key === 'manifest') {
      args.manifest = next;
    } else if (key === 'summary-out') {
      args.summaryOut = next;
    } else {
      throw new Error(`Unsupported flag: --${key}`);
    }

    index += 1;
  }

  if (!args.manifest) {
    throw new Error('--manifest is required');
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function githubGet(url, token) {
  const maxRetries = 5;
  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'valueos-release-gate-verifier',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (response.ok) {
        return response.json();
      }

      const status = response.status;
      const text = await response.text();
      const headers = response.headers;

      const retryAfterHeader = headers.get('retry-after');
      const rateLimitRemaining = headers.get('x-ratelimit-remaining');
      const rateLimitReset = headers.get('x-ratelimit-reset');

      const isRateLimitStatus = status === 429 || (status === 403 && (rateLimitRemaining === '0' || rateLimitReset != null || retryAfterHeader != null));
      const isTransientStatus = status >= 500 && status < 600;

      const shouldRetry = (isRateLimitStatus || isTransientStatus) && attempt < maxRetries;

      if (!shouldRetry) {
        throw new Error(`GitHub API ${status} ${response.statusText}: ${text}`);
      }

      let delayMs = 0;

      if (retryAfterHeader != null) {
        const retryAfterSeconds = Number(retryAfterHeader);
        if (!Number.isNaN(retryAfterSeconds)) {
          delayMs = retryAfterSeconds * 1000;
        } else {
          const retryAfterDate = Date.parse(retryAfterHeader);
          if (!Number.isNaN(retryAfterDate)) {
            delayMs = retryAfterDate - Date.now();
          }
        }
      } else if (rateLimitReset != null) {
        const resetSeconds = Number(rateLimitReset);
        if (!Number.isNaN(resetSeconds)) {
          const resetMs = resetSeconds * 1000;
          delayMs = resetMs - Date.now();
        }
      }

      if (!(delayMs > 0)) {
        const baseDelayMs = 1000 * Math.pow(2, attempt);
        const jitterMs = Math.floor(Math.random() * 1000);
        delayMs = baseDelayMs + jitterMs;
      }

      await sleep(Math.max(delayMs, 0));
      attempt += 1;
      continue;
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        throw error;
      }
      const baseDelayMs = 1000 * Math.pow(2, attempt);
      const jitterMs = Math.floor(Math.random() * 1000);
      const delayMs = baseDelayMs + jitterMs;
      await sleep(delayMs);
      attempt += 1;
    }
  }

  throw lastError ?? new Error('GitHub API request failed after retries');
}

async function listCheckRuns({ owner, repo, sha, token }) {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`;
  const collected = [];
  let page = 1;

  while (true) {
    const data = await githubGet(`${baseUrl}?per_page=100&page=${page}`, token);
    collected.push(...(data.check_runs ?? []));

    if ((data.check_runs ?? []).length < 100) {
      break;
    }

    page += 1;
  }

  return collected;
}

function summarizeCheck(requiredName, matchingRuns) {
  if (matchingRuns.length === 0) {
    return {
      name: requiredName,
      status: 'missing',
      conclusion: null,
      html_url: null,
      details_url: null,
      completed_at: null,
      matchingRuns: [],
    };
  }

  const completedRuns = matchingRuns
    .filter((run) => run.status === 'completed')
    .sort((left, right) => new Date(right.completed_at ?? 0).getTime() - new Date(left.completed_at ?? 0).getTime());

  const preferred = completedRuns[0] ?? matchingRuns[matchingRuns.length - 1];

  return {
    name: requiredName,
    status: preferred.status,
    conclusion: preferred.conclusion,
    html_url: preferred.html_url,
    details_url: preferred.details_url,
    completed_at: preferred.completed_at,
    matchingRuns: matchingRuns.map((run) => ({
      status: run.status,
      conclusion: run.conclusion,
      started_at: run.started_at,
      completed_at: run.completed_at,
      html_url: run.html_url,
      details_url: run.details_url,
      app: run.app?.name ?? null,
    })),
  };
}

function buildSummary(manifest, requiredResults, context) {
  const allSuccess = requiredResults.every((result) => result.status === 'completed' && result.conclusion === 'success');
  const anyTerminalFailure = requiredResults.some(
    (result) => result.status === 'completed' && result.conclusion !== 'success',
  );

  return {
    generatedAt: new Date().toISOString(),
    repository: context.repository,
    sha: context.sha,
    timeoutSeconds: context.timeoutSeconds,
    pollSeconds: context.pollSeconds,
    manifest,
    requiredResults,
    overallStatus: allSuccess ? 'success' : anyTerminalFailure ? 'failed' : 'pending',
  };
}

function writeSummary(summaryOut, summary) {
  if (!summaryOut) {
    return;
  }

  mkdirSync(dirname(summaryOut), { recursive: true });
  writeFileSync(summaryOut, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    throw error;
  }

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;

  if (!token || !repository || !sha) {
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY, and GITHUB_SHA must be set.');
  }

  const [owner, repo] = repository.split('/');
  const manifestPath = resolve(args.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const requiredChecks = manifest.requiredChecks ?? [];
  const deadline = Date.now() + args.timeoutSeconds * 1000;

  while (true) {
    const checkRuns = await listCheckRuns({ owner, repo, sha, token });
    const requiredResults = requiredChecks.map((check) =>
      summarizeCheck(
        check.name,
        checkRuns.filter((run) => run.name === check.name),
      ),
    );

    const summary = buildSummary(manifest, requiredResults, {
      repository,
      sha,
      timeoutSeconds: args.timeoutSeconds,
      pollSeconds: args.pollSeconds,
    });
    writeSummary(args.summaryOut, summary);

    for (const result of requiredResults) {
      console.log(`${result.name}: status=${result.status} conclusion=${result.conclusion ?? 'n/a'}`);
    }

    if (summary.overallStatus === 'success') {
      console.log(`✅ All ${requiredChecks.length} canonical release gates are green for ${sha}.`);
      return;
    }

    if (summary.overallStatus === 'failed') {
      const failures = requiredResults
        .filter((result) => result.status === 'completed' && result.conclusion !== 'success')
        .map((result) => `${result.name}:${result.conclusion}`)
        .join(', ');
      throw new Error(`Canonical release gates failed for ${sha}: ${failures}`);
    }

    if (Date.now() >= deadline) {
      const pending = requiredResults
        .filter((result) => !(result.status === 'completed' && result.conclusion === 'success'))
        .map((result) => `${result.name}:${result.status}/${result.conclusion ?? 'n/a'}`)
        .join(', ');
      throw new Error(`Timed out waiting for canonical release gates for ${sha}: ${pending}`);
    }

    console.log(`Waiting ${args.pollSeconds}s for remaining canonical release gates...`);
    await sleep(args.pollSeconds * 1000);
  }
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
