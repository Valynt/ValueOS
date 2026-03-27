# UX Quality Scorecard

This document turns CI-only UX quality artifacts into a durable release scorecard for ValyntApp. Use it as the stable dashboard for accessibility, localization, and route performance decisions that need to be visible across releases rather than buried in per-run CI artifacts.

## Source of truth and update cadence

### Inputs promoted from CI

| Signal | CI artifact | Stable scorecard use |
| --- | --- | --- |
| WCAG 2.2 AA route audits | `artifacts/accessibility/a11y-metrics.json` | Track route-level pass rate, keyboard coverage, and regression deltas by journey. |
| WCAG 2.2 AA severity budgets | `artifacts/accessibility/wcag-severity-metrics.json` | Confirm `critical=0` and `serious=0` for release-critical journeys. |
| WCAG 2.2 AA accessibility trend summary | `artifacts/accessibility/a11y-trend-summary.md` | Capture week-over-week and release-over-release drift in a11y quality. |
| Locale completeness | `artifacts/i18n/coverage-dashboard.json` | Track untranslated-string debt by locale and route owner. |
| Release localization coverage | `artifacts/i18n/release-coverage-dashboard.json` | Validate launch locales meet release thresholds. |
| Pseudo-localization integrity (`en-XA` QA only) | `artifacts/i18n/pseudo-localization-report.json` | Detect overflow, token corruption, and truncation risk before release without implying an additional shipped locale. |
| Aggregated frontend scorecard | `artifacts/frontend-quality/dashboard.json` and `dashboard.md` | Copy the release summary into this document's review log. |
| Top-tier journey gate (blocking) | `artifacts/frontend-quality/top-tier-journey-gate.json` | Enforce route-level accessibility severity and journey-scoped locale completeness thresholds. |
| Release-over-release regression dashboard | `artifacts/frontend-quality/regression-dashboard.json` and `regression-dashboard.md` | Compare the current release against `.github/metrics/ux-release-baselines.json` for accessibility, localization, and route performance drift. |

### Operating cadence

- **Per PR:** review the CI artifacts and update owners when a journey regresses.
- **Weekly:** refresh the route health summary for the top journeys below.
- **Before production release:** add the current release's summary to the review log in this document and link the CI run used for sign-off.

## ValyntApp top user journeys

The journeys below are derived from the lazy-loaded route entry points in `apps/ValyntApp/src/AppRoutes.tsx`. Accessibility expectations map to the repository-wide **WCAG 2.2 AA** CI target, and localization expectations map to the currently shipped locale set of **English (`en`) and Spanish (`es`)** only. They are the routes that must stay visible in UX quality reporting because they are either entry points, core value-delivery flows, or release-critical operational surfaces.

| Journey | Route pattern(s) in `AppRoutes.tsx` | Lazy entry points | Why it is top-tier |
| --- | --- | --- | --- |
| Auth and tenant entry | `/login`, `/signup`, `/reset-password`, `/create-org`, `/onboarding` | `ModernLoginPage`, `ModernSignupPage`, `ResetPasswordPage`, `CreateOrganization`, `CompanyOnboarding` | Every user starts here; failures block all downstream workflows. |
| Dashboard landing | `/org/:tenantSlug/dashboard` | `MainLayout`, `Dashboard` | Primary post-login landing and release smoke-test route. |
| Opportunity discovery | `/org/:tenantSlug/opportunities`, `/org/:tenantSlug/opportunities/:id` | `MainLayout`, `Opportunities`, `OpportunityDetail` | Core browse-and-open flow that precedes case creation. |
| Value case authoring | `/org/:tenantSlug/opportunities/:oppId/cases/:caseId`, `/org/:tenantSlug/workspace/:caseId` | `MainLayout`, `ValueCaseCanvas`, `ValueCaseWorkspace` | Highest-value workflow for creating and refining value cases. |
| Workspace execution stages | `/workspace/:caseId/assembly`, `/model`, `/integrity`, `/outputs`, `/realization` | `DealAssemblyWorkspace`, `ValueModelWorkbench`, `IntegrityDashboard`, `ExecutiveOutputStudio`, `RealizationTracker` | Deep-link workflow stages where most expert users spend time. |
| Admin, settings, and billing | `/settings`, `/integrations`, `/billing`, `/company` | `SettingsPage`, `Integrations`, `BillingPortal`, `CompanyKnowledge` | Operational workflows with compliance, billing, and configuration risk. |

## Journey coverage expectations and ownership

Use this matrix to decide whether a release is healthy enough to ship. If any row is red, the named owner is responsible for triage, issue creation, and dashboard commentary before the release is approved.

| Journey | Primary route/component scope | Accessibility expectation | i18n expectation | Accessibility owner | Untranslated-string debt owner | Escalation |
| --- | --- | --- | --- | --- | --- | --- |
| Auth and tenant entry | `views/Auth/*`, `views/CreateOrganization.tsx`, `views/CompanyOnboarding.tsx` | Keyboard-only completion for login, signup, password reset, org creation, and onboarding. Labels, errors, and status messages must be announced to screen readers. No critical or serious axe violations. | `en` and `es` must be 100% complete for all auth strings. Pseudo-localization (`en-XA`, QA-only) must show no clipping on mobile or desktop for forms and inline validation. | `@team/frontend` | `@team/frontend` | `@team/owners` if unresolved across one release |
| Dashboard landing | `layouts/MainLayout.tsx`, `views/Dashboard.tsx` | Landmarks, nav focus order, page heading, and widget summaries must work with keyboard and screen readers. Dashboard cards need visible focus and color-independent status. | Hero metrics, nav labels, and empty states must use translation keys only. `en`/`es` completeness target is 100%; expansion candidates must not be represented as shipped locales until runtime support lands, but pseudo-loc smoke runs should still stay above 95% expansion-readiness. | `@team/frontend` | `@team/frontend` | `@team/owners` |
| Opportunity discovery | `views/Opportunities.tsx`, `views/OpportunityDetail.tsx` | Search/filter controls, tables/cards, and detail panels must support keyboard traversal, filter announcements, and meaningful headings. No serious violations on list or detail states. | Opportunity list, filters, statuses, and detail metadata must be localized for `en` and `es`. No hard-coded status chips or CTA labels. Pseudo-loc must preserve table overflow handling. | `@team/frontend` | `@team/frontend` | `@team/owners` |
| Value case authoring | `views/ValueCaseCanvas.tsx`, `views/ValueCaseWorkspace.tsx` | Core authoring flow must be navigable without a mouse, with focus restoration after dialogs/drawers and accessible names for canvas-stage controls. Manual AT spot-check required each release because this route is highly interactive. | All authored UI chrome, stage labels, helper text, and workflow CTAs must be localized for `en` and `es`. Generated model content may remain source-language, but surrounding controls cannot. Pseudo-loc must cover drawer, modal, and panel layouts. | `@team/frontend` | `@team/frontend` for UI copy; `@team/agents` for generated-content localization backlog commentary | `@team/owners` |
| Workspace execution stages | `views/DealAssemblyWorkspace.tsx`, `ValueModelWorkbench.tsx`, `IntegrityDashboard.tsx`, `ExecutiveOutputStudio.tsx`, `RealizationTracker.tsx` | Each deep-link stage must preserve heading hierarchy, tab/step semantics, loading announcements, and no trap-focus regressions. Integrity and output review states require screen-reader-readable status badges. | Stage-specific copy, statuses, and controls must be localized for `en`/`es`. Longer strings in pseudo-loc (`en-XA`) must not collapse sidebars, tabs, or KPI cards. | `@team/frontend` | `@team/frontend` | `@team/owners` plus release captain when blocked |
| Admin, settings, and billing | `views/SettingsPage.tsx`, `views/Integrations.tsx`, `views/BillingPortal.tsx`, `views/CompanyKnowledge.tsx` | Forms, toggles, and billing summaries must expose labels, descriptions, errors, and help text to assistive tech. No serious violations on billing/payment entry or settings save flows. | Settings labels, billing plan descriptions, integration states, and company profile forms must be localized for `en` and `es`. New strings must not ship without translation keys. | `@team/frontend` | `@team/frontend` | `@team/billing` for billing-specific blocking debt; otherwise `@team/owners` |

## Performance budgets for lazy-loaded route entry points

These budgets use the current lazy-loaded route chunks from the ValyntApp production build as the baseline. They are meant to keep route-level regressions visible over time while the shared vendor chunk is actively reduced.

### Current measured baseline

Build command used for the baseline:

```bash
VITE_BUDGET_MAX_CHUNK_KB=9999 VITE_BUDGET_MAX_INITIAL_JS_KB=99999 pnpm --filter valynt-app exec vite build --minify esbuild
```

Observed lazy-route chunk baselines from the build output:

| Journey | Baseline route chunks (raw / gzip) | Budget for next release | Page-load budget |
| --- | --- | --- | --- |
| Auth and tenant entry | `ModernLoginPage` `8.90 / 3.24 KB`, `ModernSignupPage` `9.11 / 2.98 KB`, `ResetPasswordPage` `3.32 / 1.37 KB`, `CreateOrganization` `4.36 / 1.92 KB`, `CompanyOnboarding` `47.70 / 10.57 KB` | No auth route chunk grows by more than 20% release-over-release. `CompanyOnboarding` stays under `60 KB` raw unless an approved exception is recorded here. | p75 route load under `1.8s` on release smoke environment; no blocking layout shift on pseudo-loc forms. |
| Dashboard landing | `MainLayout` `23.92 / 7.26 KB` + `Dashboard` `7.71 / 2.11 KB` | Combined dashboard-specific lazy JS stays under `40 KB` raw and `12 KB` gzip. | p75 route load under `1.5s`; first heading and primary nav usable by keyboard as soon as the loading spinner clears. |
| Opportunity discovery | `Opportunities` `15.97 / 4.35 KB`, `OpportunityDetail` `13.66 / 3.97 KB` | Opportunity list/detail chunks stay under `35 KB` raw each and under `60 KB` raw combined with `MainLayout`. | p75 route load under `2.0s`; filters interactive within `1.0s` after route shell paint. |
| Value case authoring | `ValueCaseCanvas` `72.30 / 14.95 KB`, `ValueCaseWorkspace` `21.88 / 6.64 KB` | `ValueCaseCanvas` stays under `90 KB` raw and `18 KB` gzip; workspace shell stays under `30 KB` raw. Any increase over 15% needs release-note commentary. | p75 route load under `2.5s`; first actionable control available within `1.2s` after shell render. |
| Workspace execution stages | `DealAssemblyWorkspace` `4.71 / 1.79 KB`, `ValueModelWorkbench` `5.01 / 1.53 KB`, `IntegrityDashboard` `4.85 / 1.64 KB`, `ExecutiveOutputStudio` `9.39 / 3.33 KB`, `RealizationTracker` `5.06 / 1.38 KB` | No individual stage chunk exceeds `15 KB` raw. Combined deep-link stage additions stay under `35 KB` raw beyond the workspace shell. | p75 deep-link transition under `1.8s`; intra-stage navigation should feel instant after initial load. |
| Admin, settings, and billing | `SettingsPage` `12.36 / 3.24 KB`, `Integrations` `4.33 / 1.58 KB`, `BillingPortal` `8.06 / 2.30 KB`, `CompanyKnowledge` `9.85 / 2.39 KB` | No admin route chunk exceeds `20 KB` raw. Combined admin operational surfaces stay under `45 KB` raw. | p75 page load under `1.8s`; save/submit interactions should not trigger full-page reflow. |

### Shared-shell guardrails

The build also shows a shared `vendor` chunk at `821.94 KB` raw (`239.83 KB` gzip), which is already above the Vite performance-budget plugin's `400 KB` chunk ceiling. Until that is reduced, release reviews must treat route-level budgets and the shared-shell trend as separate controls:

- route chunks **must not regress silently**, even if the shared vendor issue is still open;
- the shared `vendor` chunk trend must be reviewed at every production release;
- a release exception is required if the shared chunk grows by more than 5% from the last approved baseline.

### Exception workflow for performance guardrails (required)

When any route chunk or the shared vendor trend exceeds budget, the release owner must either fix the regression or add an explicit temporary exception in `.github/metrics/ux-performance-exceptions.json`:

1. Add an exception object with a unique `id`, `guardrailKeys`, `reason`, `approvedBy`, and `expiresOn`.
2. Keep the scope narrow (only the specific guardrail key, e.g., `vendor-trend` or `route-chunk:ValueCaseCanvas`).
3. Reference the mitigation issue/ticket in `reason`.
4. Remove the exception in the first release where metrics are back inside budget.

## Scorecard review log

Record the latest approved release or weekly checkpoint here.

| Date | Release / CI run + artifact links | Accessibility trend summary | Localization trend summary | Performance trend summary | Reviewer |
| --- | --- | --- | --- | --- | --- |
| 2026-03-27 | [PR Fast run](https://github.com/valueos/valueos/actions/runs/REPLACE_WITH_RUN_ID) · `accessibility-audit` artifacts (`artifacts/accessibility/`, `artifacts/i18n/`, `artifacts/frontend-quality/regression-dashboard.md`) · `performance-smoke` artifact (`artifacts/performance/route-load-metrics.json`) | Top-tier journey gate passed (`critical=0`, `serious=0`) for auth, dashboard, and settings routes. | `en`/`es` journey-scoped completeness met threshold for release-critical UI surfaces. | Route-load budgets and route chunk budgets enforced in CI; vendor growth requires an approved exception when above 5% baseline. | Engineering |

## Release-readiness rule

Production release sign-off is blocked until reviewers have completed all of the following:

1. Reviewed the latest accessibility trend summary and confirmed no unassigned regression exists on a top journey.
2. Reviewed the latest localization coverage for shipped locales (`en`, `es`) and the pseudo-localization trend summary for QA-only expansion checks.
3. Confirmed every open regression or untranslated-string debt item is assigned to the owner named in this document.
4. Recorded either a green status or an explicit exception with mitigation in the review log above.
5. Updated the latest review-log row with artifact links from the promotion candidate CI run (accessibility, i18n, and frontend-quality regression dashboard artifacts).
