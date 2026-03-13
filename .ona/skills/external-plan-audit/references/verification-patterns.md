# Verification Patterns

Grep commands and file checks for each common claim category. Run these
before classifying a claim. Re-measure counts — never trust the document's
figures.

---

## Sprint plan discovery

Run this before writing any new sprint plan. Avoids duplicating work already
planned or re-opening sprints that are complete.

```bash
# List all existing sprint plans
ls docs/sprint-plan-*.md

# Check the most recent plan for its sprint range and completion status
head -20 $(ls -t docs/sprint-plan-*.md | head -1)

# Check sprint-roadmap for current sprint number
grep -n "Sprint\|current\|complete\|in.progress" sprint-roadmap.md | head -20

# Check todo.md for in-progress sprint work
cat todo.md
```

Before writing Sprint N, confirm:
1. Sprint N-1 deliverables are in main (check with `git log --oneline` for the
   relevant files named in the prior plan's acceptance criteria).
2. No open PR targets the same sprint work (`gh pr list` or check GitHub).
3. The prior plan's test gate passed: `pnpm test` and `pnpm run test:rls`.

---

## Resolved debt

Check the `debt.md` Resolved section before doing anything else. If the
claim matches a resolved item, classify immediately as "Already resolved."

```bash
# List all resolved items (grep the Resolved section directly)
awk '/^## Resolved debt/,/^## [^R]/' .ona/context/debt.md | grep "^|"

# Check if a specific debt ID is resolved
grep -n "DEBT-007\|QUAL-003\|SEC-02" .ona/context/debt.md
```

---

## TypeScript `any` counts

The document's baseline is almost always stale. Re-measure before scheduling.

```bash
# Backend production files only (exclude tests)
grep -rE ":[[:space:]]*any\b|as[[:space:]]+any\b|<any>" \
  packages/backend/src --include="*.ts" \
  | grep -vE "__tests__|\.test\.|\.spec\." | wc -l

# ValyntApp production files only
grep -rE ":[[:space:]]*any\b|as[[:space:]]+any\b|<any>" \
  apps/ValyntApp/src --include="*.ts" --include="*.tsx" \
  | grep -vE "__tests__|\.test\.|\.spec\." | wc -l

# Highest-density files (top 10)
grep -rE ":[[:space:]]*any\b|as[[:space:]]+any\b|<any>" \
  packages/backend/src --include="*.ts" \
  | grep -vE "__tests__|\.test\.|\.spec\." \
  | sed 's/:.*//' | sort | uniq -c | sort -rn | head -10
```

---

## Migration rollback coverage

```bash
# Total migration files
find infra/supabase/supabase/migrations -name "*.sql" | grep -v rollback | wc -l

# Total rollback files
find infra/supabase/supabase/migrations -name "*.rollback.sql" | wc -l

# Migrations without a paired rollback
for f in infra/supabase/supabase/migrations/*.sql; do
  base="${f%.sql}"
  [ ! -f "${base}.rollback.sql" ] && echo "$f"
done | grep -v rollback
```

---

## OpenAPI coverage

```bash
# Count documented paths
grep -c "^  /" packages/backend/openapi.yaml

# List all documented paths
grep "^  /" packages/backend/openapi.yaml

# Count mounted API routes in server.ts (to compare coverage)
grep "app\.use\|router\.use" packages/backend/src/server.ts | grep "/api"
```

---

## MFA enforcement

```bash
# Confirm MFA startup check exists
grep -n "MFA_ENABLED\|mfaEnabled\|MFA_PRODUCTION_OVERRIDE" \
  packages/backend/src/server.ts
```

If lines are returned with a `warn` or `throw` on missing MFA, the claim is
already resolved.

---

## Dead / unreachable files

The document must name specific files. If it does not, classify as
"Unverifiable" and ask for the file paths.

```bash
# Check if a named file is imported anywhere
grep -rn "import.*AuthFileNameHere\|require.*AuthFileNameHere" \
  packages/backend/src --include="*.ts"

# Check if a file has any callers
grep -rn "from.*'./path/to/file'" packages/backend/src --include="*.ts"
```

---

## Frontend tenant isolation (getBenchmarks / getOntologyStats pattern)

```bash
# Find all callers of a backend method in the frontend
grep -rn "getBenchmarks\|getOntologyStats" \
  apps/ValyntApp/src --include="*.ts" --include="*.tsx"

# Confirm the method requires organizationId in the backend
grep -n "organizationId\|requireOrganizationId" \
  packages/backend/src/services/ValueFabricService.ts | head -10
```

If no frontend callers exist, the claim about missing tenant filters is
"Already resolved" (the method is backend-only).

---

## ADR existence

```bash
# List all accepted ADRs
ls docs/engineering/adr/*.md

# Check for a specific ADR topic
grep -rl "agent fabric\|CI security\|de-duplication" docs/engineering/adr/
```

---

## CI coverage thresholds

```bash
# Current thresholds in CI
grep -n "coverage.thresholds\|lines=\|functions=\|branches=" \
  .github/workflows/ci.yml
```

---

## Skip waivers

```bash
# List all waiver IDs
grep '"id"' config/release-risk/release-1.0-skip-waivers.json

# Check if a specific waiver ID exists
grep "R1-SKIP-002" config/release-risk/release-1.0-skip-waivers.json
```

---

## SLO/SLI documentation

```bash
# Check if SLO framework exists
grep -l "SLO\|SLI\|availability\|latency" docs/operations/*.md

# Confirm SLO targets are defined
grep -n "SLO-API\|p95\|99.9" docs/operations/monitoring-observability.md | head -10
```

---

## Disaster recovery documentation

```bash
# Confirm DR runbook exists and has RTO/RPO targets
grep -n "RTO\|RPO\|Recovery" docs/runbooks/disaster-recovery.md | head -10
```

---

## Load test scripts

```bash
# Confirm load test scripts exist
find . \( -name "*.k6.js" -o -name "load-test*" \) \
  | grep -v node_modules | grep -v "\.skill"

# Check if documented baselines exist
find docs/operations -name "load-test-baselines*" 2>/dev/null
```

---

## Oversized file refactors

```bash
# Check current line count of a named file
wc -l packages/backend/src/services/sdui/CanvasSchemaService.ts
wc -l packages/backend/src/services/tenant/TenantProvisioning.ts

# Confirm extracted modules exist
ls packages/backend/src/services/sdui/CanvasActionApplier.ts
ls packages/backend/src/services/tenant/TenantLimits.ts
ls packages/backend/src/services/agents/resilience/AgentRetryTypes.ts
```

---

## Legacy directory removal

```bash
# Confirm legacy dirs are gone
ls client/ server/ shared/ 2>&1

# Confirm ESLint ban rule exists
grep -rn "legacyRootDirBan\|client/\|server/" \
  .eslintrc* eslint.config* packages/backend/.eslintrc* 2>/dev/null | head -5
```

---

## Traceability gaps

```bash
# All missing/partial items across lifecycle stages
grep -n "❌\|⚠️" .ona/context/traceability.md

# Specific integration status
grep -A3 "Salesforce\|ServiceNow\|Slack\|SharePoint" \
  .ona/context/traceability.md
```

---

## User story status

```bash
# All story statuses
grep -n "^\*\*Status:\*\*" .ona/context/user-stories.md

# Specific story
grep -A5 "US-007" .ona/context/user-stories.md
```
