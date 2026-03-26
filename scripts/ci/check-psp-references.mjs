#!/usr/bin/env node
/**
 * check-psp-references.mjs
 *
 * Rejects any Kubernetes manifest that references the removed
 * PodSecurityPolicy API (policy/v1beta1 or policy/v1 kind:PodSecurityPolicy).
 *
 * PodSecurityPolicy was deprecated in k8s 1.21 and removed in 1.25.
 * Enforcement is now handled by:
 *   - Pod Security Admission labels on namespaces (infra/k8s/security/pod-security-admission.yaml)
 *   - Kyverno ClusterPolicies (infra/k8s/security/kyverno-policies.yaml)
 *
 * Exit 1 if any PSP reference is found outside the allowlist.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

// Files that are allowed to mention PSP (migration docs, this script, etc.)
const ALLOWLIST = new Set([
  'scripts/ci/check-psp-references.mjs',
  'docs/security-compliance/secret-rotation-log.md',
  // Migration docs — explain the removal, do not define PSP resources
  'infra/k8s/zero-trust/zero-trust-manifests.yaml',
  'infra/k8s/security/pod-security-admission.yaml',
]);

// Match actual Kubernetes resource definitions, not prose documentation.
// - kind: PodSecurityPolicy  — YAML resource definition
// - apiVersion: policy/v1beta1 — the removed API group
// - podsecuritypolicies — kubectl resource name (used in RBAC rules)
// Prose mentions of "PodSecurityPolicy" in docs/CI step names are intentional
// and are excluded by the ALLOWLIST below.
const PSP_PATTERNS = [
  /^kind:\s*PodSecurityPolicy\s*$/m,
  /^apiVersion:\s*policy\/v1beta1\s*$/m,
  /\bpodsecuritypolicies\b/i,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', '.pnpm-store', 'dist', 'build', 'coverage'].includes(entry)) continue;
    const full = resolve(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; } // skip broken symlinks
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(ya?ml|json|ts|js|mjs|sh|md)$/i.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const failures = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOWLIST.has(rel)) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const pattern of PSP_PATTERNS) {
    if (pattern.test(content)) {
      failures.push(`${rel}: contains PodSecurityPolicy reference (pattern: ${pattern})`);
      break;
    }
  }
}

if (failures.length > 0) {
  console.error('');
  console.error('PSP reference check FAILED:');
  console.error('PodSecurityPolicy was removed in Kubernetes 1.25.');
  console.error('Use Pod Security Admission labels + Kyverno policies instead.');
  console.error('See: infra/k8s/security/pod-security-admission.yaml');
  console.error('     infra/k8s/security/kyverno-policies.yaml');
  console.error('');
  for (const f of failures) {
    console.error('  ✗ ' + f);
  }
  process.exit(1);
}

console.log(`PSP reference check: PASS (${walk(ROOT).length} files scanned, 0 violations)`);
