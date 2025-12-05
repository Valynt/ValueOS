// Phase 1: Password Breach Check using HaveIBeenPwned API
// Uses k-anonymity model - only sends first 5 chars of SHA-1 hash

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  corsError,
  corsResponse,
  handleCors,
} from '../_shared/cors.ts';
import {
  createServiceClient,
  extractJWT,
  verifyEnv,
} from '../_shared/database.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    verifyEnv();

    if (req.method !== 'POST') {
      return corsError('Method not allowed', 405);
    }

    let payload: { password?: unknown };
    try {
      payload = await req.json();
    } catch {
      return corsError('Invalid JSON body', 400);
    }

    const { password } = payload;

    if (!password || typeof password !== 'string') {
      return corsError('Password is required', 400);
    }

    const supabase = createServiceClient();
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let existingAppMetadata: Record<string, unknown> = {};

    if (authHeader) {
      try {
        const jwt = extractJWT(authHeader);
        const { data, error } = await supabase.auth.getUser(jwt);
        if (error) throw error;
        userId = data.user?.id ?? null;
        existingAppMetadata =
          (data.user?.app_metadata as Record<string, unknown>) ?? {};
      } catch (error) {
        console.warn('Unable to resolve user for custom claims', error);
      }
    }

    // SHA-1 hash the password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    // Use k-anonymity: only send first 5 characters
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    console.log(`Checking password breach for hash prefix: ${prefix}`);

    // Query HaveIBeenPwned API
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          'User-Agent': 'ValueCanvas-PasswordCheck',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HIBP API returned ${response.status}`);
    }

    const text = await response.text();

    // Check if our hash suffix is in the list
    const breached = text.split('\n').some((line) => {
      const [hash] = line.split(':');
      return hash === suffix;
    });

    const customClaims = {
      // Ensures JWT claim is present for RLS enforcement
      password_breached: breached,
      mfa_verified: Boolean(existingAppMetadata?.mfa_verified ?? false),
    };

    if (userId) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          app_metadata: {
            ...existingAppMetadata,
            ...customClaims,
          },
        }
      );

      if (updateError) {
        console.error('Failed to persist custom claims', updateError);
      }
    }

    return corsResponse(
      {
        breached,
        message: breached
          ? 'This password has been exposed in a data breach'
          : 'Password not found in known breaches',
        customClaims,
      },
      200,
      {
        'X-Supabase-Custom-Claims': JSON.stringify(customClaims),
      }
    );
  } catch (error) {
    console.error('Password breach check error:', error);

    return corsResponse(
      {
        error: 'Failed to check password breach',
        details: error.message,
      },
      500
    );
  }
});
