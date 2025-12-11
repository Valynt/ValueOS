-- ==========================================================================
-- Minimal organizations + organization_members baseline for test runs
-- This migration is intentionally early (20251201...) so integration test
-- runners can apply dependent migrations that reference `organizations`
-- It is safe to run in environments with the full baseline because it
-- uses IF NOT EXISTS semantics.
-- ==========================================================================

BEGIN;

-- Ensure necessary extensions for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Minimal organizations table (id only + basic metadata)
CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  slug TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal users table may already be provided by Auth; keep lightweight fallback
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal organization_members used by RLS checks in later migrations
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
