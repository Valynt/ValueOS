# GitHub Actions Workflows for Terraform

Automated CI/CD pipelines for ValueCanvas infrastructure deployment and management.

## Canonical CI Documentation

- Use [`CI_CONTROL_MATRIX.md`](./CI_CONTROL_MATRIX.md) as the canonical workflow control map.
- Deprecated workflows are renamed with the `.deprecated.yml.disabled` suffix and should not be re-enabled without an owner + deprecation reversal plan.

## Overview

This directory contains GitHub Actions workflows that automate:

- ✅ Terraform validation and formatting
- 📋 Infrastructure planning on pull requests
- 🚀 Automated staging deployments
- 🔒 Controlled production deployments with approvals
- 🔍 Security scanning (tfsec, Checkov, Trivy)
- 🔄 Infrastructure drift detection
- 📊 Deployment notifications and monitoring

## Canonical CI Entry Point

For application CI, workflows should prefer the single entry point `pnpm run ci:verify`.

### Governance command contract

The required blocking governance gate is `pnpm run typecheck:signal --verify`. This command must be enforced in CI either directly, or transitively through `pnpm run ci:verify` (which is the preferred contract for application workflows).

`pnpm run ci:verify` is expected to run linting, type checks, governance verification, legacy route checks, tests, workflow governance self-checking, and build steps in a consistent order. Do not downgrade governance enforcement to summary-only telemetry (for example `typecheck:signal:summary`) in protected CI paths.

The protected merge workflow in `ci.yml` currently enforces the direct governance command `pnpm run typecheck:signal --verify`, and separately runs `pnpm run ci:governance:self-check` to ensure the workflow still references one of the documented canonical commands.

To prevent accidental regressions, CI includes `pnpm run ci:governance:self-check`, which validates that:

- if `ci:verify` is present, it still contains `pnpm run typecheck:signal --verify`, and
- the authoritative protected workflow (`ci.yml`) includes either `pnpm run ci:verify` or the direct governance command.

Optional workflows (`test.yml`, `deploy.yml`, `release.yml`) are checked only when present and may be absent without failing the governance self-check.

## Tenant isolation CI policy (fork-safe)

`ci.yml` enforces tenant-boundary evidence with two complementary lanes:

- `tenant-isolation-static-gate` (**secrets-free, deterministic fallback**) runs on all PRs (including forks) and validates tenant controls using repository-local checks:
  - `node scripts/ci/check-supabase-tenant-controls.mjs`
  - `node scripts/ci/check-migration-schema-consistency.mjs`
  - `bash scripts/ci/check-permissive-rls.sh`
- `tenant-isolation-gate` (**secret-backed runtime tests**) runs in trusted contexts (push/release/workflow_dispatch and same-repo PRs) and executes full Vitest tenant isolation + compliance suites with Supabase secrets.

### Merge gating behavior for PRs

The `pr-fast-blocking-subsets` job requires **at least one** tenant-isolation lane to finish with `success`:

- `tenant-isolation-static-gate` OR
- `tenant-isolation-gate`

A `skipped` runtime lane on fork PRs is acceptable only when the static fallback lane succeeds. If both tenant lanes are not `success`, PR merge eligibility is blocked.

## Workflows

### 1. Terraform Validation (`terraform-validate.yml`)

**Triggers:**

- Pull requests affecting `infra/terraform/**` and workflow changes in `.github/workflows/terraform-*.yml`
- Pushes to `main` or `develop` branches when Terraform files in `infra/terraform/**` change

**Actions:**

- Validates Terraform syntax
- Checks formatting
- Validates both staging and production configurations
- Comments validation results on PRs

**Usage:**
Automatically runs on every PR. No manual intervention needed.

---

### 2. Terraform Plan on PR (`terraform-plan-pr.yml`)

**Triggers:**

- Pull requests (`opened`, `synchronize`, `reopened`) affecting `infra/terraform/**`

**Actions:**

- Generates Terraform plans for both staging and production
- Posts plan summaries as PR comments
- Updates comments on subsequent pushes

**Usage:**
Review the plan in PR comments before merging.

**Example Comment:**

````
### Terraform Plan - Staging Environment 📋

#### Plan Status: `success`

<details><summary>Show Plan</summary>

```terraform
Terraform will perform the following actions:
  # aws_instance.example will be created
  + resource "aws_instance" "example" {
      + ami           = "ami-12345678"
      + instance_type = "t3.medium"
      ...
    }
````

</details>
```

---

### 3. Deploy to Staging (`terraform-deploy-staging.yml`)

**Triggers:**

- Push to `develop` branch
- Manual workflow dispatch

**Actions:**

- Validates configuration
- Creates Terraform plan
- Applies changes automatically
- Configures kubectl
- Uploads deployment artifacts
- Sends Slack notifications

**Usage:**

**Automatic:**

```bash
git push origin develop
```

**Manual:**

1. Go to Actions tab
2. Select "Deploy to Staging"
3. Click "Run workflow"
4. Choose action: `plan` or `apply`

**Required Secrets:**

- `AWS_ROLE_ARN`
- `DB_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `TOGETHER_API_KEY`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `ACM_CERTIFICATE_ARN`

---

### 4. Deploy to Production (`terraform-deploy-production.yml`)

**Triggers:**

- Manual workflow dispatch only (no automatic deployments)

**Actions:**

- Validates AWS account
- Requires confirmation text: "DEPLOY TO PRODUCTION"
- Creates backup of current state
- Generates Terraform plan
- Requires manual approval from 2+ authorized personnel
- Applies changes with extensive logging
- Runs smoke tests
- Sends critical notifications

**Usage:**

1. Go to Actions tab
2. Select "Deploy to Production"
3. Click "Run workflow"
4. Fill in:
   - **Action:** `plan` or `apply`
   - **Confirm:** Type exactly `DEPLOY TO PRODUCTION`
5. Click "Run workflow"
6. Wait for approval (if applying)
7. Monitor deployment

**Safety Features:**

- ✅ Confirmation text required
- ✅ AWS account verification
- ✅ State backup before changes
- ✅ Manual approval from 2+ people
- ✅ Deployment record keeping
- ✅ Automatic rollback on failure
- ✅ PagerDuty and Slack alerts

**Required Secrets:**

- `AWS_ROLE_ARN_PROD`
- `AWS_PROD_ACCOUNT_ID`
- `PROD_DB_PASSWORD`
- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_ANON_KEY`
- `PROD_SUPABASE_SERVICE_KEY`
- `PROD_TOGETHER_API_KEY`
- `PROD_OPENAI_API_KEY`
- `PROD_JWT_SECRET`
- `PROD_ACM_CERTIFICATE_ARN`
- `DATADOG_API_KEY`
- `PAGERDUTY_INTEGRATION_KEY`
- `SLACK_WEBHOOK_URL`

**Required Variables:**

- `PRODUCTION_APPROVERS` - Comma-separated GitHub usernames

---

### 5. Security Scanning (`terraform-security-scan.yml`)

**Triggers:**

- Pull requests affecting `infra/terraform/**`
- Pushes to `main` or `develop` when Terraform files in `infra/terraform/**` change
- Weekly schedule (`0 0 * * 0`, Sunday at midnight UTC)
- Manual workflow dispatch

**Actions:**

- Runs tfsec security scanner
- Runs Checkov policy checker
- Runs Trivy IaC scanner
- Uploads results to GitHub Security tab
- Comments findings on PRs
- Sends alerts for critical issues

**Scanners:**

**tfsec:**

- AWS-specific security checks
- Detects misconfigurations
- Checks encryption, access controls, logging

**Checkov:**

- Policy-as-code validation
- CIS benchmarks
- Best practices enforcement

**Trivy:**

- Comprehensive IaC scanning
- Vulnerability detection
- Compliance checking

**Usage:**
Automatically runs on PRs. Review security findings before merging.

---

### 6. Drift Detection (`terraform-drift-detection.yml`)

**Triggers:**

- Every 6 hours (scheduled)
- Manual workflow dispatch

**Actions:**

- Compares actual infrastructure with Terraform state
- Detects manual changes or drift
- Creates GitHub issues for drift
- Sends alerts for production drift
- Auto-closes issues when drift resolved

**Drift Scenarios:**

- Manual changes via AWS Console
- Auto-scaling events
- AWS service updates
- State file corruption

**Response:**

**Staging Drift:**

- GitHub issue created
- Labeled: `drift-detection`, `staging`
- Review and remediate

**Production Drift:**

- Critical GitHub issue created
- PagerDuty alert triggered
- Slack notification sent
- Requires immediate attention

**Usage:**
Monitor GitHub issues with label `drift-detection`.

---

## Setup Instructions

### 1. Configure AWS OIDC

Set up AWS IAM roles for GitHub Actions:

```bash
# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create IAM role for staging
aws iam create-role \
  --role-name GitHubActionsStaging \
  --assume-role-policy-document file://trust-policy.json

# Create IAM role for production
aws iam create-role \
  --role-name GitHubActionsProduction \
  --assume-role-policy-document file://trust-policy-prod.json
```

**trust-policy.json:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/ValueCanvas:*"
        }
      }
    }
  ]
}
```

### 2. Configure GitHub Secrets

**Repository Settings → Secrets and variables → Actions**

**Staging Secrets:**

```
AWS_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/GitHubActionsStaging
DB_PASSWORD=<secure-password>
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_KEY=<key>
TOGETHER_API_KEY=<key>
OPENAI_API_KEY=<key>
JWT_SECRET=<secret>
ACM_CERTIFICATE_ARN=arn:aws:acm:...
```

**Production Secrets:**

```
AWS_ROLE_ARN_PROD=arn:aws:iam::ACCOUNT_ID:role/GitHubActionsProduction
AWS_PROD_ACCOUNT_ID=123456789012
PROD_DB_PASSWORD=<secure-password>
PROD_SUPABASE_URL=https://xxx.supabase.co
PROD_SUPABASE_ANON_KEY=<key>
PROD_SUPABASE_SERVICE_KEY=<key>
PROD_TOGETHER_API_KEY=<key>
PROD_OPENAI_API_KEY=<key>
PROD_JWT_SECRET=<secret>
PROD_ACM_CERTIFICATE_ARN=arn:aws:acm:...
DATADOG_API_KEY=<key>
PAGERDUTY_INTEGRATION_KEY=<key>
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

**Variables:**

```
PRODUCTION_APPROVERS=user1,user2,user3
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

### 3. Configure GitHub Environments

**Settings → Environments**

**Create "staging" environment:**

- No protection rules needed
- Add staging secrets

**Create "production" environment:**

- ✅ Required reviewers: 2+ people
- ✅ Wait timer: 5 minutes
- ✅ Deployment branches: `main` only
- Add production secrets

### 4. Enable GitHub Security Features

**Settings → Code security and analysis**

- ✅ Enable Dependabot alerts
- ✅ Enable Dependabot security updates
- ✅ Enable Code scanning (CodeQL)
- ✅ Enable Secret scanning

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Developer Workflow                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Create PR       │
                    │  (feature branch)│
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │ Terraform        │      │ Security Scan    │
    │ Validation       │      │ (tfsec/Checkov)  │
    └────────┬─────────┘      └────────┬─────────┘
             │                         │
             └────────────┬────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │ Terraform Plan   │
                │ (Comment on PR)  │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Code Review      │
                │ & Approval       │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Merge to develop │
                └────────┬─────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ Auto-Deploy to Staging │
            └────────────┬───────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ Test in Staging        │
            └────────────┬───────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ Manual Production      │
            │ Deployment             │
            │ (Requires Approval)    │
            └────────────────────────┘
```

## Best Practices

### 1. Always Review Plans

- Never merge without reviewing Terraform plans
- Check for unexpected resource changes
- Verify cost implications

### 2. Test in Staging First

- Deploy to staging before production
- Run integration tests
- Verify functionality

### 3. Production Deployments

- Schedule during maintenance windows
- Have rollback plan ready
- Monitor closely after deployment
- Keep team informed

### 4. Security

- Rotate secrets regularly
- Review security scan results
- Address critical findings immediately
- Keep Terraform providers updated

### 5. Drift Management

- Investigate drift causes
- Document manual changes
- Update Terraform to match reality
- Prevent future drift

## Troubleshooting

### Workflow Fails with "AWS credentials not configured"

**Solution:**

1. Verify OIDC provider exists in AWS
2. Check IAM role trust policy
3. Verify `AWS_ROLE_ARN` secret is correct
4. Ensure role has necessary permissions

### Plan Shows Unexpected Changes

**Solution:**

1. Check if manual changes were made
2. Review recent AWS service updates
3. Verify Terraform state is current
4. Check for provider version changes

### Production Deployment Stuck on Approval

**Solution:**

1. Check GitHub environment settings
2. Verify approvers are configured
3. Ensure approvers have repository access
4. Check approval notifications

### Security Scan Fails

**Solution:**

1. Review security findings
2. Fix critical issues first
3. Add exceptions for false positives
4. Update security policies if needed

## Monitoring

### Key Metrics to Track

1. **Deployment Frequency**
   - Staging: Multiple times per day
   - Production: Weekly or as needed

2. **Deployment Success Rate**
   - Target: >95%

3. **Mean Time to Recovery (MTTR)**
   - Target: <1 hour

4. **Drift Detection Rate**
   - Target: 0 production drift incidents

### Alerts to Configure

- ❌ Deployment failures
- ⚠️ Security scan failures
- 🔄 Infrastructure drift detected
- 📊 High resource utilization
- 💰 Cost anomalies

## Support

For issues or questions:

1. Check workflow logs in Actions tab
2. Review this documentation
3. Check Terraform documentation
4. Contact DevOps team

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [tfsec Documentation](https://aquasecurity.github.io/tfsec/)
- [Checkov Documentation](https://www.checkov.io/)
- [AWS OIDC Setup](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)

## Supabase Cloud-Only Policy

- Default migration and deployment workflows must use hosted Supabase projects (linked project refs and `supabase db push`).
- Workflow paths must not depend on `infra/supabase/config.toml` or local Supabase stack state unless the workflow/job is explicitly marked local-only.
- Any local-stack job must set `LOCAL_SUPABASE_ONLY=1` and be documented as optional/non-deploying.
