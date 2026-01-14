# Fix: Application Error on Startup

## The Issue

The application shows "Something went wrong" because Supabase (the backend) isn't running.

## The Fix

**Run these commands in order:**

```bash
# 1. Start Supabase (backend database)
npx supabase start

# 2. Start the dev server
npm run dev
```

## Why This Happens

ValueOS needs Supabase running locally for:

- Authentication
- Database access
- Real-time features

The `npm run dev` command only starts the frontend. Supabase must be started separately.

---

## Complete Setup (First Time)

If this is your first time:

```bash
# 1. Run setup (creates .env, installs dependencies)
#    Runs scripts/dev/setup.sh (set START_DEV_SERVER=no to skip auto-start prompt)
npm run setup

# 2. Start Supabase
npx supabase start

# 3. Start dev server
npm run dev
```

---

## Daily Development Workflow

```bash
# Start Supabase (if not already running)
npx supabase start

# Start dev server
npm run dev
```

---

## Check if Supabase is Running

```bash
npx supabase status
```

Should show:

```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
```

---

## Stop Everything

```bash
# Stop dev server: Ctrl+C

# Stop Supabase
npx supabase stop
```

---

## Alternative: One Command to Start Everything

We can create a script that starts both. Add to `package.json`:

```json
"scripts": {
  "dev:all": "npx supabase start && npm run dev"
}
```

Then just run:

```bash
npm run dev:all
```

---

**Status**: This is a known issue. We should update the setup to start Supabase automatically.
