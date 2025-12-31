# GitHub Actions Workflows for Terraform

Automated CI/CD pipelines for ValueCanvas infrastructure deployment and management.

## Overview

This directory contains GitHub Actions workflows that automate:
- ✅ Terraform validation and formatting
- 📋 Infrastructure planning on pull requests
- 🚀 Automated staging deployments
- 🔒 Controlled production deployments with approvals
- 🔍 Security scanning (tfsec, Checkov, Trivy)
- 🔄 Infrastructure drift detection
- 📊 Deployment notifications and monitoring

## Workflows

### 1. Terraform Validation (`terraform-validate.yml`)

**Triggers:**
- Pull requests affecting `infrastructure/terraform/**`
- Pushes to `main` or `develop` branches

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
- Pull requests affecting `infrastructure/terraform/**`

**Actions:**
- Generates Terraform plans for both staging and production
- Posts plan summaries as PR comments
- Updates comments on subsequent pushes

**Usage:**
Review the plan in PR comments before merging.

**Example Comment:**
```
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
```

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
- Pull requests affecting `infrastructure/terraform/**`
- Pushes to `main` or `develop`
- Weekly schedule (Sunday at midnight)
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
