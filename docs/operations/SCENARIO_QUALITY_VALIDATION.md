# Scenario & Quality Validation (Sprint Epic 3)

**Last Updated:** 2025-05-05

This playbook operationalizes Sprint Epic 3 by pairing always-on synthetic monitoring with a weekly feedback synthesis cadence. It is scoped to the beta/production environments and focuses on the core workflows of authentication, report creation, and export plus end-user feedback aggregation.

## Item 3.1: "Golden Path" Synthetic Monitors

### Scope
- Validate the login → report creation → export workflow in production/beta.
- Catch regressions in data visualization and API-backed export before users do.
- Target **99.9% availability** during business hours with alerting within **5 minutes** of failure.

### Monitor Implementation
- **Playwright script:** `scripts/synthetic-monitors/golden-path.spec.ts`
  - Uses label-based selectors for authentication (email, password, optional MFA) and flexible report/export triggers.
  - Asserts that a new report name renders post-save and that an export download occurs in the expected format.
  - Fires a PagerDuty trigger when the test fails (opt-in via `PAGERDUTY_ROUTING_KEY`).
- **Config:** `playwright.monitor.config.ts` pins Chromium, enables traces, and runs headless with a single worker for stability.
- **Env vars:**
  - `MONITOR_BASE_URL` (required): Production/Beta URL.
  - `MONITOR_EMAIL`, `MONITOR_PASSWORD` (required): Synthetic user credentials.
  - `MONITOR_OTP` (optional): OTP/MFA code when enforced.
  - `MONITOR_EXPORT_FORMAT` (optional, default `csv`): Used to validate the downloaded filename.
  - `PAGERDUTY_ROUTING_KEY` (optional but recommended): Routes incidents to PagerDuty.

### Scheduling & Alerting
- **GitHub Action:** `.github/workflows/golden-path-monitor.yml` runs every **15 minutes** and supports manual `workflow_dispatch`.
- **Runtime budget:** 10-minute workflow timeout to avoid queueing overlap.
- **Alert path:** On failure, the Playwright hook posts to PagerDuty Events v2 with a deterministic `dedup_key` (`valuecanvas-golden-path-...`).
- **Availability guardrail:** The scheduled job plus PD alerting meets the 5-minute alert window when GitHub Actions queue time is <1 minute.

### Local Smoke Test
```bash
# run against beta/prod
MONITOR_BASE_URL=https://beta.valuecanvas.example.com \ \
MONITOR_EMAIL=bot@example.com \ \
MONITOR_PASSWORD=***** \ \
npm run monitor:golden-path
```

### Acceptance Mapping
- **Availability 99.9%:** Achieved via 15-minute cadence + single-browser stability (no parallelism) and PD escalation on first failure.
- **Alerts within 5 minutes:** PD trigger fires immediately after a failed run; workflow completes well under 5 minutes in normal conditions.

## Item 3.2: Weekly Feedback Synthesis Pipeline

### Inputs & Aggregation View
- **Jira/Linear view:**
  - Filter for beta projects/labels and add custom fields for **RICE (Reach, Impact, Confidence, Effort)**.
  - Surface **Sentry issues**, **Support tickets**, and **In-app feedback** via linked issues or mirrored tickets.
  - Saved view: "Beta Feedback Funnel" with columns `Source`, `Severity`, `RICE Score`, `Owner`, `ETA`.
- **Data refresh:** Export Sentry issue summaries and Support ticket tags weekly (Sunday night) into the view to pre-hydrate Monday reporting.

### Weekly Report Template (auto-generated Monday 9am)
Use this as the canonical template for the "Beta Steering Committee" dashboard card.

```
# Weekly Beta Report — <YYYY-MM-DD>

## Adoption & Usage
- Active Users (WAU/MAU): <value>
- Feature Usage % (top workflows):
  - Login → Report Creation → Export: <value>
  - Data Viz Drill-down: <value>

## Quality & Stability
- Sentry Errors (new/regressions): <count>
- Export/API integration failures: <count>
- Uptime (business hours): <value> (target 99.9%)

## Experience
- CSAT Score: <value>
- Top 3 Friction Points:
  1. <item>
  2. <item>
  3. <item>

## Prioritization (RICE)
- Highest RICE items to tackle this week:
  - <issue> — RICE: <score>
  - <issue> — RICE: <score>
```

### Cadence & Ownership
- **Automation:** Dashboard refresh scheduled for **Monday 09:00** with data from the latest Sentry/support exports and feature usage counters.
- **Ownership:** PM owns triage and RICE scoring; Eng owns validation for export/API failures; Support owns CSAT tagging.
- **Output:** Dashboard card auto-updates; PDF/Slack summary can be generated from the template if stakeholders need push updates.

### Acceptance Mapping
- **Dashboard freshness:** Monday 09:00 refresh ensures the Steering Committee sees current metrics.
- **RICE fields present:** Custom fields added in Jira/Linear for all beta feedback issues, surfaced in the saved view.
