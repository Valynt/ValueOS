# ValueOS Dev Container - Quick Setup Guide

## ✅ Container Status: OPERATIONAL

Your dev container is **ready to use**! Follow these steps to get started.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Verify Container Health

```bash
bash /usr/local/bin/healthcheck
```

Expected output: `✓ Container is healthy`

### Step 2: Check Environment

```bash
# Verify tools are installed
node --version    # Should show v20.x
npm --version     # Should show v11.x
npx supabase --version  # Should show v2.70.x

# Check dependencies
ls node_modules   # Should list packages
```

### Step 3: Start Local Supabase

```bash
# Start Supabase local instance
npx supabase start

# This will:
# - Start PostgreSQL on port 54322
# - Start Supabase Studio on port 54323
# - Start Supabase API on port 54321
# - Apply all migrations
```

### Step 4: Apply Database Migrations

```bash
# Push Prisma schema to database
npm run db:push

# Or use Supabase migrations
npx supabase db push
```

### Step 5: Start Development Server

```bash
# Start frontend dev server
npm run dev

# Access at: http://localhost:5173
```

### Step 6: (Optional) Start Backend API

```bash
# In a new terminal
npm run backend:dev

# Access at: http://localhost:3000
```

---

## 🎯 Common Commands

### Development

```bash
npm run dev              # Start frontend dev server
npm run backend:dev      # Start backend API server
npm test                 # Run test suite
npm run build            # Build for production
npm run lint             # Check code quality
npm run lint:fix         # Auto-fix lint issues
```

### Database

```bash
npm run db:push          # Apply Prisma schema changes
npm run db:types         # Generate TypeScript types
npm run db:studio        # Open Prisma Studio
npx supabase db push     # Apply Supabase migrations
npx supabase studio      # Open Supabase Studio
```

### Supabase

```bash
npx supabase start       # Start local Supabase
npx supabase stop        # Stop local Supabase
npx supabase status      # Check status
npx supabase db reset    # Reset database (DESTRUCTIVE)
```

### Testing

```bash
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:e2e         # E2E tests
npm run test:rls         # Test database RLS policies
npm run test:a11y        # Accessibility tests
npm run test:coverage    # Generate coverage report
```

### Code Quality

```bash
npm run lint             # Check for issues
npm run lint:fix         # Auto-fix issues
npm run type-check       # TypeScript type checking
npm run format           # Format code with Prettier
```

---

## 📁 Project Structure

```
/workspaces/ValueOS/
├── src/                      # Application source code
│   ├── components/           # React components
│   ├── views/                # Page-level views
│   ├── services/             # Business logic
│   ├── lib/                  # Shared libraries
│   ├── backend/              # Express API server
│   └── main.tsx              # Frontend entry point
├── supabase/                 # Supabase config & migrations
│   ├── migrations/           # SQL migrations
│   └── tests/                # Database tests
├── tests/                    # Test suites
├── docs/                     # Documentation
├── .devcontainer/            # Dev container configuration
└── .env.local                # Local environment config
```

---

## ⚙️ Environment Configuration

Your `.env.local` is already configured with development defaults:

### Supabase (Local)

```bash
VITE_SUPABASE_URL=http://host.docker.internal:54321
VITE_SUPABASE_ANON_KEY=<development key>
```

### Database (Local)

```bash
POSTGRES_DB=valuecanvas
POSTGRES_USER=valuecanvas
POSTGRES_PASSWORD=valuecanvas_dev_password_CHANGE_ME
```

### LLM Provider

```bash
VITE_LLM_PROVIDER=together
VITE_LLM_API_KEY=<your key>
```

**⚠️ Important**: These are **development defaults**. Never use in production!

---

## 🔧 Useful Aliases (Pre-configured)

The container includes these helpful aliases:

```bash
dc          # docker-compose
k           # kubectl
tf          # terraform
npm-clean   # rm -rf node_modules && npm install
dev         # npm run dev
test        # npm test
build       # npm run build
lint        # npm run lint
db          # npm run db:push

# Git aliases
gs          # git status
ga          # git add
gc          # git commit
gp          # git push
gl          # git log --oneline --graph --decorate

# Navigation
ws          # cd /workspace
```

---

## 🐛 Troubleshooting

### Issue: Port already in use

```bash
# Find process using port
sudo lsof -i :5173

# Kill process
sudo kill -9 <PID>
```

### Issue: node_modules missing

```bash
# Install dependencies
npm install

# Or clean install
npm ci
```

### Issue: Database connection failed

```bash
# Check if Supabase is running
npx supabase status

# Start Supabase
npx supabase start

# Reset database (if needed)
npx supabase db reset
```

### Issue: Prisma client not found

```bash
# Generate Prisma client
npx prisma generate
```

### Issue: TypeScript errors

```bash
# Regenerate types
npm run db:types

# Check tsconfig
npm run type-check
```

### Issue: Slow performance

```bash
# Clear caches
rm -rf .cache dist node_modules/.cache

# Restart dev server
# Ctrl+C then npm run dev
```

---

## 🔒 Security Reminders

1. **Never commit real API keys** to version control
2. **Update default passwords** before deploying
3. **Use environment-specific .env files**
4. **Run security scans**: `npm run security:scan`
5. **Keep dependencies updated**: `npm audit fix`

---

## 📊 Health Checks

Run these periodically to ensure everything is working:

```bash
# Container health
bash /usr/local/bin/healthcheck

# Dependency audit
npm audit

# Test suite
npm test

# Lint check
npm run lint

# Type check
npm run type-check

# Database connection
npx supabase status
```

---

## 🎓 Learning Resources

### Documentation

- Project Docs: `/docs`
- API Docs: `/docs/API.md`
- Architecture: `/docs/ARCHITECTURE.md`
- Security: `.devcontainer/SECURITY_IMPROVEMENTS.md`

### Useful Links

- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)
- [Prisma Docs](https://www.prisma.io/docs)

---

## 🚨 Emergency Commands

### Container Issues

```bash
# Rebuild container (from VS Code)
# Ctrl+Shift+P > Dev Containers: Rebuild Container

# Or manually
docker stop valuecanvas-dev-optimized
docker rm valuecanvas-dev-optimized
# Then reopen in VS Code
```

### Database Issues

```bash
# Reset everything (DESTRUCTIVE)
npx supabase db reset

# Apply migrations fresh
npx supabase db push
npm run db:push
```

### Dependency Issues

```bash
# Nuclear option - clean install
rm -rf node_modules package-lock.json
npm install
```

---

## ✅ Verification Checklist

Before starting development, verify:

- [ ] Container health check passes
- [ ] Node.js and npm are installed
- [ ] Supabase CLI is available
- [ ] `node_modules` directory exists
- [ ] `.env.local` file exists
- [ ] Supabase is running (`npx supabase status`)
- [ ] Database migrations applied
- [ ] Dev server starts (`npm run dev`)
- [ ] Tests pass (`npm test`)

---

## 🎉 You're Ready!

Your development environment is fully configured and operational.

**Next Steps**:

1. Run `npx supabase start` to start local database
2. Run `npm run dev` to start the dev server
3. Open http://localhost:5173 in your browser
4. Start coding! 🚀

**Need Help?**

- Check `/docs` for detailed documentation
- See `.devcontainer/DEV_CONTAINER_STATUS.md` for container details
- Run `npm run --help` to see all available commands

---

**Last Updated**: 2025-12-30  
**Container Version**: 1.0.0  
**Status**: ✅ Operational
