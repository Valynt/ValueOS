#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const overlays = [
  'infra/k8s/overlays/staging',
  'infra/k8s/overlays/production',
];

const requiredPolicies = [
  { kind: 'NetworkPolicy', name: 'valynt-default-deny' },
  { kind: 'NetworkPolicy', name: 'zero-trust-default-deny' },
  { kind: 'AuthorizationPolicy', name: 'deny-all-by-default' },
  { kind: 'PeerAuthentication', name: 'valynt-default-peer-auth' },
];

const getRenderedResources = (manifestText) => {
  const resources = new Set();
  for (const doc of manifestText.split('\n---')) {
    const kind = doc.match(/^kind:\s*(\S+)/m)?.[1];
    const name = doc.match(/^\s*name:\s*(\S+)/m)?.[1];
    if (kind && name) {
      resources.add(`${kind}/${name}`);
    }
  }
  return resources;
};

const kustomizeCheck = spawnSync('kustomize', ['version'], {
  cwd: ROOT,
  encoding: 'utf8',
});

if (kustomizeCheck.status !== 0) {
  console.error('kustomize is required in PATH for Kubernetes security policy validation.');
  process.exit(1);
}

let hasFailure = false;

for (const overlay of overlays) {
  const build = spawnSync('kustomize', ['build', overlay], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (build.status !== 0) {
    hasFailure = true;
    console.error(`\n[k8s-security] kustomize build failed for ${overlay}`);
    console.error(build.stderr || build.stdout);
    continue;
  }

  const renderedResources = getRenderedResources(build.stdout);
  const missing = requiredPolicies.filter(({ kind, name }) => {
    const base = `${kind}/${name}`;
    return ![...renderedResources].some((resource) => resource === base || resource.startsWith(`${base}-`));
  });

  if (missing.length > 0) {
    hasFailure = true;
    console.error(`\n[k8s-security] ${overlay} is missing required rendered security policies:`);
    for (const policy of missing) {
      console.error(`- ${policy.kind}/${policy.name}`);
    }
    continue;
  }

  console.log(`[k8s-security] ${overlay} rendered required default-deny and mesh security policies.`);
}

if (hasFailure) {
  process.exit(1);
}
