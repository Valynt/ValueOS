# OAuth Security Configuration

ValueOS uses Supabase Auth for OAuth providers (Google, Apple, GitHub). This document details the security measures in place.

## PKCE (Proof Key for Code Exchange)

ValueOS uses `@supabase/supabase-js` v2.89.0+, which uses PKCE flow by default for all auth operations.

- **Status:** ✅ Enabled by default
- **Implementation:** Handled internally by Supabase SDK
- **Verification:**
  - Client initiates auth with `code_challenge` and `code_challenge_method`.
  - Callback exchanges `code` and `code_verifier`.

## State Parameter

Supabase Auth handles the `state` parameter automatically to prevent CSRF attacks.

- **Status:** ✅ Enabled by default
- **Flow:**
  1. SDK generates random state.
  2. Stores state in local storage/cookie.
  3. Sends state to provider.
  4. Provider returns state in callback.
  5. SDK verifies state matches stored value.

## Redirect URLs

Redirect URLs are strictly allowlisted in the Supabase Dashboard.

- **Allowed URLs:**
  - `http://localhost:5173/auth/callback` (Development)
  - `https://[project].supabase.co/auth/v1/callback` (Production)

## Configuration in Code

**File:** `src/services/AuthService.ts`

```typescript
async signInWithProvider(provider: "google" | "apple" | "github"): Promise<void> {
  // ...
  await this.supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline", // Requests refresh token
        prompt: "consent",      // Forces consent screen
      },
    },
  });
}
```

## Security Recommendations

1. **Strict Redirects:** Ensure Supabase project settings only allow the exact callback URLs needed.
2. **Scopes:** Only request minimum required scopes.
3. **provider_token:** Do not expose `provider_token` to client unless necessary.
