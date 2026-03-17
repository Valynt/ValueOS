# Audit Recommendations Roadmap

Tracking document for all 17 recommendations from the [comprehensive repo audit (March 2026)](comprehensive-repo-audit-2026-03.md).

**Status legend:** Done = implemented in this PR, Planned = documented with timeline, Deferred = requires external action.

---

## Immediate (0-30 days)

| #   | Recommendation                                         | Status | Evidence / Notes                                                                                                                                                 |
| --- | ------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Promote `no-explicit-any` to `error` in strict zones   | Done   | `eslint.config.js` `strictNoAnyOverrides` expanded to cover all agent-fabric agents, middleware, and runtime. `config/strict-zones.json` updated.                |
| 2   | Remove `--passWithNoTests` from frontend test commands | Done   | Removed from 8 `package.json` files (ValyntApp, VOSAcademy, components, design-system, infra, sdui, github-code-optimizer, domain-validator).                    |
| 3   | Archive unused Terraform ECS modules                   | Done   | `infra/terraform/modules/ecs/` and `ecs-service/` moved to `_archived/` with README. `main.tf` updated.                                                          |
| 4   | Verify `secrets.yaml` contains no plaintext secrets    | Done   | Confirmed: `infra/k8s/base/secrets.yaml` is a non-deployable `SecretTemplate` with `placeholderValue: REPLACE_ME`. No action needed.                             |
| 5   | Add ADR for messaging technology selection             | Done   | `docs/engineering/adr/0018-messaging-technology-selection.md` -- NATS JetStream canonical for agent messaging, BullMQ for jobs, KafkaJS for external connectors. |

## Near-term (1-3 months)

| #   | Recommendation                                  | Status  | Evidence / Notes                                                                                                                             |
| --- | ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Migration squash strategy                       | Done    | Documented in `docs/engineering/migration-guide.md` -- quarterly epoch baselines, `_consolidated/` archive, validation steps.                |
| 7   | Live-backend E2E CI lane                        | Deferred | CI workflow changes were local-only and not pushed (GitHub App token lacks `workflows` permission). Script is ready; requires a developer with workflow permissions to push `.github/workflows/ci.yml`. |
| 8   | Bundle size budget gate                         | Deferred | `scripts/ci/check-bundle-size.mjs` (2 MB budget) is committed. CI wiring in `.github/workflows/ci.yml` was local-only and not pushed — same blocker as #7.                                           |
| 9   | Begin `any` debt burn-down                      | Done     | Sprint-by-sprint burn-down plan added to `.ona/context/debt.md` (DEBT-ANY-BURNDOWN). Start with `packages/shared` and `packages/components`. |
| 10  | Lighthouse CI / Web Vitals monitoring           | Deferred | `@lhci/cli` step was added locally to `.github/workflows/ci.yml` but not pushed — same blocker as #7.                                                                                                 |
| 11  | Validate observability stack against production | Planned | See [Observability Validation Plan](#observability-validation-plan) below.                                                                   |

## Long-term (3-12 months)

| #   | Recommendation                        | Status  | Evidence / Notes                                                                                                             |
| --- | ------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 12  | Consolidate messaging infrastructure  | Planned | ADR-0018 establishes canonical choices. Deprecation of standalone Redis Streams / Kafka for internal messaging is next step. |
| 13  | Achieve `any` count < 100             | Planned | Sprint targets defined in `.ona/context/debt.md`. Target: <100 by Q4 2026.                                                   |
| 14  | Add diagrams-as-code                  | Done    | Mermaid architecture diagram added at `docs/architecture/system-overview.md`.                                                |
| 15  | Complete third-party penetration test | Planned | See [Penetration Test Execution Plan](#penetration-test-execution-plan) below.                                               |
| 16  | Reduce backend lint warning cap       | Done    | `--max-warnings` ratcheted from 2,704 to 2,600 in `packages/backend/package.json`. Decrease by 100 per sprint until 0.       |
| 17  | Expand i18n locale coverage           | Planned | See [i18n Expansion Plan](#i18n-expansion-plan) below.                                                                       |

---

## Observability Validation Plan

**Owner:** DevOps / SRE team
**Target:** Q2 2026

### Steps

1. **Grafana dashboard audit:** For each dashboard in `infra/observability/grafana/` and `infra/k8s/observability/grafana/`, verify:
   - All PromQL queries return data from production Prometheus.
   - Panel titles match the metrics they display.
   - No stale/orphaned dashboards exist.

2. **Alerting rule validation:** For each alert rule in `infra/k8s/observability/prometheus/`:
   - Trigger the alert in staging with synthetic load.
   - Verify the alert fires in the configured notification channel (PagerDuty/Slack).
   - Document the alert-to-runbook mapping in `docs/runbooks/alert-runbooks.md`.

3. **SLO burn-rate alerts:** Verify the SLOs documented in `infra/observability/SLOs.md`:
   - Confirm burn-rate alerts are configured for each SLO.
   - Run a 72-hour burn-rate simulation in staging.
   - Publish evidence in `docs/security-compliance/evidence-index.md`.

4. **Distributed tracing validation:**
   - Verify Tempo receives traces from the OTel Collector.
   - Confirm `trace_id` propagation across async boundaries (MessageBus, BullMQ).
   - Test trace search in Grafana Explore.

5. **Log aggregation validation:**
   - Verify Fluent Bit / Loki pipeline captures backend and worker logs.
   - Confirm log-level filtering and tenant-context enrichment.

### Evidence Artifacts

Publish results as a new section in `docs/security-compliance/observability-controls-and-evidence.md`.

---

## Penetration Test Execution Plan

**Owner:** Security team
**Target:** Q2-Q3 2026

### Scope

Per `docs/security-compliance/bug-bounty-cvd-program.md`, the pen test program is documented. The following steps execute it:

1. **Vendor selection:** Engage a CREST-certified pen test firm. Budget approval required from CTO.
2. **Scope definition:**
   - External: Public API endpoints (REST + WebSocket), authentication flows (JWT, MFA/WebAuthn), tenant isolation boundaries.
   - Internal: Agent-to-agent messaging (MessageBus), LLM gateway prompt injection vectors, Redis/BullMQ job injection.
   - Infrastructure: K8s cluster configuration, NATS JetStream ACLs, Postgres RLS bypass attempts.
3. **Pre-test preparation:**
   - Provision a dedicated staging environment with production-like data (anonymized).
   - Enable enhanced audit logging for the test window.
   - Brief the SRE team on expected traffic patterns.
4. **Test execution:** 2-week window with daily syncs.
5. **Remediation:** Fix critical/high findings within 30 days. Medium within 90 days.
6. **Evidence retention:** Store the pen test report in `docs/security-compliance/` (redacted for public repo). Reference in `docs/security-compliance/evidence-index.md`.

---

## i18n Expansion Plan

**Owner:** Frontend team
**Target:** Q3-Q4 2026

### Current State

- i18n infrastructure exists at `apps/ValyntApp/src/i18n/` with `I18nProvider.tsx`.
- CI checks: `extract-i18n-catalog.mjs`, `check-i18n-keys.mjs`, `check-pseudo-localization.mjs`.
- Expansion plan documented at `apps/ValyntApp/src/i18n/valyntapp-i18n-expansion-plan.md`.

### Target Locales

| Locale | Language            | Priority | Target Sprint |
| ------ | ------------------- | -------- | ------------- |
| `en`   | English (US)        | P0       | Shipped       |
| `es`   | Spanish (LATAM)     | P1       | S55-58        |
| `fr`   | French (France)     | P1       | S59-62        |
| `de`   | German              | P2       | S63-66        |
| `pt`   | Portuguese (Brazil) | P2       | S67-70        |

### Steps

1. **String externalization audit:** Run `extract-i18n-catalog.mjs` to identify all hardcoded strings. Target >95% externalization before adding new locales.
2. **Translation workflow:** Set up a translation management system (Crowdin or Lokalise) with GitHub integration for automated PR creation on translation updates.
3. **CI coverage gate:** Add a minimum i18n coverage threshold (95%) per locale to `check-i18n-keys.mjs`. Fail CI if coverage drops below threshold for shipped locales.
4. **RTL preparation:** While no RTL locales are in the initial plan, ensure the frontend layout supports RTL via `dir="auto"` on root elements and Tailwind RTL plugin.
5. **Locale-specific formatting:** Verify date, number, and currency formatting uses `Intl` APIs (not hardcoded formats) for all locales.

---

## Changelog

| Date       | Change                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-03-17 | Initial roadmap created from audit recommendations #1-17.                                                   |
| 2026-03-17 | Corrected #7, #8, #10 from Done → Deferred: CI workflow changes were local-only (missing workflows permission). |
