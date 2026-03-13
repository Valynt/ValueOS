# Reliability Review Cadence

## Weekly: Operations Reliability Review

- **Participants:** SRE, platform engineering, operations leads, on-call representatives.
- **Agenda:**
  - Open incidents + unresolved follow-ups
  - Alert noise review and tuning decisions
  - Runbook freshness and drill outcomes
  - SLA/SLO at-risk services
- **Outputs:** prioritized reliability action list with owners and due dates.

## Monthly: Error-Budget Review

- **Participants:** engineering leadership + service owners.
- **Agenda:**
  - Error budget burn by critical service
  - Policy decision: continue feature velocity or reliability freeze
  - Countermeasure plan for over-budget services
- **Outputs:** approved service-level operating mode and remediation commitments.

## Quarterly: DR + Chaos Readiness Review

- **Participants:** SRE, security, infra, backend, product stakeholders.
- **Agenda:**
  - Disaster recovery drill outcomes vs RTO/RPO targets
  - Chaos experiment results and unresolved gaps
  - Cross-team dependency and communications readiness
- **Outputs:** signed quarterly resilience report + updated runbooks.

## Operating rule

Recurring reviews are mandatory governance checkpoints. Missed sessions must be rescheduled within five business days and logged in the operations tracker.
