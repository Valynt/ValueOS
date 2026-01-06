# Integration Guide: Scalekit Authentication with Supabase

This guide outlines the step-by-step tasks to implementing a complete authentication flow where Scalekit handles the identity (Login, SSO, MFA) and Supabase handles the data storage and authorization via Row Level Security (RLS).

## Architecture Overview

To make Supabase RLS work, it needs a JSON Web Token (JWT) that it trusts. Since Scalekit issues its own tokens, we cannot send them directly to Supabase. Instead, we use a **Backend Minting pattern**:

1. **Client**: Redirects user to Scalekit for login.
2. **Scalekit**: Authenticates user and redirects back to your backend with a code.
3. **Backend**:
   - Exchanges code for Scalekit user details.
   - Mints a new Supabase-compatible JWT signed with your Supabase project's secret.
   - Upserts the user into a public profiles table in Supabase.
4. **Client**: Receives the Supabase-compatible JWT and uses it to talk to the database directly.

## Phase 1: Prerequisites & Configuration

### 1. Gather API Keys

Ensure you have the following credentials saved in your `.env` file:

- **Scalekit**: `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`
- **Supabase**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for admin tasks), `SUPABASE_JWT_SECRET` (crucial for minting tokens).

> **Note**: You can find the JWT Secret in Supabase Dashboard > Settings > API > JWT Settings.

### 2. Configure Scalekit

1. Log in to your Scalekit Dashboard.
2. Go to the API & Webhooks or Developer section.
3. Add your Redirect URI. This is the endpoint on your backend that will handle the login success.
   - Example: `http://localhost:3000/auth/callback`

### 3. Configure Supabase Database

You need a table to store user data. We will not use the private `auth.users` table since we are managing identity externally.

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create a public profiles table
create table public.profiles (
  id uuid primary key, -- Must be UUID to match auth.uid()
  email text not null,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Create a policy: Users can only see their own profile
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ( auth.uid() = id );

-- Create a policy: Users can update their own profile
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ( auth.uid() = id );
```

## Phase 2: The Backend Bridge (Node.js Example)

This is the most critical part. Your backend acts as the bridge that translates a Scalekit Identity into a Supabase Session.

### Required Packages

- `@scalekit-sdk/node`
- `@supabase/supabase-js`
- `jsonwebtoken`
- `uuid` (specifically `uuid/v5` for consistent IDs)

### Implementation

```javascript
import { Scalekit } from "@scalekit-sdk/node";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { v5 as uuidv5 } from "uuid";

// 1. Initialize Clients
const scalekit = new Scalekit(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Namespace for generating consistent UUIDs from Scalekit string IDs
const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

// 2. Login Endpoint (Frontend redirects here)
app.get("/auth/login", (req, res) => {
  const authorizationUrl = scalekit.getAuthorizationUrl(
    "http://localhost:3000/auth/callback", // Your Redirect URI
    { scopes: ["openid", "profile", "email"] }
  );
  res.redirect(authorizationUrl);
});

// 3. Callback Endpoint (Scalekit redirects here)
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  try {
    // A. Exchange code for Scalekit Token
    const { user, accessToken } = await scalekit.authenticateWithCode(
      code,
      "http://localhost:3000/auth/callback"
    );

    // B. Generate a deterministic UUID based on Scalekit's User ID
    // This ensures the same Scalekit user always gets the same Supabase UUID
    const supabaseUserId = uuidv5(user.id, UUID_NAMESPACE);

    // C. Sync User to Supabase (using Service Role)
    const { error } = await supabaseAdmin.from("profiles").upsert({
      id: supabaseUserId,
      email: user.email,
      full_name: user.name,
      avatar_url: user.avatarUrl,
      updated_at: new Date(),
    });

    if (error) throw error;

    // D. Mint Supabase-compatible JWT
    // This token allows the frontend to talk to Supabase as "authenticated"
    const supabaseToken = jwt.sign(
      {
        aud: "authenticated", // Required for RLS
        role: "authenticated", // Required for RLS
        sub: supabaseUserId, // The user ID matched in auth.uid()
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 1 week expiry
        app_metadata: {
          provider: "scalekit",
          scalekit_id: user.id,
        },
      },
      process.env.SUPABASE_JWT_SECRET
    );

    // E. Return token to frontend (e.g., set cookie or redirect with query param)
    // Ideally, set an HTTP-only cookie for security
    res.cookie("sb-access-token", supabaseToken, {
      httpOnly: true,
      secure: true,
    });
    res.redirect("http://localhost:3000/dashboard");
  } catch (err) {
    console.error("Login failed", err);
    res.redirect("/error");
  }
});
```

## Phase 3: Frontend Wiring

On the frontend, you need to initialize the Supabase client using the custom token you received from your backend.

### Initializing Supabase

```javascript
import { createClient } from "@supabase/supabase-js";

// Retrieve the token (e.g., from cookies or local storage depending on your flow)
const accessToken = getCookie("sb-access-token");

const supabase = createClient("YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY", {
  global: {
    headers: {
      // Inject the custom minted token
      Authorization: `Bearer ${accessToken}`,
    },
  },
  // Optional: disable auto-refresh since we are managing the token manually
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Now you can query data directly. RLS will work!
const { data, error } = await supabase.from("profiles").select("*").single();
```

## Phase 4: Verification

1. **Start the Flow**: Navigate to your `/auth/login` endpoint.
2. **Scalekit Login**: Complete the login on the hosted Scalekit page.
3. **Database Check**: Go to your Supabase Table Editor. You should see a new row in `public.profiles` with a UUID and the user's email.
4. **Frontend Check**: Your frontend app should be able to fetch that profile row.
5. **RLS Check**: Try to fetch another user's profile row (by hardcoding an ID). It should return an empty array or error, confirming RLS is protecting the data.

## Why this approach?

- **Security**: Supabase only trusts tokens signed with its own secret. By minting the token yourself, you control the claims.
- **Compatibility**: Using `uuidv5` ensures that even though Scalekit uses string IDs, Supabase's `auth.uid()` (which expects UUIDs) works perfectly in your SQL policies.
- **Performance**: The frontend talks directly to Supabase for data, utilizing the high-performance PostgREST API without needing to proxy every request through your backend.
