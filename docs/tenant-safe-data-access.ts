/**
 * @file docs/tenant-safe-data-access.ts
 * @description This file documents the code patterns for ensuring tenant-safe data access
 *              in a Supabase-powered application. The primary mechanism is Row-Level
 *              Security (RLS) policies in the database, activated by claims in a JWT.
 */

// ---
// PATTERN 1: DATABASE (PostgreSQL RLS)
//
// This is the most critical layer. Policies are defined in the migration script
// (`supabase/migrations/20251201120000_initial_schema.sql`).
// ---

--// Step 1.1: Create a helper function in SQL to extract the organization ID from the JWT.
--// This function should be created in your database via a migration.
CREATE OR REPLACE FUNCTION auth.get_current_org_id()
RETURNS UUID AS $$
BEGIN
  -- The 'request.jwt.claims' setting is populated by Supabase's PostgREST.
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::UUID;
EXCEPTION
  -- If the claim is missing or invalid, return null.
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

--// Step 1.2: Apply a policy to a tenant-scoped table.
--// This policy ensures that users can only access rows matching their organization ID.
CREATE POLICY org_isolation_models ON models
    USING (organization_id = auth.get_current_org_id());

--// Step 1.3: Enable Row Level Security on the table.
ALTER TABLE models ENABLE ROW LEVEL SECURITY;


// ---
// PATTERN 2: FRONTEND/CLIENT-SIDE DATA ACCESS (e.g., in a React Component)
//
// With RLS enabled, the frontend code doesn't need to manually add `where` clauses
// for tenant isolation. The database enforces it automatically based on the
// authenticated user's JWT.
// ---

import { supabase } from '../src/lib/supabase'; // Assuming you have a central Supabase client

async function getModelsForCurrentUser() {
  // The user must be authenticated with Supabase for this to work.
  // The JWT sent with the request will contain the 'org_id' claim.
  
  const { data: models, error } = await supabase
    .from('models')
    .select('*');

  if (error) {
    console.error('Error fetching models:', error);
    return [];
  }

  // `models` will *only* contain models for the user's organization,
  // because the RLS policy is automatically applied by the database.
  return models;
}


// ---
// PATTERN 3: SUPABASE EDGE FUNCTIONS
//
// Edge Functions must also respect tenancy. The user's JWT is passed to the
// function, and a new Supabase client should be created with that auth context.
// ---

// Example: supabase/functions/get-model-count/index.ts
import { createClient } from '@supabase/supabase-js';

// Deno.serve(async (req) => {
//   // Create a new Supabase client, inheriting the user's authorization.
//   const supabaseAdmin = createClient(
//     Deno.env.get('SUPABASE_URL')!,
//     Deno.env.get('SUPABASE_ANON_KEY')!,
//     { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
//   );

//   // The `.count()` query will respect the RLS policy of the calling user.
//   const { count, error } = await supabaseAdmin
//     .from('models')
//     .select('*', { count: 'exact', head: true });

//   if (error) {
//     return new Response(JSON.stringify({ error: error.message }), { status: 500 });
//   }

//   return new Response(JSON.stringify({ count }), {
//     headers: { 'Content-Type': 'application/json' },
//   });
// });

console.log("This is a documentation file. The Deno.serve call is commented out.");
