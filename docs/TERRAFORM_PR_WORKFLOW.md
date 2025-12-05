# Terraform PR Workflow

## Overview

The Terraform PR workflow automatically validates infrastructure changes and posts detailed plan summaries to Pull Requests, preventing infrastructure drift and surprises in production.

## Problem Statement

### Before Implementation

**Issue**: Terraform changes were applied directly to `main` without visibility into what would change.

**Risks**:
- 🚨 **Infrastructure drift** - Unexpected changes in production
- 💥 **Accidental destruction** - Resources deleted without warning
- 🤷 **No review process** - Changes applied without team visibility
- 🐛 **Syntax errors** - Invalid Terraform caught only during deployment

**Example scenario**: Developer updates EKS cluster configuration

**What happened**:
```
1. Push to main
2. Workflow runs terraform apply
3. ❌ Cluster gets destroyed and recreated
4. 💥 Production outage
5. 😱 Team finds out after the fact
```

### After Implementation

**Solution**: Automated Terraform validation and plan preview on every PR

**Benefits**:
- ✅ **Visibility** - See exactly what will change before merging
- ⚠️ **Warnings** - Destructive changes highlighted in PR
- 🔍 **Validation** - Syntax and format checked automatically
- 👥 **Team review** - Infrastructure changes reviewed like code

**Same scenario with new workflow**:

```
1. Create PR with EKS changes
2. Workflow runs terraform plan
3. ⚠️ PR comment shows: "Will destroy and recreate cluster"
4. 👥 Team reviews and discusses
5. ✅ Either approve or request changes
6. 🎯 Merge only when safe
```

---

## How It Works

### 1. Trigger

Workflow runs automatically on PRs that modify Terraform files:

```yaml
on:
  pull_request:
    paths:
      - 'infrastructure/terraform/**'
```

### 2. Validation Steps

The workflow performs four checks:

#### Step 1: Format Check
```bash
terraform fmt -check -recursive
```
**Purpose**: Ensure consistent formatting  
**Fails if**: Files are not properly formatted  
**Fix**: Run `terraform fmt -recursive`

#### Step 2: Initialize
```bash
terraform init -backend=false
```
**Purpose**: Download providers and modules  
**Fails if**: Invalid provider configuration  
**Fix**: Check provider versions and sources

#### Step 3: Validate
```bash
terraform validate
```
**Purpose**: Check syntax and configuration  
**Fails if**: Invalid Terraform syntax  
**Fix**: Review error messages and fix syntax

#### Step 4: Plan
```bash
terraform plan -no-color -out=tfplan
```
**Purpose**: Generate execution plan  
**Fails if**: Invalid variables or resources  
**Fix**: Check variable values and resource configuration

### 3. PR Comment

The workflow posts a detailed comment to the PR:

```markdown
## Terraform Plan Results 📋

**Environment**: `staging`
**Terraform Version**: `1.5.0`

### Validation Status

| Check | Status |
|-------|--------|
| Format | ✅ `terraform fmt` |
| Init | ✅ `terraform init` |
| Validate | ✅ `terraform validate` |
| Plan | ✅ `terraform plan` |

### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 3 |
| 🟡 Update | 2 |
| 🔴 Destroy | 0 |

### Plan Output

<details>
<summary>Click to expand full plan</summary>

```terraform
[Full plan output here]
```

</details>
```

---

## Example Scenarios

### Scenario 1: Adding New Resources

**Change**: Add new S3 bucket for backups

**PR Comment**:
```markdown
### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 1 |
| 🟡 Update | 0 |
| 🔴 Destroy | 0 |

Resources to create:
- `aws_s3_bucket.backups`
```

**Review**: ✅ Safe to merge

---

### Scenario 2: Updating Resources

**Change**: Increase RDS instance size

**PR Comment**:
```markdown
### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 0 |
| 🟡 Update | 1 |
| 🔴 Destroy | 0 |

Resources to update:
- `aws_rds_instance.main` (instance_class: db.t3.medium → db.t3.large)
```

**Review**: ✅ Safe to merge (in-place update)

---

### Scenario 3: Destructive Changes

**Change**: Change EKS cluster name

**PR Comment**:
```markdown
### Resource Changes

| Action | Count |
|--------|-------|
| 🟢 Create | 1 |
| 🟡 Update | 0 |
| 🔴 Destroy | 1 |

### ⚠️ WARNING: Destructive Changes Detected

This plan will **destroy 1 resource(s)**. Please review carefully before merging.

Resources to destroy:
- `aws_eks_cluster.main`

Resources to create:
- `aws_eks_cluster.main` (with new name)
```

**Review**: ⚠️ Requires careful review and planning

---

### Scenario 4: Format Issues

**Change**: Add new variable without formatting

**PR Comment**:
```markdown
### Validation Status

| Check | Status |
|-------|--------|
| Format | ❌ `terraform fmt` |
| Init | ✅ `terraform init` |
| Validate | ✅ `terraform validate` |
| Plan | ✅ `terraform plan` |

❌ Terraform format check failed. Run 'terraform fmt -recursive' to fix.
```

**Review**: ❌ Must fix formatting before merge

---

### Scenario 5: Validation Errors

**Change**: Reference non-existent variable

**PR Comment**:
```markdown
### Validation Status

| Check | Status |
|-------|--------|
| Format | ✅ `terraform fmt` |
| Init | ✅ `terraform init` |
| Validate | ❌ `terraform validate` |
| Plan | ⏭️ Skipped |

Error: Reference to undeclared input variable

  on main.tf line 42:
  42:   instance_type = var.nonexistent_var
```

**Review**: ❌ Must fix validation errors before merge

---

## Usage

### For Developers

#### 1. Make Terraform Changes

```bash
# Edit Terraform files
vim infrastructure/terraform/main.tf

# Format your changes
cd infrastructure/terraform
terraform fmt -recursive
```

#### 2. Validate Locally (Optional)

```bash
# Run local validation
./scripts/terraform-validate.sh
```

**Output**:
```
✅ All validation checks passed!

Your Terraform configuration is ready to:
  • Create a Pull Request
  • Trigger automated plan in CI/CD
  • Be reviewed by the team
```

#### 3. Create Pull Request

```bash
git add infrastructure/terraform/
git commit -m "feat: add backup S3 bucket"
git push origin feature/add-backup-bucket

# Create PR on GitHub
gh pr create --title "Add backup S3 bucket" --body "Adds S3 bucket for automated backups"
```

#### 4. Review Workflow Results

The workflow will automatically:
1. Run validation checks
2. Generate Terraform plan
3. Post results as PR comment
4. Update comment if you push new commits

#### 5. Address Issues

If validation fails:

```bash
# Fix formatting
terraform fmt -recursive

# Fix validation errors
# (Review error messages in PR comment)

# Push fixes
git add .
git commit -m "fix: address validation errors"
git push
```

#### 6. Merge When Approved

Once the workflow passes and team approves:

```bash
# Merge PR
gh pr merge --squash
```

The production deployment workflow will then apply the changes.

---

### For Reviewers

#### Review Checklist

When reviewing Terraform PRs:

- [ ] **Validation Status**: All checks passed (✅)
- [ ] **Resource Changes**: Understand what will change
- [ ] **Destructive Changes**: None, or justified and planned
- [ ] **Security**: No hardcoded secrets or credentials
- [ ] **Naming**: Resources follow naming conventions
- [ ] **Tags**: Resources properly tagged
- [ ] **Documentation**: Changes documented if needed

#### Reviewing Destructive Changes

If PR includes destructive changes (🔴):

1. **Understand the impact**
   - What resources will be destroyed?
   - What depends on these resources?
   - Will there be downtime?

2. **Plan the deployment**
   - Schedule during maintenance window?
   - Need to backup data first?
   - Communication plan for stakeholders?

3. **Verify necessity**
   - Is destruction necessary?
   - Can we achieve the goal without destruction?
   - Are there alternatives?

4. **Approve only if**
   - Impact is understood and acceptable
   - Deployment is planned
   - Team is prepared

---

## Configuration

### Required Secrets

The workflow requires these GitHub secrets:

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_KEY` | Supabase service key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `TOGETHER_API_KEY` | Together.ai API key | `xxx` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-xxx` |
| `JWT_SECRET` | JWT secret | `xxx` |
| `DB_PASSWORD` | Database password | `xxx` |
| `ACM_CERTIFICATE_ARN` | ACM certificate ARN | `arn:aws:acm:us-east-1:...` |

### Workflow Permissions

The workflow requires:

```yaml
permissions:
  contents: read        # Read repository contents
  pull-requests: write  # Post comments to PRs
```

---

## Troubleshooting

### Issue: Workflow doesn't run

**Symptom**: No workflow run when PR is created

**Diagnosis**:
1. Check if Terraform files were modified
2. Verify workflow file exists: `.github/workflows/terraform-check.yml`
3. Check workflow is enabled in repository settings

**Solution**:
```bash
# Verify path filter matches your changes
git diff --name-only origin/main | grep "infrastructure/terraform"
```

---

### Issue: Format check fails

**Symptom**: ❌ `terraform fmt` check fails

**Diagnosis**: Files are not properly formatted

**Solution**:
```bash
cd infrastructure/terraform
terraform fmt -recursive
git add .
git commit -m "fix: format Terraform files"
git push
```

---

### Issue: Validation fails

**Symptom**: ❌ `terraform validate` fails

**Diagnosis**: Invalid Terraform syntax or configuration

**Solution**:
1. Review error message in PR comment
2. Fix the syntax error
3. Test locally:
   ```bash
   cd infrastructure/terraform
   terraform init -backend=false
   terraform validate
   ```
4. Push fix

---

### Issue: Plan fails

**Symptom**: ❌ `terraform plan` fails

**Diagnosis**: Invalid variables or resource configuration

**Common causes**:
- Missing required variables
- Invalid variable values
- Resource dependencies not met
- AWS permissions issues

**Solution**:
1. Review error in PR comment
2. Check variable values
3. Verify AWS credentials have required permissions
4. Test locally with same variables

---

### Issue: Comment not posted

**Symptom**: Workflow runs but no PR comment

**Diagnosis**: Missing permissions or GitHub API issue

**Solution**:
1. Verify workflow has `pull-requests: write` permission
2. Check workflow logs for errors
3. Verify GitHub token has required scopes

---

### Issue: Plan too large

**Symptom**: PR comment truncated

**Diagnosis**: Plan output exceeds GitHub comment size limit (65KB)

**Solution**:
- Comment will be automatically truncated
- Full plan available in workflow artifacts
- Download artifact from workflow run

---

## Best Practices

### 1. Always Format Before Committing

```bash
# Add to pre-commit hook
cd infrastructure/terraform && terraform fmt -recursive
```

### 2. Validate Locally First

```bash
# Run validation script
./scripts/terraform-validate.sh
```

### 3. Small, Focused Changes

- One logical change per PR
- Easier to review
- Faster to merge
- Lower risk

### 4. Descriptive Commit Messages

```bash
# Good
git commit -m "feat: add S3 bucket for backups with lifecycle policy"

# Bad
git commit -m "update terraform"
```

### 5. Document Destructive Changes

If PR includes destructive changes:

```markdown
## ⚠️ Destructive Changes

This PR will destroy and recreate the EKS cluster to change the name.

**Impact**: 
- ~5 minutes downtime
- All pods will be rescheduled

**Mitigation**:
- Deploy during maintenance window (Sunday 2 AM)
- Notify team 24 hours in advance
- Have rollback plan ready
```

### 6. Review Plan Carefully

Don't just check if workflow passed - actually review the plan:

- What resources are changing?
- Are the changes expected?
- Any surprises?
- Any security implications?

---

## Advanced Features

### Custom Plan Parsing

The workflow includes a plan parser (`scripts/parse-terraform-plan.js`) that:

- Extracts resource changes
- Counts creates/updates/destroys
- Highlights destructive changes
- Generates formatted summary

### Plan Artifacts

Every workflow run uploads plan artifacts:

- `tfplan` - Binary plan file
- `plan_output.txt` - Text plan output

**Download artifacts**:
1. Go to workflow run
2. Scroll to "Artifacts" section
3. Download `terraform-plan`

### Comment Updates

The workflow updates the same comment on subsequent pushes:

- First push: Creates new comment
- Subsequent pushes: Updates existing comment
- Keeps PR clean with single comment

---

## Integration with Deployment

### Workflow Relationship

```
PR Created
    ↓
terraform-check.yml runs
    ↓ (validates and plans)
PR Comment posted
    ↓
Team reviews
    ↓
PR Merged
    ↓
deploy-production.yml runs
    ↓ (applies changes)
Infrastructure Updated
```

### Deployment Safety

The PR workflow ensures:

1. **Validation before merge** - No invalid Terraform reaches main
2. **Visibility before apply** - Team sees changes before deployment
3. **Review process** - Infrastructure changes reviewed like code
4. **Audit trail** - All changes documented in PRs

---

## Metrics and Monitoring

### Success Metrics

Track these metrics to measure workflow effectiveness:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| PRs with Terraform changes | 100% validated | GitHub Actions insights |
| Format failures | < 5% | Workflow run history |
| Validation failures | < 10% | Workflow run history |
| Destructive changes caught | 100% | PR comment analysis |
| Infrastructure incidents | Reduced | Incident tracking |

### Monitoring

Monitor workflow health:

```bash
# View recent workflow runs
gh run list --workflow=terraform-check.yml --limit 10

# View specific run
gh run view <run-id>

# Download logs
gh run download <run-id>
```

---

## Future Enhancements

### 1. Cost Estimation

Add cost estimation to PR comments:

```yaml
- name: Run Infracost
  uses: infracost/actions/comment@v1
  with:
    path: infrastructure/terraform
```

**Benefit**: See cost impact before merging

### 2. Security Scanning

Add security scanning with tfsec:

```yaml
- name: Run tfsec
  uses: aquasecurity/tfsec-action@v1
  with:
    working_directory: infrastructure/terraform
```

**Benefit**: Catch security issues early

### 3. Compliance Checking

Add compliance checking with Checkov:

```yaml
- name: Run Checkov
  uses: bridgecrewio/checkov-action@master
  with:
    directory: infrastructure/terraform
```

**Benefit**: Ensure compliance with policies

---

## References

- **Workflow file**: `.github/workflows/terraform-check.yml`
- **Validation script**: `scripts/terraform-validate.sh`
- **Plan parser**: `scripts/parse-terraform-plan.js`
- **Test script**: `scripts/test-terraform-workflow.sh`
- **Terraform docs**: https://www.terraform.io/docs

---

**Last Updated**: November 23, 2024  
**Version**: 1.0  
**Author**: ValueCanvas DevOps Team
