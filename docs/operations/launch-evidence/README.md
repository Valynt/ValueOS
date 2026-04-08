# Launch Evidence

This directory collects the artifacts required to sign off on a production release.
Each subdirectory corresponds to a release version (e.g. `release-1.0/`).

See `docs/operations/release-scope-ga-signoff.md` for the full GA sign-off checklist.

See `gate-control-matrix.md` for gate ownership, CI mapping, pass thresholds, artifact conventions, and waiver policy.

---

## Required artifacts per release

| Artifact | File | Owner |
|---|---|---|
| Security checklist sign-off | `release-X.Y/security-checklist.md` | @team/security |
| Load test results | `release-X.Y/load-test-results.md` | @team/operations |
| RLS policy test report | `release-X.Y/rls-test-report.txt` | @team/backend |
| Agent security suite report | `release-X.Y/agent-security-report.txt` | @team/backend |
| DR drill log entry | `docs/operations/dr-drill-log.md` | @team/operations |
| Skip waiver review | `config/release-risk/release-X.Y-skip-waivers.json` | @team/qa |
| Accessibility report | `release-X.Y/a11y-report.html` | @team/frontend |

---

## Generating reports

```bash
# RLS policy tests
pnpm run test:rls 2>&1 | tee docs/operations/launch-evidence/release-1.0/rls-test-report.txt

# Agent security suite
bash scripts/test-agent-security.sh 2>&1 | tee docs/operations/launch-evidence/release-1.0/agent-security-report.txt

# Load test (against staging)
k6 run infra/load-tests/baseline.js \
  -e BASE_URL=https://staging.valueos.app \
  -e API_TOKEN=$STAGING_API_TOKEN \
  --out json=docs/operations/launch-evidence/release-1.0/load-test-results.json
```

---

## Directory structure

```
launch-evidence/
  README.md          ← this file
  release-1.0/       ← created when release-1.0 evidence is collected
    security-checklist.md
    load-test-results.md
    rls-test-report.txt
    agent-security-report.txt
    a11y-report.html
```
