# GitHub Actions Workflows

Canonical workflow governance for **ValueOS**.

## Canonical workflow documents

- Use [`CI_CONTROL_MATRIX.md`](./CI_CONTROL_MATRIX.md) as the source of truth for workflow ownership, control coverage, and lifecycle state.
- Active automation must live under `.github/workflows/`.
- Reference-only or retired workflow definitions must live outside `.github/`, currently under `docs/archive/workflows/`.

## Standard action versions

To keep policy checks and maintenance simple, active workflows should use this baseline unless a workflow has a documented reason to diverge:

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/cache@v5`
- `actions/upload-artifact@v7`
- `pnpm/action-setup@v4`

## Canonical CI entry point

For application CI, workflows should prefer `pnpm run ci:verify` or explicitly enforce the blocking governance command `pnpm run typecheck:signal --verify`.

`ci.yml` remains the protected merge workflow and also runs `pnpm run ci:governance:self-check` to confirm the documented CI contract still matches workflow implementation.

## Tenant isolation CI policy (fork-safe)

`ci.yml` enforces tenant-boundary evidence with two complementary lanes:

- `tenant-isolation-static-gate` — secrets-free static enforcement that runs for all PRs, including forks.
- `tenant-isolation-gate` — secret-backed runtime tenant isolation + DSR suites for trusted contexts.

For PR merge eligibility, at least one tenant lane must complete successfully. Fork PRs may rely on the static lane when the runtime lane is skipped.

## Active workflow inventory

| Workflow | Primary purpose | Notes |
| --- | --- | --- |
| `ci.yml` | Protected merge CI, quality, tenant isolation, security, accessibility, release aggregation | Canonical application CI entry point. |
| `codeql.yml` | Dedicated CodeQL scanning | Required branch-protection signal. |
| `deploy.yml` | Staging/production promotion, DAST, release gate contract, rollback | Canonical deployment workflow. |
| `release.yml` | Reproducibility, release packaging, Changesets, SBOM/signing | Release integrity workflow. |
| `test.yml` | Manual/full test execution lanes | Supplemental validation workflow. |
| `terraform.yml` | Terraform validation and policy checks | Infrastructure workflow. |
| `compliance-evidence-export.yml` | Scheduled compliance evidence bundle export | Governance evidence workflow. |
| `secret-rotation-verification.yml` | Scheduled + deploy-time secret age verification | Security operations workflow. |
| `oncall-drill-scorecard.yml` | Publish on-call drill scorecard trends | Reliability operations workflow. |
| `access-review-automation.yml` | Generate periodic access review evidence | Compliance operations workflow. |
| `dependency-outdated.yml` | Dependency freshness reporting | Advisory maintenance workflow. |
| `dr-validation.yml` | Disaster recovery validation evidence | Reliability validation workflow. |
| `migration-chain-integrity.yml` | Migration chain integrity checks | Database governance workflow. |
| `v1-core-services-test.yml` | Legacy backend service test suite | Narrow-scope legacy workflow retained until coverage is fully absorbed elsewhere. |

## Archived workflow references

These files are intentionally non-executable and retained only as documentation/audit references:

- `docs/archive/workflows/unified-deployment-pipeline.reference.yml`
- `docs/archive/workflows/accessibility.deprecated.yml.disabled`

Do not move archived/reference workflow files back under `.github/` unless there is a documented re-activation plan, explicit ownership, and corresponding updates to this README and the control matrix.
