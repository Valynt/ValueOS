---
title: Troubleshooting Runbook
authoritative: true
owner: team-sre
review_cadence: monthly
last_reviewed: 2026-02-13
tags: [runbook, operations, troubleshooting, ownership:team-sre, cadence:monthly]
source_reference: ../reference/troubleshooting-reference.generated.md
---

# Troubleshooting Runbook

## Purpose
Authoritative incident triage flow for production issues.

## Triage Sequence
1. Classify impact (sev, tenant blast radius, critical-path impact).
2. Validate auth and tenant context propagation.
3. Validate billing event flow and webhook health.
4. Validate workflow execution queue and step logs.
5. Decide mitigate/rollback/escalate.

## Exit Criteria
- Core SLOs recover to baseline.
- Backlog drains to normal operating range.
- Incident summary and follow-ups captured.

## Generated Reference
See command/reference appendix:
- [Troubleshooting Reference (Generated)](../reference/troubleshooting-reference.generated.md)
