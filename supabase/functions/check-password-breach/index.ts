// Phase 1: Password Breach Check using HaveIBeenPwned API
// Uses k-anonymity model - only sends first 5 chars of SHA-1 hash

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { password } = await req.json();

    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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
      const [hash, count] = line.split(':');
      return hash === suffix;
    });

    return new Response(
      JSON.stringify({
        breached,
        message: breached
          ? 'This password has been exposed in a data breach'
          : 'Password not found in known breaches',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Password breach check error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to check password breach',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
