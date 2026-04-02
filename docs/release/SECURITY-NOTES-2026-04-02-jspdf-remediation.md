---
title: Security Notes — jsPDF CVE Remediation
date: 2026-04-02
status: completed
owner: team-frontend
---

# Security Notes — jsPDF CVE Remediation (2026-04-02)

## Summary

- Remediated vulnerable `jspdf@4.2.0` lockfile resolution in the workspace dependency graph.
- Enforced `jspdf` policy floor at `^4.2.1` via root `pnpm.overrides`.
- Added CI dependency policy gate to fail builds if `pnpm-lock.yaml` resolves `jspdf@4.2.0`.

## CVE / Risk Context

- **Affected package:** `jspdf`
- **Blocked version:** `4.2.0`
- **Remediated floor:** `4.2.1` (patch line)
- **Control objective:** Prevent reintroduction of known vulnerable lockfile resolution during dependency drift.

## Affected Product Surface

- **App:** `ValyntApp`
- **Runtime path(s):**
  - PDF export/generation path using jsPDF.
  - HTML-to-PDF rendering path where jsPDF optional HTML/canvas integrations are used.

## CI Policy Gate

The CI security lanes now run `node scripts/ci/check-jspdf-version-policy.mjs`, which fails when any lockfile entry contains `jspdf@4.2.0`.

This gate complements `pnpm audit` by enforcing a deterministic lockfile policy for a known vulnerable version.
