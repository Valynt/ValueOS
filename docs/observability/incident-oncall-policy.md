---
title: Incident Severity, Paging, and Communications Policy
owner: team-platform
backstage_owner: team:platform-engineering
backstage_system: value-engineering-platform
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Incident Severity, Paging, and Communications Policy

## 1) Incident severity model

| Severity | Customer impact | Target engagement | Escalation trigger |
|---|---|---|---|
| Sev1 | Widespread outage, security incident, or data integrity risk with active customer impact | Incident Commander + primary on-call paged immediately | Any production outage with no viable workaround > 5 min |
| Sev2 | Major feature degradation, high error rate, or partial outage | Primary on-call paged immediately, backup owner within 10 min | SLO breach forecast within current error-budget window |
| Sev3 | Limited feature issue or internal-impact degradation | Ticket + Slack alert during business hours; page optional | Repeated alerts over 24h or operational risk increase |
| Sev4 | Minor issue, no immediate customer impact | Backlog triage | N/A |

## 2) Paging policy

- **Primary channel:** PagerDuty service `valueos-primary`.
- **Escalation chain:** Primary on-call (0 min) → backup owner (10 min) → incident commander + engineering manager (20 min) → exec duty officer (30 min for unresolved Sev1).
- **Acknowledge SLA:**
  - Sev1: 5 minutes
  - Sev2: 10 minutes
  - Sev3: 4 business hours
- **Hand-off requirement:** unresolved Sev1/Sev2 must include current hypothesis, mitigations attempted, and next action owner before shift hand-off.

## 3) Communication templates

### Initial incident declaration (Slack `#incident-response`)

```text
[SEV{N}] <short title>
Impact: <customer/system impact>
Start time: <UTC timestamp>
Commander: <name>
Comms lead: <name>
Status page: <link>
Next update: <UTC + 15 min for Sev1/2>
```

### Update template

```text
[SEV{N}] Update <#>
What changed: <new evidence>
Current mitigation: <action underway>
Customer impact: <improving/stable/worsening>
ETA/next checkpoint: <timestamp>
```

### Resolution template

```text
[SEV{N}] Resolved
Resolved at: <UTC timestamp>
Root cause (initial): <summary>
Corrective actions: <ticket links>
Postmortem due: <date>
```

## 4) Enforcement via on-call procedures

On-call responders must follow these mandatory procedures for Sev1/Sev2:

1. Declare severity and open incident channel within 5 minutes.
2. Assign incident commander and communications lead roles explicitly.
3. Post updates every 15 minutes (Sev1) or 30 minutes (Sev2).
4. Attach dashboard screenshot/query links and runbook references used.
5. Record timeline in the incident ticket before closure.

Failure to complete the checklist is treated as an on-call process defect and reviewed in the weekly ops review.
