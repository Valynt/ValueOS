# Supabase Configuration

This directory contains all Supabase-related configurations and code for the ValueCanvas application.

## 📁 Directory Structure

```
supabase/
├── config.toml              # Supabase local development configuration
├── seed.sql                 # Seed data for local development
├── docker-compose.supabase.yml  # Docker configuration (if using)
│
├── migrations/              # Database schema migrations
│   ├── 20241122_add_workflow_state.sql
│   ├── 20241123110000_add_llm_monitoring.sql
│   ├── ... (45 migration files)
│   └── TEMPLATE_migration.sql
│
├── rollbacks/               # Rollback scripts for migrations
│   ├── README.md
│   ├── ROLLBACK_STRATEGY.md
│   ├── 20241123150000_rollback_semantic_memory.sql
│   └── ... (21 rollback scripts)
│
├── functions/               # Edge Functions (Serverless)
│   ├── check-password-breach/
│   ├── crm-oauth/
│   ├── llm-proxy/
│   ├── parse-document/
│   └── transcribe-audio/
│
└── tests/                   # Database tests
    └── database/
        └── validate_all_fixes.sql
```

## 🚀 Quick Start

### Local Development

```bash
# Start Supabase locally
supabase start

# Reset database (runs migrations + seed.sql)
supabase db reset

# Create new migration
supabase migration new my_migration_name

# Apply migrations
supabase db push
```

### Testing

```bash
# Run validation tests
psql $DATABASE_URL -f supabase/tests/database/validate_all_fixes.sql

# Check migration status
supabase migration list
```

## 📝 Migrations

### Naming Convention
Migrations follow the pattern: `YYYYMMDDHHMMSS_description.sql`

Example: `20241201120000_add_user_profiles.sql`

### Creating Migrations

```bash
# Generate new migration with timestamp
supabase migration new add_feature_name

# Edit the generated file
# Then apply it
supabase db push
```

### Migration Guidelines

1. **Always test locally first**
2. **Include rollback script** in `rollbacks/` directory
3. **Add verification checks** at end of migration
4. **Document breaking changes** in commit message
5. **Use transactions** (BEGIN/COMMIT) for safety

## 🔄 Rollbacks

Rollback scripts are located in `rollbacks/` directory.

**To rollback a migration:**

```bash
# Apply rollback script
psql $DATABASE_URL -f supabase/rollbacks/YYYYMMDD_rollback_name.sql

# Remove from migration tracking
psql $DATABASE_URL -c "DELETE FROM supabase_migrations.schema_migrations WHERE version = 'YYYYMMDDHHMMSS';"
```

**See:** `rollbacks/ROLLBACK_STRATEGY.md` for complete rollback procedures.

## ⚡ Edge Functions

Edge Functions are deployed TypeScript functions that run on Deno.

### Development

```bash
# Serve function locally
supabase functions serve function-name

# Deploy to production
supabase functions deploy function-name

# View logs
supabase functions logs function-name
```

### Available Functions

- **check-password-breach** - Validates passwords against breach database
- **crm-oauth** - Handles CRM OAuth flows
- **llm-proxy** - Proxies LLM requests with rate limiting
- **parse-document** - Parses documents for ingestion
- **transcribe-audio** - Transcribes audio files

## 🌱 Seed Data

The `seed.sql` file contains data that's loaded on every `supabase db reset`.

**Use for:**
- Default roles and permissions
- Test users
- Sample data for development

**Don't use for:**
- Production data
- Secrets
- User-specific data

## 🧪 Testing

Database tests are in `tests/database/`.

### Running Tests

```bash
# Validation suite
psql $DATABASE_URL -f supabase/tests/database/validate_all_fixes.sql
```

## 📚 Documentation

For detailed documentation, see:
- `docs/migrations/` - Migration guides and reviews
- `rollbacks/README.md` - Rollback procedures
- `docs/MIGRATION_STRATEGIES.md` - Best practices

## 🔒 Security

### RLS (Row Level Security)
All user-facing tables have RLS enabled. See migration files for policies.

### Secrets Management
- Use environment variables for secrets
- Never commit credentials
- Use Supabase vault for sensitive data

## 🐛 Troubleshooting

### Migration Fails

```bash
# Check current state
supabase migration list

# View migration output with debug
supabase db push --debug

# Reset if needed
supabase db reset
```

### Function Errors

```bash
# Check logs
supabase functions logs function-name --tail

# Test locally
supabase functions serve function-name
curl http://localhost:54321/functions/v1/function-name
```

## 📞 Support

- **Issues:** See `docs/migrations/COMPLETE_VALIDATION_REPORT.md`
- **Rollbacks:** See `rollbacks/ROLLBACK_STRATEGY.md`
- **Migrations:** See `docs/MIGRATION_STRATEGIES.md`

---

**Last Updated:** December 1, 2025  
**Version:** 1.0.0
