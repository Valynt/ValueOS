#!/usr/bin/env node

import {
  evaluateExternalChecksFromCheckRuns,
  evaluateExternalChecksFromReleaseManifest,
  evaluateLocalChecks,
  listAllCheckRuns,
  loadCanonicalReleaseGateManifest,
  loadReleaseManifest,
  parseLocalResults,
  parseRepository,
  validateReleaseManifestShape,
} from './release-manifest-lib.mjs';

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function logEvaluation({ localEvaluation, externalEvaluation, sourceLabel }) {
  for (const line of localEvaluation.summary) {
    console.log(`- local ${line}`);
  }
  for (const line of externalEvaluation.summary) {
    console.log(`- ${sourceLabel} ${line}`);
  }
  if (externalEvaluation.missing.length > 0) {
    console.log(`- waiting for missing checks: ${externalEvaluation.missing.join(', ')}`);
  }
  if (externalEvaluation.pending.length > 0) {
    console.log(`- waiting for pending checks: ${externalEvaluation.pending.join(', ')}`);
  }
}

async function verifyFromManifest({
  releaseGateManifest,
  releaseManifestPath,
  sha,
  localResults,
}) {
  const localEvaluation = evaluateLocalChecks({ localResults, manifest: releaseGateManifest });
  if (localEvaluation.failed.length > 0) {
    console.error('❌ Local deploy gates are not green:');
    for (const line of localEvaluation.summary) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }

  const releaseManifest = loadReleaseManifest(releaseManifestPath);
  validateReleaseManifestShape({ releaseManifest, sha });
  const externalEvaluation = evaluateExternalChecksFromReleaseManifest({
    releaseManifest,
    manifest: releaseGateManifest,
  });

  console.log('Release gate manifest snapshot:');
  logEvaluation({
    localEvaluation,
    externalEvaluation,
    sourceLabel: 'manifest',
  });

  if (externalEvaluation.failed.length > 0) {
    console.error(`❌ Release gate failed because required checks concluded unsuccessfully: ${externalEvaluation.failed.join(', ')}`);
    process.exit(1);
  }

  if (externalEvaluation.missing.length > 0 || externalEvaluation.pending.length > 0) {
    console.error('❌ Release gate failed because the release manifest is incomplete for this commit.');
    process.exit(1);
  }

  console.log('✅ Canonical release gate set is green in the release manifest for this commit.');
}

async function pollGitHubChecks({
  token,
  repository,
  sha,
  localResults,
  timeoutSeconds,
  intervalSeconds,
  releaseGateManifest,
}) {
  const { owner, repo } = parseRepository(repository);
  const localEvaluation = evaluateLocalChecks({ localResults, manifest: releaseGateManifest });
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
    const externalEvaluation = evaluateExternalChecksFromCheckRuns({
      checkRuns,
      manifest: releaseGateManifest,
    });
    lastEvaluation = externalEvaluation;

    console.log('Release gate poll snapshot:');
    logEvaluation({
      localEvaluation,
      externalEvaluation,
      sourceLabel: 'external',
    });

    if (externalEvaluation.failed.length > 0) {
      console.error(`❌ Release gate failed because required checks concluded unsuccessfully: ${externalEvaluation.failed.join(', ')}`);
      process.exit(1);
    }

    if (externalEvaluation.missing.length === 0 && externalEvaluation.pending.length === 0) {
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

async function main() {
  const releaseGateManifest = loadCanonicalReleaseGateManifest();
  const localResults = parseLocalResults();
  const releaseManifestPath = process.env.RELEASE_GATE_MANIFEST_PATH;
  const sha = process.env.GITHUB_SHA;

  if (!sha) {
    throw new Error('GITHUB_SHA is required.');
  }

  if (releaseManifestPath) {
    await verifyFromManifest({
      releaseGateManifest,
      releaseManifestPath,
      sha,
      localResults,
    });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const timeoutSeconds = Number(process.env.RELEASE_GATE_POLL_TIMEOUT_SECONDS ?? '5400');
  const intervalSeconds = Number(process.env.RELEASE_GATE_POLL_INTERVAL_SECONDS ?? '30');

  if (!token) {
    throw new Error('GITHUB_TOKEN is required.');
  }
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY is required.');
  }

  await pollGitHubChecks({
    token,
    repository,
    sha,
    localResults,
    timeoutSeconds,
    intervalSeconds,
    releaseGateManifest,
  });
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
