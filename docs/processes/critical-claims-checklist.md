# Critical Claims Checklist

Machine-verifiable governance controls for ValueOS. Each claim links to the
artifact that proves it. The CI job `scripts/ci/verify-critical-claims.mjs`
validates that all referenced files exist and are non-empty.

## Security Gates

| Claim | Artifact | Verified By |
|-------|----------|-------------|
| SAST runs on every PR | `.github/workflows/ci.yml` (job: `sast`) | CI |
| SCA + license scan runs on every PR | `.github/workflows/ci.yml` (job: `sca-license`) | CI |
| IaC scan runs on infra changes | `.github/workflows/ci.yml` (job: `iac`) | CI |
| SBOM generated on every build | `.github/workflows/ci.yml` (job: `sbom`) | CI |
| Secrets scanning configured | `.gitleaks.toml` | CI |
| Security gate blocks merge on failure | `.github/workflows/ci.yml` (job: `security-gate`) | CI |

## Branch Protections

| Claim | Artifact | Verified By |
|-------|----------|-------------|
| CI must pass before merge | `.github/workflows/ci.yml` | GitHub branch rules |
| PR review required | `.github/CODEOWNERS` | GitHub branch rules |
| Force push disabled on main | N/A (GitHub setting) | Manual audit |

## Disaster Recovery

| Claim | Artifact | Verified By |
|-------|----------|-------------|
| Database backups configured | `infra/terraform/modules/database/main.tf` (backup_retention_period) | Terraform plan |
| Redis snapshots configured | `infra/terraform/modules/cache/main.tf` (snapshot_retention_limit) | Terraform plan |
| Deployment rollback documented | `DEPLOY.md` | docs-integrity CI |
| Infrastructure is codified | `infra/terraform/` | Terraform CI |

## Release Process

| Claim | Artifact | Verified By |
|-------|----------|-------------|
| Deploy workflow exists | `.github/workflows/deploy.yml` | CI |
| Image signatures verified on release | `.github/workflows/ci.yml` (job: `image-signature-verify`) | CI |
| Changelog managed | `.changeset/` | Manual |
| Localization checked before release | `scripts/ci/check-i18n-keys.mjs` | CI |
| Accessibility tested | `.github/workflows/accessibility.yml` | CI |

## Compliance

| Claim | Artifact | Verified By |
|-------|----------|-------------|
| RLS tenant isolation tested | `tests/security/rls-tenant-isolation.test.ts` | CI |
| DSR compliance tested | `tests/compliance/dsr-workflow.test.ts` | CI |
| Terraform validated | `.github/workflows/terraform.yml` | CI |
