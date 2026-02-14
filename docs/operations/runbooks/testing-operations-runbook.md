---
title: Testing Operations Runbook
authoritative: true
owner: team-quality
review_cadence: biweekly
last_reviewed: 2026-02-13
tags: [runbook, operations, testing, ownership:team-quality, cadence:biweekly]
source_reference: ../reference/testing-operations-reference.generated.md
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Testing Operations Runbook

## Purpose
Authoritative runbook for operational test execution before and after releases.

## Required Suites
- Lint + typecheck
- Unit/integration tests
- RLS/compliance suites
- Security scans required by CI policy

## Standard Execution Flow
1. Run CI-equivalent checks locally for risky changes.
2. Execute targeted suites for changed bounded contexts.
3. Record failures and remediation tickets.
4. Re-run critical-path smoke tests for auth, tenancy, billing, and workflow execution.

## Escalation
- Block release if critical-path smoke fails.
- Escalate to service owner and incident channel when regressions persist beyond one retry cycle.

## Generated Reference
Extended commands and tool-specific details are maintained in:
- [Testing Operations Reference (Generated)](../reference/testing-operations-reference.generated.md)
