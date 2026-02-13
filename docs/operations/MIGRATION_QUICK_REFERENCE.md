---
owner: Platform Operations
escalation_path: 'On-call SRE -> Incident Commander -> Head of Engineering'
review_date: '2026-06-30'
---

# Migration Scripts - Quick Reference Card

## 🚀 Most Common Commands

### Initial Setup (First Time)
```bash
./infra/scripts/supabase-migrate-all.sh --verbose
```

### Apply New Migrations
```bash
./infra/scripts/supabase-migrate-all.sh --skip-init
```

### Check Status
```bash
./infra/scripts/migration-status.sh
```

### Validate Database
```bash
./infra/scripts/validate-migrations.sh
```

### Create Backup
```bash
./infra/scripts/rollback-migration.sh --backup
```

---

## 📋 All Available Scripts

| Script | Purpose | Common Usage |
|--------|---------|--------------|
| `supabase-migrate-all.sh` | Complete migration automation | `./supabase-migrate-all.sh --verbose` |
| `validate-migrations.sh` | Database validation | `./validate-migrations.sh` |
| `rollback-migration.sh` | Backup and rollback | `./rollback-migration.sh --backup` |
| `migration-status.sh` | Quick status check | `./migration-status.sh --watch` |

---

## 🎯 Common Options

### supabase-migrate-all.sh

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview without executing |
| `--skip-init` | Skip initialization scripts |
| `--skip-auth` | Skip authentication setup |
| `--with-seeds` | Apply seed data |
| `--force` | Re-apply all migrations |
| `--verbose` | Detailed output |
| `--validate-only` | Only validate, no changes |

---

## 🔥 Emergency Commands

### Quick Backup
```bash
./infra/scripts/rollback-migration.sh --backup
```

### List Applied Migrations
```bash
./infra/scripts/rollback-migration.sh --list
```

### Restore from Backup
```bash
./infra/scripts/rollback-migration.sh --restore /path/to/backup.sql
```

---

## 📊 Status Checks

### Watch Mode (Auto-refresh)
```bash
./infra/scripts/migration-status.sh --watch
```

### Full Validation Report
```bash
./infra/scripts/validate-migrations.sh > report.txt
```

### Check RLS Policies
```bash
psql -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';"
```

### Check Applied Migrations
```bash
psql -c "SELECT migration_id, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"
```

---

## 🔧 Troubleshooting

### Connection Issues
```bash
# Test connection
psql -h localhost -p 54323 -U postgres -d postgres

# Check Docker
docker ps | grep postgres
```

### Migration Errors
```bash
# Check logs
tail -f logs/migrations/migration_*.log

# Validate database
./infra/scripts/validate-migrations.sh
```

### Force Re-apply
```bash
./infra/scripts/supabase-migrate-all.sh --force --skip-init
```

---

## 📁 Important Paths

| Path | Description |
|------|-------------|
| `infra/postgres/migrations/` | Migration SQL files |
| `.devcontainer/init-scripts/` | Initialization scripts |
| `infra/supabase/init-auth.sql` | Auth setup |
| `logs/migrations/` | Migration logs |
| `backups/migrations/` | Database backups |

---

## 🔒 Security Checklist

- [ ] Backup before migrations: `./rollback-migration.sh --backup`
- [ ] Dry run in production: `--dry-run --env .env.production`
- [ ] Validate after migration: `./validate-migrations.sh`
- [ ] Check RLS policies: Look for "RLS" in validation report
- [ ] Monitor status: `./migration-status.sh --watch`

---

## 💡 Pro Tips

1. **Always backup before production migrations**
2. **Use `--dry-run` to preview changes**
3. **Test in shadow database first**
4. **Monitor with `--watch` during migrations**
5. **Keep validation reports for audit trail**
6. **Use `--verbose` for troubleshooting**

---

## 📞 Quick Help

```bash
# Show help for any script
./infra/scripts/supabase-migrate-all.sh --help
./infra/scripts/rollback-migration.sh --help
```

---

**Print this card and keep it handy!**
