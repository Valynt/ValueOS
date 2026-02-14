# Accessibility Defect SLA and Remediation Metrics

## Objective

Track accessibility defect responsiveness and fix quality through shared observability dashboards, with explicit SLA targets and alerting.

## SLA Targets

| Severity | Definition | Target Acknowledge | Target Remediate |
|----------|------------|--------------------|------------------|
| P0 | Blocks critical workflow for AT users | 1 hour | 24 hours |
| P1 | Major degradation in Tier-1 workflow | 4 hours | 3 business days |
| P2 | Moderate issue with workaround | 1 business day | 10 business days |
| P3 | Minor usability issue | 3 business days | Next planned release |

## Required Dashboard Metrics

Publish and review these metrics in Grafana accessibility dashboards:

- `a11y_defects_open_total{severity,workflow}`
- `a11y_defects_breached_sla_total{severity}`
- `a11y_defect_acknowledge_time_hours_p50/p95`
- `a11y_defect_remediation_time_hours_p50/p95`
- `a11y_reopened_defects_total`
- `a11y_manual_at_pass_rate{scenario}`
- `a11y_localization_overflow_failures_total{workflow,locale}`

## Dashboard Panels

Minimum panels for the Accessibility Operations dashboard:

1. Open defects by severity and workflow.
2. SLA breach trend (7d/30d) with severity split.
3. MTTA/MTTR percentile trend (p50/p95).
4. Reopen rate trend by team.
5. Manual AT test pass rate (screen reader, keyboard-only, high-zoom).
6. Localization overflow failures across Tier-1 workflows.

## Alerting Rules

- Trigger page/urgent alert for any `P0` defect not acknowledged within 1 hour.
- Trigger warning alert for `P1` remediation nearing 80% of SLA window.
- Trigger daily digest if `a11y_defects_breached_sla_total` increases.
- Trigger quality alert if manual AT pass rate drops below 95% for two consecutive runs.

## Governance and Review

- **Daily**: On-call triage of new defects and SLA risk.
- **Weekly**: Accessibility metrics review with Engineering + Product + QA.
- **Monthly**: Trend analysis and preventative action planning.

## Remediation KPIs

Quarterly targets:

- SLA compliance >= 98% for P0/P1.
- Reopen rate <= 5%.
- Manual AT pass rate >= 97%.
- Localization overflow failure rate < 1% of visual regression checks.
