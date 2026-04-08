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
- **Readiness audit update:** downgrade the prior jsPDF item from **P0** to **Resolved / monitor-only** once dependency and lockfile snapshot checks pass.

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

## Readiness audit publishing guard (required)

Before publishing future readiness/security audits, verify the app manifest directly by parsing `apps/ValyntApp/package.json` and confirming `dependencies.jspdf` is `>=4.2.1`.

```bash
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('apps/ValyntApp/package.json','utf8'));const raw=(p?.dependencies?.jspdf||'').trim();const m=raw.match(/(\d+)\.(\d+)\.(\d+)/);if(!m){console.error('FAIL dependencies.jspdf missing/invalid:',raw);process.exit(1);}const [maj,min,pat]=m.slice(1).map(Number);const ok=maj>4||(maj===4&&(min>2||(min===2&&pat>=1)));if(!ok){console.error('FAIL dependencies.jspdf is below 4.2.1:',raw);process.exit(1);}console.log('PASS dependencies.jspdf satisfies >=4.2.1:',raw);"
```

## Generated finding evidence snapshot

When a finding is generated from dependency scans, attach a date-stamped evidence line that binds the finding to exact inputs.

- **Evidence (2026-04-08 UTC):** jsPDF finding validated against commit `b0ece37`; `pnpm-lock.yaml` sha256 `94425a155fc19a3d85245b661729befe9b82ef84a1fc632960e2ba729852e38e`; `apps/ValyntApp/package.json` sha256 `c3f1d995fed443a71bef3936f402e9c81764fbab189f6a1444668a4c28043673`.
