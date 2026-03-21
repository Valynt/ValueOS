#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  evaluateExternalChecksFromCheckRuns,
  listAllCheckRuns,
  loadCanonicalReleaseGateManifest,
  parseRepository,
} from './release-manifest-lib.mjs';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

async function main() {
  const outputPath = resolve(requiredEnv('RELEASE_MANIFEST_OUTPUT'));
  const token = requiredEnv('GITHUB_TOKEN');
  const repository = requiredEnv('GITHUB_REPOSITORY');
  const sha = requiredEnv('GITHUB_SHA');
  const backendImageRef = requiredEnv('BACKEND_IMAGE_REF');
  const backendImageDigest = requiredEnv('BACKEND_IMAGE_DIGEST');
  const frontendImageRef = requiredEnv('FRONTEND_IMAGE_REF');
  const frontendImageDigest = requiredEnv('FRONTEND_IMAGE_DIGEST');
  const artifactName = requiredEnv('RELEASE_MANIFEST_ARTIFACT_NAME');
  const workflowRunId = requiredEnv('GITHUB_RUN_ID');
  const workflowRunAttempt = requiredEnv('GITHUB_RUN_ATTEMPT');
  const workflowName = requiredEnv('GITHUB_WORKFLOW');

  const releaseGateManifest = loadCanonicalReleaseGateManifest();
  const { owner, repo } = parseRepository(repository);
  const checkRuns = await listAllCheckRuns({ owner, repo, sha, token });
  const externalEvaluation = evaluateExternalChecksFromCheckRuns({
    checkRuns,
    manifest: releaseGateManifest,
  });

  if (externalEvaluation.missing.length > 0 || externalEvaluation.pending.length > 0 || externalEvaluation.failed.length > 0) {
    throw new Error(
      `Cannot generate release manifest until required upstream checks are green. missing=${externalEvaluation.missing.join(',') || 'none'} pending=${externalEvaluation.pending.join(',') || 'none'} failed=${externalEvaluation.failed.join(',') || 'none'}.`,
    );
  }

  const workflowRef = process.env.GITHUB_WORKFLOW_REF ?? '';
  const runUrl = `https://github.com/${repository}/actions/runs/${workflowRunId}`;
  const releaseManifest = {
    version: 1,
    generated_at_utc: new Date().toISOString(),
    commit_sha: sha,
    source_workflow: {
      name: workflowName,
      path: '.github/workflows/release.yml',
      ref: workflowRef,
      run_id: workflowRunId,
      run_attempt: workflowRunAttempt,
      run_url: runUrl,
    },
    images: {
      backend: {
        ref: backendImageRef,
        digest: backendImageDigest,
      },
      frontend: {
        ref: frontendImageRef,
        digest: frontendImageDigest,
      },
    },
    required_upstream_checks: externalEvaluation.checks,
    supply_chain: {
      artifact_name: artifactName,
      sboms: {
        cyclonedx: {
          artifact_path: 'release-artifacts/sbom.cyclonedx.json',
        },
        spdx: {
          artifact_path: 'release-artifacts/sbom.spdx.json',
        },
      },
      signatures: {
        cyclonedx: {
          artifact_path: 'release-artifacts/sbom.cyclonedx.json.sig',
        },
        spdx: {
          artifact_path: 'release-artifacts/sbom.spdx.json.sig',
        },
      },
      certificates: {
        cyclonedx: {
          artifact_path: 'release-artifacts/sbom.cyclonedx.json.pem',
        },
        spdx: {
          artifact_path: 'release-artifacts/sbom.spdx.json.pem',
        },
      },
      container_signatures: {
        backend: {
          image_ref: backendImageRef,
          certificate_oidc_issuer: 'https://token.actions.githubusercontent.com',
          certificate_identity: `https://github.com/${repository}/.github/workflows/release.yml@refs/heads/main`,
        },
        frontend: {
          image_ref: frontendImageRef,
          certificate_oidc_issuer: 'https://token.actions.githubusercontent.com',
          certificate_identity: `https://github.com/${repository}/.github/workflows/release.yml@refs/heads/main`,
        },
      },
    },
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, 'utf8');
  console.log(`✅ Wrote release manifest to ${outputPath}`);
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
