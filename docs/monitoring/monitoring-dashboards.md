# Monitoring Dashboards

**Last Updated:** December 5, 2025  
**Version:** 1.0.0

This document consolidates the previous dashboard docs:

- `LLM_MONITORING_DASHBOARD.md`
- `SUCCESS_DASHBOARD.md`
- `SECURITY_DASHBOARD.md`

It provides a unified view of:

- LLM usage, cost, and performance monitoring
- Overall project success / health metrics
- Security posture and remediation status

(Underlying SQL examples live in `monitoring-queries.md`.)

---

## 1. LLM Monitoring

Key dashboard panels:

- **Cost:** hourly, daily, monthly, by model, by user
- **Performance:** latency percentiles (P50/P95/P99), success rate, requests/minute
- **Usage analytics:** by endpoint, provider, tokens, rate limit violations
- **Backups:** backup success rate, last successful backup age

See `monitoring-queries.md` for the concrete SQL used in these panels.

Recommended critical alerts:

- Hourly cost > `$10` (warning) / `> $50` (critical)
- Success rate < `95%`
- P95 latency > `30s`
- Backup success rate < `95%`
- Last successful backup > `25h` ago

---

## 2. Success / Delivery Dashboard

High‑level project health metrics:

- EPIC and task completion (target 100%)
- Code quality (coverage, lint, duplication, complexity)
- Security posture (vuln counts, scores)
- Performance SLOs (agent response P95, SDUI render P95, cache hit rate)
- Documentation coverage and readiness gates (tests, staging, rollback, monitoring)

Typical tiles:

- **EPIC progress:** per‑epic completion percentages
- **Velocity:** tasks completed per sprint / week
- **Burndown:** planned vs completed tasks
- **Code quality:** TypeScript errors, coverage, lint warnings, bundle size
- **Deployment gates:** checklist with pass/fail status

This dashboard is descriptive; no additional SQL is required beyond the existing engineering metrics and CI/CD data sources.

---

## 3. Security Dashboard

Security posture overview:

- Vulnerability counts (critical/high/medium/low) and trend
- Top vulnerable packages and remediation commands
- Security tools status (Dependabot, CodeQL, Trivy, audits)
- Security metrics (security score, scan recency, last update)
- Compliance status vs standards (GDPR, SOC 2, NIST, etc.)
- Security schedule (daily/weekly/monthly/quarterly checks)
- Contacts and escalation paths

Use this panel set to answer:

- "Are we currently safe enough to deploy?"
- "What remediation is in progress or outstanding?"
- "Are scheduled scans and audits actually running?"

---

## 4. Recommended Layout

Suggested Grafana (or similar) layout:

1. **Top row (red/green at a glance):**
   - LLM hourly cost + trend
   - LLM success rate (last hour)
   - Security score / vuln summary
   - SDUI render P95 / Agent response P95

2. **Cost & usage row:**
   - Cost by model / provider (last 24h)
   - Top cost users
   - Requests per minute
   - Token usage stats

3. **Reliability & errors row:**
   - Error rate by hour
   - Top error patterns
   - Rate limit violations by tier / endpoint

4. **Security & compliance row:**
   - Vulnerability counts by severity
   - Last security scan / last dependency update
   - Compliance status tiles (GDPR, SOC 2, etc.)

5. **Business / success row:**
   - EPIC completion / tasks burndown
   - Velocity per sprint
   - Deployment readiness check

---

## 5. Alerting Strategy

Configure alerts on top of the panels using thresholds from the LLM and security docs:

- **LLM cost / performance:** thresholds from LLM monitoring section.
- **Security:** critical vuln count > 0, last scan > N days, dependency age.
- **Reliability:** workflow completion rate, error rate, stale sessions.
- **Backups:** success rate and last‑backup age.

All underlying alert SQL examples live in `monitoring-queries.md`.

---

## 6. References

- `monitoring-queries.md` – concrete SQL
- `OBSERVABILITY.md` / observability sections in `TECHNICAL_REFERENCE.md`
- Security docs in `security/` (LLM security, RLS, data protection)
