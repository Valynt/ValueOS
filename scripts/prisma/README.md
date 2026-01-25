# ValueCanvas Database Management

Complete database schema management, migrations, and seeding using Prisma.

## 📋 Overview

ValueCanvas uses **Prisma** as the ORM and migration tool, integrated with **Supabase PostgreSQL**. This provides:

- Type-safe database access
- Automated migrations
- Schema versioning
- Seed data management
- Multi-tenancy support

## 🏗️ Schema Overview

### Core Tables

**Organizations** - Multi-tenant isolation
- Tiers: FREE, PRO, ENTERPRISE
- Feature flags and limits
- Soft delete support

**Users** - Organization-scoped users
- Roles: ADMIN, MANAGER, MEMBER
- Status: ACTIVE, INACTIVE, INVITED, SUSPENDED
- Email validation

**API Keys** - Service authentication
- Scoped permissions
- Rate limiting
- Expiration support

**Audit Logs** - Compliance tracking
- All CRUD operations
- IP and user agent tracking
- Change history

### Application Tables

**Agents** - AI agent definitions
- Agent types (opportunity, target, realization, etc.)
- Configuration and versioning
- Active/inactive status

**Executions** - Agent execution history
- Status tracking
- Input/output storage
- Error logging

**Models** - Canvas templates
- Schema definitions
- Version control
- Published status

**Canvases** - User-created canvases
- Model-based structure
- Sharing capabilities
- Version history

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Database URL

```bash
# .env
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

### 3. Run Migrations

```bash
# Development
pnpm run db:migrate

# Or using script
./scripts/db-migrate.sh development
```

### 4. Seed Database

```bash
# Development
pnpm run db:seed

# Or using script
./scripts/db-seed.sh development
```

### 5. Generate Prisma Client

```bash
pnpm prisma generate
```

## 📝 Migration Workflow

### Create New Migration

```bash
# 1. Modify schema.prisma
# 2. Create migration
pnpm prisma migrate dev --name add_new_feature

# 3. Review generated SQL in prisma/migrations/
# 4. Test migration
pnpm run db:migrate

# 5. Commit migration files
git add prisma/migrations/
git commit -m "feat: add new feature migration"
```

### Deploy Migrations

**Staging:**
```bash
DATABASE_URL=$STAGING_DATABASE_URL ./scripts/db-migrate.sh staging
```

**Production:**
```bash
DATABASE_URL=$PROD_DATABASE_URL ./scripts/db-migrate.sh production
```

### Check Migration Status

```bash
pnpm prisma migrate status
```

### Rollback Migration

```bash
# Prisma doesn't support automatic rollback
# Manual rollback required:

# 1. Identify migration to rollback
pnpm prisma migrate status

# 2. Create rollback SQL
# See: prisma/migrations/YYYYMMDDHHMMSS_migration_name/migration.sql

# 3. Write reverse migration
# 4. Apply manually or create new migration
```

## 🌱 Seed Data

### Development Seed

Creates:
- 3 organizations (Demo, Enterprise, Startup)
- 5 users with different roles
- 3 AI agents
- 2 canvas models
- 2 sample canvases
- Sample executions and audit logs

**Credentials:**
- Admin: `admin@demo-org.com` / `Demo123!@#`
- Manager: `manager@demo-org.com` / `Demo123!@#`
- Member: `member@demo-org.com` / `Demo123!@#`

### Custom Seed Data

Edit `prisma/seed.ts` to add custom data:

```typescript
await prisma.organization.create({
  data: {
    name: 'My Organization',
    slug: 'my-org',
    tier: 'PRO',
    // ...
  },
});
```

### Staging Seed

```bash
NODE_ENV=staging ./scripts/db-seed.sh staging
```

### Production Seed

⚠️ **Only run on initial setup!**

```bash
NODE_ENV=production ./scripts/db-seed.sh production
```

## 🔍 Prisma Studio

Visual database browser:

```bash
pnpm prisma studio
```

Opens at: http://localhost:5555

## 📊 Database Schema

### Entity Relationship Diagram

```
Organizations (1) ──┬──> (N) Users
                    ├──> (N) API Keys
                    ├──> (N) Audit Logs
                    ├──> (N) Agents
                    ├──> (N) Models
                    ├──> (N) Canvases
                    └──> (N) Executions

Users (1) ──┬──> (N) API Keys
            ├──> (N) Audit Logs
            └──> (N) Canvases

Agents (1) ──> (N) Executions

Models (1) ──> (N) Canvases
```

### Multi-Tenancy

All tables include `organization_id` for tenant isolation:

```sql
-- Row Level Security (RLS) enabled
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ... etc
```

## 🔐 Security Features

### Row Level Security (RLS)

Enabled on all tables for Supabase integration.

### Soft Deletes

Tables with `deleted_at`:
- Organizations
- Users
- Agents
- Models
- Canvases

Query non-deleted records:

```typescript
await prisma.user.findMany({
  where: {
    deletedAt: null,
  },
});
```

### Audit Logging

All changes tracked in `audit_logs`:

```typescript
await prisma.auditLog.create({
  data: {
    organizationId: org.id,
    userId: user.id,
    action: 'update',
    resourceType: 'canvas',
    resourceId: canvas.id,
    changes: {
      before: oldData,
      after: newData,
    },
  },
});
```

## 📦 Backup & Restore

### Create Backup

```bash
# Manual backup
pg_dump $DATABASE_URL > backups/backup-$(date +%Y%m%d).sql

# Automated (runs before production migrations)
./scripts/db-migrate.sh production
```

### Restore Backup

```bash
psql $DATABASE_URL < backups/backup-20241206.sql
```

### Automated Backups

Set up automated backups in Supabase dashboard or use:

```bash
# Cron job (daily at 2 AM)
0 2 * * * pg_dump $DATABASE_URL > /backups/daily-$(date +%Y%m%d).sql
```

## 🧪 Testing

### Test Migrations

```bash
# Create test database
createdb valuecanvas_test

# Run migrations
DATABASE_URL="postgresql://localhost/valuecanvas_test" pnpm prisma migrate deploy

# Run tests
pnpm test

# Cleanup
dropdb valuecanvas_test
```

### Migration Tests

```typescript
import { PrismaClient } from '@prisma/client';

describe('Database Migrations', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  it('should have all tables', async () => {
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `;
    
    expect(tables).toContainEqual({ tablename: 'organizations' });
    expect(tables).toContainEqual({ tablename: 'users' });
    // ...
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
```

## 🔧 Troubleshooting

### Migration Failed

```bash
# Check status
pnpm prisma migrate status

# Reset database (development only!)
pnpm prisma migrate reset

# Force deploy
pnpm prisma migrate deploy --force
```

### Schema Drift

```bash
# Check for drift
pnpm prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource $DATABASE_URL

# Resolve drift
pnpm prisma db pull  # Pull from database
# or
pnpm prisma db push  # Push to database (development only)
```

### Connection Issues

```bash
# Test connection
pnpm prisma db execute --stdin <<< "SELECT 1"

# Check DATABASE_URL
echo $DATABASE_URL

# Verify credentials
psql $DATABASE_URL -c "SELECT version()"
```

### Prisma Client Not Generated

```bash
# Regenerate client
pnpm prisma generate

# Clear cache
rm -rf node_modules/.prisma
pnpm install
```

## 📚 Best Practices

### 1. Always Review Migrations

Before deploying, review generated SQL:

```bash
cat prisma/migrations/YYYYMMDDHHMMSS_migration_name/migration.sql
```

### 2. Test Migrations Locally

```bash
# Test on local database first
DATABASE_URL="postgresql://localhost/valuecanvas_dev" pnpm prisma migrate deploy
```

### 3. Backup Before Production Migrations

Automated in `db-migrate.sh`, but verify:

```bash
ls -lh backups/
```

### 4. Use Transactions

Prisma automatically wraps migrations in transactions.

### 5. Version Control

Always commit migration files:

```bash
git add prisma/migrations/
git add prisma/schema.prisma
```

### 6. Document Schema Changes

Add comments to schema.prisma:

```prisma
model User {
  // Added for GDPR compliance
  deletedAt DateTime? @map("deleted_at")
}
```

### 7. Monitor Migration Performance

```bash
# Time migrations
time pnpm prisma migrate deploy
```

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
- name: Run Migrations
  run: |
    pnpm prisma generate
    pnpm prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Pre-deployment Checks

```bash
# Validate schema
pnpm prisma validate

# Check for drift
pnpm prisma migrate status

# Run tests
pnpm test
```

## 📖 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Supabase + Prisma](https://supabase.com/docs/guides/integrations/prisma)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🆘 Support

For issues or questions:
1. Check Prisma logs: `pnpm prisma --help`
2. Review migration status: `pnpm prisma migrate status`
3. Check this documentation
4. Contact DevOps team
