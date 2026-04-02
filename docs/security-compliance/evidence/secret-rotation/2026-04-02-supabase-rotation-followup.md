# Supabase Secret Rotation Follow-Up Evidence (2026-04-02)

- **Prepared on (UTC):** 2026-04-02T11:40:00Z
- **Prepared by:** Security automation agent (handoff to human operator required for dashboard/API rotation)
- **Scope:** Historical Supabase key exposures for projects `wfhdrrpijqygytvoaafc` and `bxaiabnqalurloblfwua`.

## Tracking tickets

- `SEC-2026-1184` — Rotate compromised Supabase API keys and publish post-rotation evidence bundle.
- `PLAT-2026-447` — Propagate rotated `SUPABASE_*` secrets to GitHub environments + runtime secret stores.

## Operator log references

- CI policy update runbook evidence: `scripts/ci/check-secret-rotation-evidence.mjs`.
- Secret-rotation verification workflow: `.github/workflows/secret-rotation-verification.yml`.
- Full-history scan workflow evidence lane: `.github/workflows/secret-scan.yml` and `.github/workflows/main-verify.yml`.

## Verified timestamps (UTC)

- 2026-04-02T11:25:31Z — Confirmed secret-rotation log still lists both incidents as open critical.
- 2026-04-02T11:31:44Z — Added release/deploy gate requiring evidence fields for open critical incidents.
- 2026-04-02T11:36:08Z — Updated full-history gitleaks workflows to emit/retain SARIF + JSON + log artifacts.

## Remaining manual actions (human operator)

1. Rotate keys in Supabase dashboard for both projects.
2. Update GitHub environment secrets (`staging`, `production`) and runtime secret backends with newly rotated `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` values.
3. Attach rotation dashboard screenshots and provider audit logs to ticket `SEC-2026-1184`.
