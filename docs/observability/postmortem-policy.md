# Blameless Postmortem Policy

All Sev1 and Sev2 incidents require a blameless postmortem.

## Requirements

Each postmortem must include:

- Incident summary and customer impact
- Timeline (detection, response, mitigation, resolution)
- Contributing factors (technical + process)
- **Corrective actions** (fixes to eliminate current failure mode)
- **Preventive actions** (systemic improvements to reduce recurrence)
- Action owner for each task
- Due date for each task
- Verification criteria for completion (test, alert, drill, or metric)

## Due dates

- Sev1: postmortem published within **5 business days**.
- Sev2: postmortem published within **10 business days**.

## Blameless standards

- Do not attribute fault to individuals.
- Focus on system conditions, decision context, and guardrail gaps.
- Capture what worked well to reinforce resilient behavior.

## Verification criteria examples

- New alert with runbook and owner attached.
- Regression test proving the failure path is covered.
- Chaos/DR drill evidence showing successful recovery inside target RTO/RPO.
- SLO trend demonstrating sustained recovery for two consecutive review periods.
