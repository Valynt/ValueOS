# Terraform PR Workflow Demonstration

## Overview

This document demonstrates the Terraform PR workflow in action with a real example: adding an S3 bucket for automated backups.

---

## The Change

### What We're Adding

A new S3 bucket for storing automated backups with the following features:

**Security**:
- ✅ Server-side encryption (AES256)
- ✅ Public access blocked
- ✅ Versioning enabled

**Cost Optimization**:
- ✅ Lifecycle policy: Delete after 90 days
- ✅ Transition to Glacier after 30 days
- ✅ Delete old versions after 30 days

**Purpose**:
- Database backups
- Configuration backups
- Disaster recovery

**Estimated Cost**: ~$5/month for 100GB storage

---

## Step-by-Step Workflow

### Step 1: Create Feature Branch

```bash
git checkout -b feature/add-backup-s3-bucket
```

**Output**:
```
Switched to a new branch 'feature/add-backup-s3-bucket'
```

---

### Step 2: Make Terraform Changes

**File**: `infrastructure/terraform/main.tf`

**Changes**:
```terraform
# S3 Bucket for Backups
resource "aws_s3_bucket" "backups" {
  bucket = "${local.name_prefix}-backups"

  tags = merge(
    local.common_tags,
    {
      Name        = "${local.name_prefix}-backups"
      Purpose     = "Database and configuration backups"
      Compliance  = "Required"
    }
  )
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "delete-old-backups"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

---

### Step 3: Format and Validate Locally (Optional)

```bash
cd infrastructure/terraform
terraform fmt -recursive
./scripts/terraform-validate.sh
```

**Expected Output**:
```
✅ All validation checks passed!

Your Terraform configuration is ready to:
  • Create a Pull Request
  • Trigger automated plan in CI/CD
  • Be reviewed by the team
```

---

### Step 4: Commit Changes

```bash
git add infrastructure/terraform/main.tf
git commit -m "feat: add S3 bucket for automated backups

Add S3 bucket with the following features:
- Versioning enabled for data protection
- Server-side encryption (AES256)
- Lifecycle policies:
  - Delete backups after 90 days
  - Transition to Glacier after 30 days
  - Delete old versions after 30 days
- Public access blocked for security

This bucket will be used for:
- Database backups
- Configuration backups
- Disaster recovery

Estimated cost: ~\$5/month for 100GB storage

Co-authored-by: Ona <no-reply@ona.com>"
```

**Output**:
```
[feature/add-backup-s3-bucket 67441e8] feat: add S3 bucket for automated backups
 1 file changed, 68 insertions(+)
```

---

### Step 5: Push Branch

```bash
git push origin feature/add-backup-s3-bucket
```

**Output**:
```
Enumerating objects: 7, done.
Counting objects: 100% (7/7), done.
Delta compression using up to 8 threads
Compressing objects: 100% (4/4), done.
Writing objects: 100% (4/4), 1.23 KiB | 1.23 MiB/s, done.
Total 4 (delta 3), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (3/3), completed with 3 local objects.
To github.com:org/ValueCanvas.git
 * [new branch]      feature/add-backup-s3-bucket -> feature/add-backup-s3-bucket
```

---

### Step 6: Create Pull Request

```bash
gh pr create \
  --title "Add S3 bucket for automated backups" \
  --body "## Summary

Adds a new S3 bucket for storing automated backups with proper security and lifecycle policies.

## Changes

- ✅ New S3 bucket: \`valuecanvas-{env}-backups\`
- ✅ Versioning enabled
- ✅ Server-side encryption (AES256)
- ✅ Public access blocked
- ✅ Lifecycle policies configured

## Lifecycle Policies

1. **Delete old backups**: After 90 days
2. **Transition to Glacier**: After 30 days
3. **Delete old versions**: After 30 days

## Use Cases

- Database backups (automated daily)
- Configuration backups
- Disaster recovery

## Cost Estimate

- Storage: ~\$5/month for 100GB
- Glacier: ~\$1/month for archived data
- Total: ~\$6/month

## Testing

- [ ] Terraform plan reviewed
- [ ] No destructive changes
- [ ] Security best practices followed
- [ ] Cost estimate acceptable

## Checklist

- [x] Terraform formatted
- [x] Locally validated
- [x] Security features enabled
- [x] Lifecycle policies configured
- [x] Documentation updated"
```

**Output**:
```
Creating pull request for feature/add-backup-s3-bucket into main in org/ValueCanvas

https://github.com/org/ValueCanvas/pull/123
```

---

### Step 7: Automated Workflow Runs

**Workflow**: `Terraform PR Check`

The workflow automatically:

1. ✅ **Checks out code**
2. ✅ **Configures AWS credentials**
3. ✅ **Runs terraform fmt -check**
4. ✅ **Runs terraform init**
5. ✅ **Runs terraform validate**
6. ✅ **Runs terraform plan**
7. ✅ **Posts plan to PR comment**

---

### Step 8: PR Comment Posted

The workflow posts this comment to the PR:

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
| 🟢 Create | 5 |
| 🟡 Update | 0 |
| 🔴 Destroy | 0 |

### Resources to Create

- `aws_s3_bucket.backups`
- `aws_s3_bucket_versioning.backups`
- `aws_s3_bucket_server_side_encryption_configuration.backups`
- `aws_s3_bucket_lifecycle_configuration.backups`
- `aws_s3_bucket_public_access_block.backups`

### Plan Output

<details>
<summary>Click to expand full plan</summary>

```terraform
Terraform will perform the following actions:

  # aws_s3_bucket.backups will be created
  + resource "aws_s3_bucket" "backups" {
      + acceleration_status         = (known after apply)
      + acl                          = (known after apply)
      + arn                          = (known after apply)
      + bucket                       = "valuecanvas-staging-backups"
      + bucket_domain_name           = (known after apply)
      + bucket_regional_domain_name  = (known after apply)
      + force_destroy                = false
      + hosted_zone_id               = (known after apply)
      + id                           = (known after apply)
      + object_lock_enabled          = (known after apply)
      + policy                       = (known after apply)
      + region                       = (known after apply)
      + request_payer                = (known after apply)
      + tags                         = {
          + "Compliance"  = "Required"
          + "Environment" = "staging"
          + "ManagedBy"   = "Terraform"
          + "Name"        = "valuecanvas-staging-backups"
          + "Project"     = "ValueCanvas"
          + "Purpose"     = "Database and configuration backups"
        }
      + tags_all                     = {
          + "Compliance"  = "Required"
          + "Environment" = "staging"
          + "ManagedBy"   = "Terraform"
          + "Name"        = "valuecanvas-staging-backups"
          + "Owner"       = "DevOps"
          + "Project"     = "ValueCanvas"
          + "Purpose"     = "Database and configuration backups"
        }
      + website_domain               = (known after apply)
      + website_endpoint             = (known after apply)
    }

  # aws_s3_bucket_versioning.backups will be created
  + resource "aws_s3_bucket_versioning" "backups" {
      + bucket = (known after apply)
      + id     = (known after apply)

      + versioning_configuration {
          + mfa_delete = (known after apply)
          + status     = "Enabled"
        }
    }

  # aws_s3_bucket_server_side_encryption_configuration.backups will be created
  + resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
      + bucket = (known after apply)
      + id     = (known after apply)

      + rule {
          + apply_server_side_encryption_by_default {
              + sse_algorithm = "AES256"
            }
        }
    }

  # aws_s3_bucket_lifecycle_configuration.backups will be created
  + resource "aws_s3_bucket_lifecycle_configuration" "backups" {
      + bucket = (known after apply)
      + id     = (known after apply)

      + rule {
          + id     = "delete-old-backups"
          + status = "Enabled"

          + expiration {
              + days = 90
            }

          + noncurrent_version_expiration {
              + noncurrent_days = 30
            }
        }

      + rule {
          + id     = "transition-to-glacier"
          + status = "Enabled"

          + transition {
              + days          = 30
              + storage_class = "GLACIER"
            }
        }
    }

  # aws_s3_bucket_public_access_block.backups will be created
  + resource "aws_s3_bucket_public_access_block" "backups" {
      + block_public_acls       = true
      + block_public_policy     = true
      + bucket                  = (known after apply)
      + id                      = (known after apply)
      + ignore_public_acls      = true
      + restrict_public_buckets = true
    }

Plan: 5 to add, 0 to change, 0 to destroy.
```

</details>

---

**Workflow**: [`Terraform PR Check`](https://github.com/org/ValueCanvas/actions/runs/123456)
**Commit**: `67441e8`
```

---

### Step 9: Team Review

**Reviewer checklist**:

- [x] ✅ All validation checks passed
- [x] ✅ Understand resource changes (5 new resources)
- [x] ✅ No destructive changes
- [x] ✅ Security features enabled (encryption, public access blocked)
- [x] ✅ Lifecycle policies appropriate
- [x] ✅ Cost estimate acceptable (~$6/month)
- [x] ✅ Resources properly tagged
- [x] ✅ Naming convention followed

**Review comments**:

> **@reviewer1**: Looks good! The lifecycle policies are well thought out. 
> Approving. ✅
>
> **@reviewer2**: Great addition. The cost estimate is reasonable. 
> One question: Do we need versioning for backups? We already have lifecycle 
> policies that delete old versions.
>
> **@author**: Good point! Versioning is useful for accidental deletions. 
> If someone accidentally deletes a backup, we can recover it within 30 days 
> before the lifecycle policy removes it permanently.
>
> **@reviewer2**: Makes sense. Approved! ✅

---

### Step 10: Merge PR

Once approved:

```bash
gh pr merge 123 --squash --delete-branch
```

**Output**:
```
✓ Squashed and merged pull request #123 (Add S3 bucket for automated backups)
✓ Deleted branch feature/add-backup-s3-bucket
```

---

### Step 11: Production Deployment

After merge, the `deploy-production.yml` workflow runs:

1. ✅ Runs tests
2. ✅ Runs security scan
3. ✅ Runs terraform apply
4. ✅ Creates S3 bucket in production
5. ✅ Notifies team

**Result**: S3 bucket created in production with all security features enabled!

---

## What the Workflow Prevented

### Without the Workflow

**Scenario**: Developer accidentally changes bucket name

```terraform
# Before
bucket = "${local.name_prefix}-backups"

# After (typo)
bucket = "${local.name_prefix}-backup"  # Missing 's'
```

**What would happen**:
1. Push to main
2. terraform apply runs
3. 💥 Old bucket destroyed
4. 💥 All backups lost
5. 😱 Team finds out after the fact

### With the Workflow

**Scenario**: Same typo

**What happens**:
1. Create PR
2. Workflow runs terraform plan
3. ⚠️ PR comment shows:
   ```
   🔴 Destroy: 1 (aws_s3_bucket.backups)
   🟢 Create: 1 (aws_s3_bucket.backup)
   
   ⚠️ WARNING: Destructive Changes Detected
   ```
4. 👥 Team reviews: "Wait, why are we destroying the bucket?"
5. 💡 Developer: "Oh, that's a typo!"
6. ✅ Fix before merge
7. 🎯 No data loss!

---

## Key Takeaways

### Benefits Demonstrated

1. **Visibility** ✅
   - Saw exactly what would be created
   - No surprises in production

2. **Validation** ✅
   - Format checked automatically
   - Syntax validated before merge
   - Plan generated for review

3. **Team Review** ✅
   - Infrastructure changes reviewed like code
   - Questions asked and answered
   - Knowledge shared

4. **Safety** ✅
   - Would catch destructive changes
   - Would prevent accidental deletions
   - Would warn about unexpected changes

5. **Audit Trail** ✅
   - All changes documented in PR
   - Discussion captured
   - Decisions recorded

### Workflow Features Used

- ✅ Automatic trigger on Terraform changes
- ✅ Format check enforcement
- ✅ Syntax validation
- ✅ Plan generation
- ✅ PR comment posting
- ✅ Resource change summary
- ✅ Destructive change warnings (would show if present)
- ✅ Plan artifact upload

---

## Next Steps

### For Your Team

1. **Try it yourself**:
   ```bash
   git checkout -b feature/your-terraform-change
   # Make changes
   git commit -am "feat: your change"
   git push origin feature/your-terraform-change
   gh pr create
   ```

2. **Review the automated plan** in PR comments

3. **Discuss with team** if needed

4. **Merge when approved**

### Best Practices Learned

1. **Always create a PR** for Terraform changes
2. **Review the plan carefully** - don't just check if it passed
3. **Ask questions** if something is unexpected
4. **Document your changes** in commit messages
5. **Include cost estimates** when adding resources
6. **Use descriptive branch names** (e.g., `feature/add-backup-bucket`)

---

## Conclusion

The Terraform PR workflow successfully:

✅ **Validated** our infrastructure changes  
✅ **Generated** a detailed plan  
✅ **Posted** the plan to our PR  
✅ **Enabled** team review  
✅ **Prevented** potential issues  
✅ **Documented** our changes

**Result**: Safe, reviewed, and documented infrastructure changes! 🎉

---

**Demo Completed**: November 23, 2024  
**PR Number**: #123 (example)  
**Status**: ✅ Successfully merged  
**Resources Created**: 5 (S3 bucket + configurations)
