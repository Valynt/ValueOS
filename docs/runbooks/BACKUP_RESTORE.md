# Backup and Restore Runbook

## Overview

This document outlines the procedures for backing up and restoring the critical components of the ValueCanvas platform.

## Components

The platform consists of the following stateful components that require backup:

1.  **Database (Supabase/PostgreSQL)**: Stores application data, user profiles, and configuration.
2.  **Object Storage (Supabase Storage)**: Stores uploaded documents, generated artifacts, and images.
3.  **Secrets**: Managed via Vault or AWS Secrets Manager.

## 1. Database (PostgreSQL)

### Backup Strategy

- **Point-in-Time Recovery (PITR)**: Supabase Pro plan provides automatic PITR. Ensure this is enabled.
- **Daily Backups**: Automated daily backups are performed by Supabase.
- **Manual Backups**: Before major migrations or releases, trigger a manual backup.

### Manual Backup Procedure

1.  Log in to the Supabase Dashboard.
2.  Navigate to **Database** > **Backups**.
3.  Click **Backup Now** (if available) or use the CLI.

#### Using Supabase CLI

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f backup_$(date +%Y%m%d).sql
```

### Restore Procedure

#### Disaster Recovery (Full Restore)

1.  **Stop Traffic**: Enable maintenance mode or stop the API containers to prevent new writes.
2.  **Restore via Dashboard**:
    - Navigate to **Database** > **Backups**.
    - Select the desired backup point.
    - Click **Restore**.
    - _Warning: This will overwrite the current database._
3.  **Restore via CLI**:

```bash
psql "$SUPABASE_DB_URL" < backup_20230101.sql
```

4.  **Verify**: Check critical tables (`users`, `organizations`, `tenants`) to ensure data integrity.
5.  **Resume Traffic**: Restart API containers.

## 2. Object Storage (Supabase Storage)

### Backup Strategy

- **Bucket Replication**: Ensure buckets are replicated if using enterprise features.
- **Scripted Sync**: Use a scheduled job to sync buckets to an external S3 bucket (AWS/GCP) for off-site backup.

### Manual Backup (Sync)

```bash
# Example using AWS CLI to sync Supabase S3-compatible storage to AWS S3 backup bucket
aws s3 sync s3://valuecanvas-prod-assets s3://valuecanvas-backups/assets --endpoint-url https://<project>.supabase.co/storage/v1/s3
```

### Restore Procedure

1.  Identify missing or corrupted files.
2.  Copy files from the backup bucket back to the production bucket.

```bash
aws s3 cp s3://valuecanvas-backups/assets/file.pdf s3://valuecanvas-prod-assets/file.pdf --endpoint-url https://<project>.supabase.co/storage/v1/s3
```

## 3. Secrets

### Backup Strategy

- **Versioned Secrets**: Use Vault or AWS Secrets Manager versioning.
- **Terraform/IaC**: Keep secret configuration (not values) in code.
- **Manual Export**: Securely export secrets to an encrypted vault (e.g., 1Password) periodically.

### Restore Procedure

1.  Update the secret in the secret manager (Vault/AWS).
2.  Restart the application pods/containers to pick up the new secret values (via `SecretVolumeWatcher`).

## Verification

After any restore operation, run the **Health Check** and **Smoke Tests**:

```bash
npm run test:smoke
curl https://api.valuecanvas.com/health
```
