---
title: Testing Operations Reference (Generated)
owner: team-quality
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Testing Operations Reference (Generated)

> Generated reference companion for the testing operations runbook.
> Canonical procedure lives in `../runbooks/testing-operations-runbook.md`.

## Source
- Consolidated source document: `../testing-operations.md`

## Notes
This file is intended for generated command matrices and framework-specific appendices.

## Readiness Report Test Inventory Snapshot

Generate category counts directly from repository paths (no manual estimation):

```bash
node scripts/qa/count-test-files-by-category.mjs
```

Every readiness report must include the script output sections below:

1. `scanTimestamp` (exact scan time in ISO-8601 UTC)
2. `classificationRules` (exact deterministic path rules used)
3. `countsByCategory` (raw counts for `api`, `component`, `e2e`, `security`, `integration`, and `uncategorized`)

Use the emitted JSON as the source of truth and include the markdown table in human-readable report sections.
