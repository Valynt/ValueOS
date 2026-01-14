# Seed Scripts Guide

**Date**: January 5, 2026  
**Status**: ✅ Secure and Ready to Use  
**Priority**: CRITICAL FIX COMPLETE

---

## Overview

All seed scripts have been updated to remove hardcoded credentials and add security checks. They now:

✅ Generate secure random passwords  
✅ Use proper bcrypt hashing  
✅ Block execution in production  
✅ Support environment variables  
✅ Only log credentials in development  

---

## Available Seed Scripts

### 1. TypeScript Seed (Supabase)

**File**: `scripts/seed_database.ts`  
**Purpose**: Seeds development database with test organizations, users, agents, and data  
**Database**: Supabase (direct SQL)

**Usage**:
```bash
# Basic usage (generates random passwords)
npx tsx scripts/seed_database.ts

# With custom passwords
SEED_ADMIN_PASSWORD="MySecurePass123!" \
SEED_USER_PASSWORD="UserPass456!" \
SEED_CSO_PASSWORD="CsoPass789!" \
npx tsx scripts/seed_database.ts
```

**What it creates**:
- 2 organizations (Acme Corp, TechStart Inc)
- 3 users with secure passwords
- 4 agents (research, analysis, modeling, narrative)
- 5 agent runs
- 1 value model
- 3 KPIs
- 1 API key

**Credentials logged** (development only):
```
Admin: admin@acme.com / [random-password]
User:  user@acme.com / [random-password]
CSO:   cso@techstart.com / [random-password]
API Key: sk_dev_[random-hex]
```

---

### 2. Prisma Seed

**File**: `prisma/seed.ts`  
**Purpose**: Seeds database using Prisma ORM  
**Database**: Any Prisma-compatible database

**Usage**:
```bash
# Basic usage
npx prisma db seed

# With custom passwords
SEED_ADMIN_PASSWORD="AdminPass123!" \
SEED_MANAGER_PASSWORD="ManagerPass456!" \
SEED_MEMBER_PASSWORD="MemberPass789!" \
SEED_ENTERPRISE_PASSWORD="EnterprisePass!" \
SEED_FREE_PASSWORD="FreePass!" \
npx prisma db seed
```

**What it creates**:
- 3 organizations (Demo, Enterprise, Startup)
- 5 users with secure passwords
- Multiple agents
- Test data for all entities

**Credentials logged** (development only):
```
Admin:      admin@demo-org.com / [random-password]
Manager:    manager@demo-org.com / [random-password]
Member:     member@demo-org.com / [random-password]
Enterprise: admin@enterprise-corp.com / [random-password]
Startup:    founder@startup-inc.com / [random-password]
```

---

### 3. SQL Seed (Dummy User)

**File**: `scripts/seeds/create_dummy_user.sql`  
**Purpose**: Creates a single dummy user for testing  
**Database**: PostgreSQL/Supabase

**Usage**:
```bash
# Run directly
psql $DATABASE_URL -f scripts/seeds/create_dummy_user.sql

# Or via Supabase CLI
supabase db execute -f scripts/seeds/create_dummy_user.sql
```

**What it creates**:
- 1 dummy user (dev+dummy@localhost)
- Optional profile entry

**Note**: Use Supabase Auth to set password after creation.

---

## Security Features

### 1. Environment Validation

All scripts check the environment before running:

```typescript
// TypeScript scripts
if (NODE_ENV === 'production') {
  console.error('❌ SECURITY: Cannot run seed script in production!');
  process.exit(1);
}
```

```sql
-- SQL scripts
IF current_setting('app.environment', true) = 'production' THEN
  RAISE EXCEPTION 'SECURITY: Cannot run seed script in production!';
END IF;
```

### 2. Secure Password Generation

```typescript
// Generate random password
function generateSecurePassword(length: number = 16): string {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

// Hash with bcrypt
const passwordHash = await bcrypt.hash(password, 10);
```

### 3. Secure API Key Generation

```typescript
function generateApiKey(): string {
  return `sk_dev_${crypto.randomBytes(32).toString('hex')}`;
}
```

### 4. Conditional Logging

Credentials are ONLY logged in development:

```typescript
if (NODE_ENV === 'development') {
  console.log('📝 Test User Credentials (save these):');
  console.log('  Admin: admin@acme.com / ' + adminPassword);
}
```

---

## Environment Variables

### Supported Variables

**TypeScript Seed** (`scripts/seed_database.ts`):
```bash
SEED_ADMIN_PASSWORD=<password>    # Admin user password
SEED_USER_PASSWORD=<password>     # Regular user password
SEED_CSO_PASSWORD=<password>      # CSO user password
SUPABASE_URL=<url>                # Supabase project URL
SUPABASE_SERVICE_KEY=<key>        # Service role key
NODE_ENV=development              # Environment (blocks production)
```

**Prisma Seed** (`prisma/seed.ts`):
```bash
SEED_ADMIN_PASSWORD=<password>       # Admin user password
SEED_MANAGER_PASSWORD=<password>     # Manager user password
SEED_MEMBER_PASSWORD=<password>      # Member user password
SEED_ENTERPRISE_PASSWORD=<password>  # Enterprise admin password
SEED_FREE_PASSWORD=<password>        # Free tier user password
NODE_ENV=development                 # Environment (blocks production)
```

### Example .env File

```bash
# .env.development
NODE_ENV=development
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=your-service-key-here

# Optional: Set specific passwords (otherwise random)
SEED_ADMIN_PASSWORD=DevAdmin123!
SEED_USER_PASSWORD=DevUser456!
SEED_CSO_PASSWORD=DevCso789!
```

---

## Testing

### Run Test Suite

```bash
# Test all seed scripts for security issues
./scripts/test-seed-scripts.sh
```

**Tests performed**:
- ✅ Files exist
- ✅ No hardcoded passwords
- ✅ No hardcoded API keys
- ✅ No predictable UUIDs
- ✅ Environment validation present
- ✅ Secure password generation
- ✅ Bcrypt usage
- ✅ Environment variable support
- ✅ Conditional credential logging

---

## Best Practices

### DO ✅

1. **Always run in development/test environments**
   ```bash
   NODE_ENV=development npx tsx scripts/seed_database.ts
   ```

2. **Use environment variables for passwords**
   ```bash
   SEED_ADMIN_PASSWORD="SecurePass123!" npx tsx scripts/seed_database.ts
   ```

3. **Save generated credentials**
   ```bash
   npx tsx scripts/seed_database.ts | tee seed-output.txt
   ```

4. **Test scripts before using**
   ```bash
   ./scripts/test-seed-scripts.sh
   ```

5. **Use different passwords per environment**
   ```bash
   # Development
   SEED_ADMIN_PASSWORD="DevPass123!"
   
   # Staging
   SEED_ADMIN_PASSWORD="StagingPass456!"
   ```

### DON'T ❌

1. **Never run in production**
   ```bash
   # This will fail (good!)
   NODE_ENV=production npx tsx scripts/seed_database.ts
   ```

2. **Never commit credentials to git**
   ```bash
   # Add to .gitignore
   .env.local
   seed-output.txt
   ```

3. **Never use hardcoded passwords**
   ```typescript
   // ❌ BAD
   const password = 'password123';
   
   // ✅ GOOD
   const password = generateSecurePassword();
   ```

4. **Never log credentials in production**
   ```typescript
   // ❌ BAD
   console.log('Password:', password);
   
   // ✅ GOOD
   if (NODE_ENV === 'development') {
     console.log('Password:', password);
   }
   ```

---

## Troubleshooting

### "Cannot run seed script in production"

**Cause**: Script detected production environment  
**Solution**: This is intentional! Only run seeds in development/test

```bash
# Verify environment
echo $NODE_ENV

# Run in development
NODE_ENV=development npx tsx scripts/seed_database.ts
```

### "SUPABASE_SERVICE_KEY must be set"

**Cause**: Missing service role key  
**Solution**: Set environment variable

```bash
# Get from Supabase dashboard
export SUPABASE_SERVICE_KEY="your-service-key"

# Or use .env file
echo "SUPABASE_SERVICE_KEY=your-key" >> .env
```

### Passwords not being logged

**Cause**: Not in development environment  
**Solution**: Set NODE_ENV

```bash
NODE_ENV=development npx tsx scripts/seed_database.ts
```

### "User already exists" error

**Cause**: Seed script already run  
**Solution**: Clear database first

```bash
# Supabase
supabase db reset

# Or manually delete users
psql $DATABASE_URL -c "DELETE FROM users WHERE email LIKE '%@acme.com';"
```

---

## Migration from Old Scripts

### Before (Insecure)

```typescript
// ❌ OLD: Hardcoded credentials
const users = [{
  email: 'admin@acme.com',
  password_hash: 'hashed_pwd_1',  // Placeholder
}];
```

### After (Secure)

```typescript
// ✅ NEW: Secure generation
const password = process.env.SEED_ADMIN_PASSWORD || generateSecurePassword();
const password_hash = await bcrypt.hash(password, 10);

const users = [{
  email: 'admin@acme.com',
  password_hash,
}];

// Log only in development
if (NODE_ENV === 'development') {
  console.log('Admin password:', password);
}
```

---

## Checklist

### Before Running Seeds

- [ ] Verify environment is development/test
- [ ] Set SUPABASE_SERVICE_KEY
- [ ] Set NODE_ENV=development
- [ ] Optionally set custom passwords
- [ ] Run test suite: `./scripts/test-seed-scripts.sh`

### After Running Seeds

- [ ] Save generated credentials
- [ ] Verify users were created
- [ ] Test login with generated passwords
- [ ] Verify API keys work
- [ ] Document credentials securely

### Before Committing

- [ ] No hardcoded credentials in code
- [ ] No credentials in .env files (use .env.example)
- [ ] Test scripts pass
- [ ] Documentation updated

---

## Files Modified

1. **scripts/seed_database.ts** - Fixed hardcoded passwords and API keys
2. **scripts/seeds/create_dummy_user.sql** - Added environment checks
3. **prisma/seed.ts** - Fixed hardcoded passwords, added secure generation
4. **scripts/test-seed-scripts.sh** - New test suite
5. **docs/database/SEED_SCRIPTS_GUIDE.md** - This documentation

---

## Support

**Issues?**
1. Run test suite: `./scripts/test-seed-scripts.sh`
2. Check environment variables
3. Verify NODE_ENV is set
4. Review error messages

**Questions?**
- See: `docs/database/PRE_RELEASE_AUDIT_2026-01-05.md`
- See: `docs/database/CRITICAL_FIXES_CHECKLIST.md`

---

**Last Updated**: January 5, 2026  
**Status**: Production Ready  
**Security**: ✅ All hardcoded credentials removed
