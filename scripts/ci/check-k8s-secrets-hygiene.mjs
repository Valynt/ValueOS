#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const K8S_ROOT = resolve(ROOT, 'infra/k8s');

const DEPLOYABLE_YAML_DIRS = [
  resolve(K8S_ROOT, 'base'),
  resolve(K8S_ROOT, 'overlays/staging'),
  resolve(K8S_ROOT, 'overlays/production'),
  resolve(K8S_ROOT, 'cronjobs'),
];

const NON_DEPLOYABLE_ALLOWLIST = new Set([
  'infra/k8s/base/secrets.yaml',
]);

const REQUIRED_OVERLAY_PATCHES = ['remove-placeholder-secrets.yaml'];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.ya?ml$/i.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return relative(ROOT, file).replace(/\\/g, '/');
}

const failures = [];

for (const dir of DEPLOYABLE_YAML_DIRS) {
  if (!existsSync(dir)) continue;

  for (const file of walk(dir)) {
    const rf = rel(file);
    if (NON_DEPLOYABLE_ALLOWLIST.has(rf)) continue;

    const body = readFileSync(file, 'utf8');

    if (/REPLACE_ME/.test(body)) {
      failures.push(`${rf}: contains REPLACE_ME placeholder value`);
    }

    const isSecretKind = /^kind:\s*Secret\s*$/m.test(body);
    const isDeletePatch = /^\$patch:\s*delete\s*$/m.test(body);
    if (isSecretKind && !isDeletePatch) {
      failures.push(`${rf}: deployable Secret manifest detected (ExternalSecret-only policy)`);
    }

    if (/api[_-]?key\s*:\s*["']?[A-Za-z0-9_\-]{16,}["']?/i.test(body) && !/valueFrom:\s*\n\s*secretKeyRef:/m.test(body)) {
      failures.push(`${rf}: potential static API key literal detected`);
    }
  }
}

for (const overlay of ['staging', 'production']) {
  const kustomization = resolve(K8S_ROOT, `overlays/${overlay}/kustomization.yaml`);
  const body = readFileSync(kustomization, 'utf8');

  for (const patch of REQUIRED_OVERLAY_PATCHES) {
    if (!body.includes(patch)) {
      failures.push(`infra/k8s/overlays/${overlay}/kustomization.yaml: missing required patch ${patch}`);
    }
  }

  if (!/external-secrets-.*-patch\.yaml/.test(body)) {
    failures.push(`infra/k8s/overlays/${overlay}/kustomization.yaml: missing ExternalSecret provider patch`);
  }

  const removePatch = resolve(K8S_ROOT, `overlays/${overlay}/remove-placeholder-secrets.yaml`);
  if (!existsSync(removePatch)) {
    failures.push(`infra/k8s/overlays/${overlay}/remove-placeholder-secrets.yaml: missing file`);
  } else {
    const removeBody = readFileSync(removePatch, 'utf8');
    if (!/^kind:\s*Secret\s*$/m.test(removeBody) || !/^\$patch:\s*delete\s*$/m.test(removeBody)) {
      failures.push(`infra/k8s/overlays/${overlay}/remove-placeholder-secrets.yaml: must delete Secret via $patch: delete`);
    }
  }
}

if (failures.length > 0) {
  console.error('❌ Kubernetes secrets hygiene check failed:');
  for (const issue of failures) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

console.log('✅ Kubernetes secrets hygiene check passed');
