#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const REQUIRED_LABELS = ['app.kubernetes.io/name', 'app.kubernetes.io/component', 'app.kubernetes.io/part-of'];
const files = execSync("rg --files infra/k8s -g '*.yaml' -g '*.yml'", { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);

const EXEMPT_PATH_PREFIXES = [
  'infra/k8s/observability/',
  'infra/k8s/zero-trust/',
  'infra/k8s/messaging/',
  'infra/k8s/monitoring/',
  'infra/k8s/security/',
];


function parseDocs(content) {
  return content
    .split(/^---\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean);
}

function extract(block, regex) {
  const m = block.match(regex);
  return m ? m[1] : null;
}

function hasAny(block, patterns) {
  return patterns.some((pattern) => pattern.test(block));
}

const failures = [];

let skipped = 0;
for (const file of files) {
  if (file.includes('/overlays/')) continue; // kustomize patches intentionally partial
  if (EXEMPT_PATH_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    skipped += 1;
    continue;
  }
  const raw = readFileSync(file, 'utf8');
  const docs = parseDocs(raw);

  for (const doc of docs) {
    const kind = extract(doc, /^kind:\s*(.+)$/m);
    if (!kind || !['Deployment', 'StatefulSet'].includes(kind)) continue;

    const name = extract(doc, /^metadata:\n(?:[ \t].*\n)*?[ \t]+name:\s*(.+)$/m) ?? 'unknown';
    const id = `${file} [${kind}/${name}]`;

    const labelSectionMatches = doc.match(/labels:\n([\s\S]*?)(?:\n\S|$)/g) ?? [];
    const labelsText = labelSectionMatches.join('\n');
    for (const label of REQUIRED_LABELS) {
      if (!new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`).test(labelsText)) {
        failures.push(`${id} missing required label: ${label}`);
      }
    }

    if (!/template:\n[\s\S]*?spec:\n[\s\S]*?securityContext:\n/m.test(doc) && !/containers:\n[\s\S]*?securityContext:\n/m.test(doc)) {
      failures.push(`${id} missing workload securityContext (pod-level or container-level).`);
    }

    if (!/containers:\n/m.test(doc)) continue;

    const hasLiveness = /livenessProbe:\n/m.test(doc);
    const hasReadiness = /readinessProbe:\n/m.test(doc);
    if (!hasLiveness || !hasReadiness) {
      failures.push(`${id} missing required probes (needs both livenessProbe and readinessProbe).`);
    }

    if (!hasAny(doc, [/autoscaling\.valynt\.io\/policy\s*:/, /replicas:\s*\d+/])) {
      failures.push(`${id} missing autoscaling policy (set autoscaling.valynt.io/policy or explicit replicas).`);
    }
  }
}

if (failures.length > 0) {
  console.error('❌ Kubernetes architecture conformance failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`✅ Kubernetes architecture conformance passed (${skipped} exempt files skipped).`);
