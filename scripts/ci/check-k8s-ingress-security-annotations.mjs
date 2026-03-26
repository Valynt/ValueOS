#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const K8S_OVERLAYS_ROOT = path.resolve(ROOT, 'infra/k8s/overlays');
const DEFAULT_OVERLAYS = ['staging', 'production'];
const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^REQUIRED_/i,
  /^CHANGEME$/i,
  /^REPLACE_ME$/i,
  /^TODO$/i,
  /^TBD$/i,
];

const cliOverlays = process.argv
  .filter((arg) => arg.startsWith('--overlays='))
  .flatMap((arg) => arg.split('=')[1]?.split(',') ?? [])
  .map((value) => value.trim())
  .filter(Boolean);

const overlays = cliOverlays.length > 0 ? cliOverlays : DEFAULT_OVERLAYS;
const failures = [];

const kustomizeProbe = spawnSync('kustomize', ['version'], { encoding: 'utf-8' });
if (kustomizeProbe.error) {
  console.error(`kustomize is required in PATH: ${kustomizeProbe.error.message}`);
  process.exit(1);
}


function isPlaceholder(value) {
  const normalized = String(value ?? '').trim();
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function parseIngressDocuments(yamlText) {
  const docs = yamlText
    .split(/^---\s*$/m)
    .map((doc) => doc.trim())
    .filter(Boolean);

  return docs
    .filter((doc) => /^kind:\s*Ingress\s*$/m.test(doc))
    .map((doc) => {
      const name = doc.match(/^\s*name:\s*([^\n]+)$/m)?.[1]?.trim() ?? '<unknown>';
      const scheme = doc.match(/^\s*alb\.ingress\.kubernetes\.io\/scheme:\s*['\"]?([^\n'\"]+)['\"]?$/m)?.[1]?.trim() ?? '';
      const certArn = doc.match(/^\s*alb\.ingress\.kubernetes\.io\/certificate-arn:\s*['\"]?([^\n'\"]+)['\"]?$/m)?.[1]?.trim() ?? '';
      const wafArn = doc.match(/^\s*alb\.ingress\.kubernetes\.io\/wafv2-acl-arn:\s*['\"]?([^\n'\"]+)['\"]?$/m)?.[1]?.trim() ?? '';
      return { name, scheme, certArn, wafArn };
    });
}

for (const overlay of overlays) {
  const overlayPath = path.resolve(K8S_OVERLAYS_ROOT, overlay);
  const build = spawnSync('kustomize', ['build', overlayPath], {
    cwd: ROOT,
    encoding: 'utf-8',
  });

  if (build.status !== 0) {
    failures.push(`kustomize build failed for ${overlay}: ${build.stderr || build.stdout}`.trim());
    continue;
  }

  const ingresses = parseIngressDocuments(build.stdout);
  if (ingresses.length === 0) {
    failures.push(`${overlay}: rendered manifest contains no Ingress resources.`);
    continue;
  }

  for (const ingress of ingresses) {
    if (!ingress.certArn || isPlaceholder(ingress.certArn)) {
      failures.push(
        `${overlay}/${ingress.name}: alb.ingress.kubernetes.io/certificate-arn must be non-empty and non-placeholder after render.`,
      );
    }

    const requiresWaf = overlay === 'production' && ingress.scheme === 'internet-facing';
    if (requiresWaf && (!ingress.wafArn || isPlaceholder(ingress.wafArn))) {
      failures.push(
        `${overlay}/${ingress.name}: internet-facing production ingress requires non-empty alb.ingress.kubernetes.io/wafv2-acl-arn.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Ingress security annotation policy failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Ingress security annotation policy passed for overlays: ${overlays.join(', ')}`);
