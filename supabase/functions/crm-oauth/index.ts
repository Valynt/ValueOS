/**
 * CRM OAuth Edge Function
 * 
 * Handles OAuth flows for HubSpot and Salesforce.
 * - Initiates OAuth by redirecting to provider
 * - Handles callback and exchanges code for tokens
 * - Stores tokens in tenant_integrations table
 * - Refreshes expired tokens
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// Types
// ============================================================================

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
  // HubSpot specific
  hub_domain?: string;
  hub_id?: number;
  // Salesforce specific
  instance_url?: string;
  id?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const HUBSPOT_CONFIG: OAuthConfig = {
  clientId: Deno.env.get('HUBSPOT_CLIENT_ID') || '',
  clientSecret: Deno.env.get('HUBSPOT_CLIENT_SECRET') || '',
  redirectUri: Deno.env.get('HUBSPOT_REDIRECT_URI') || '',
  scopes: [
    'crm.objects.contacts.read',
    'crm.objects.deals.read',
    'crm.objects.deals.write',
    'crm.objects.companies.read',
    'sales-email-read',
  ],
};

const SALESFORCE_CONFIG: OAuthConfig = {
  clientId: Deno.env.get('SALESFORCE_CLIENT_ID') || '',
  clientSecret: Deno.env.get('SALESFORCE_CLIENT_SECRET') || '',
  redirectUri: Deno.env.get('SALESFORCE_REDIRECT_URI') || '',
  scopes: ['api', 'refresh_token', 'offline_access'],
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    switch (path) {
      case 'initiate':
        return handleInitiate(req);
      case 'callback':
        return handleCallback(req);
      case 'refresh':
        return handleRefresh(req);
      case 'disconnect':
        return handleDisconnect(req);
      case 'status':
        return handleStatus(req);
      default:
        return jsonResponse({ error: 'Unknown endpoint' }, 404);
    }
  } catch (error) {
    console.error('OAuth error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// ============================================================================
// Initiate OAuth Flow
// ============================================================================

async function handleInitiate(req: Request): Promise<Response> {
  const { provider, tenant_id } = await req.json();

  // Verify user is admin of tenant
  const supabase = createSupabaseClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const isAdmin = await verifyTenantAdmin(supabase, tenant_id, user.id);
  if (!isAdmin) {
    return jsonResponse({ error: 'Only admins can connect integrations' }, 403);
  }

  // Generate state token for CSRF protection
  const state = btoa(JSON.stringify({
    tenant_id,
    user_id: user.id,
    timestamp: Date.now(),
  }));

  let authUrl: string;

  if (provider === 'hubspot') {
    const config = HUBSPOT_CONFIG;
    authUrl = `https://app.hubspot.com/oauth/authorize?` +
      `client_id=${config.clientId}` +
      `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
      `&scope=${encodeURIComponent(config.scopes.join(' '))}` +
      `&state=${encodeURIComponent(state)}`;
  } else if (provider === 'salesforce') {
    const config = SALESFORCE_CONFIG;
    // Use login.salesforce.com for production, test.salesforce.com for sandbox
    authUrl = `https://login.salesforce.com/services/oauth2/authorize?` +
      `response_type=code` +
      `&client_id=${config.clientId}` +
      `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
      `&scope=${encodeURIComponent(config.scopes.join(' '))}` +
      `&state=${encodeURIComponent(state)}`;
  } else {
    return jsonResponse({ error: `Unknown provider: ${provider}` }, 400);
  }

  return jsonResponse({ auth_url: authUrl, state });
}

// ============================================================================
// Handle OAuth Callback
// ============================================================================

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Check for OAuth errors
  if (error) {
    return redirectWithError(`OAuth error: ${errorDescription || error}`);
  }

  if (!code || !state) {
    return redirectWithError('Missing code or state parameter');
  }

  // Decode and validate state
  let stateData: { tenant_id: string; user_id: string; timestamp: number };
  try {
    stateData = JSON.parse(atob(state));
  } catch {
    return redirectWithError('Invalid state parameter');
  }

  // Check state is not expired (10 minutes)
  if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
    return redirectWithError('OAuth session expired');
  }

  // Determine provider from redirect URI
  const isHubSpot = url.pathname.includes('hubspot') || 
    HUBSPOT_CONFIG.redirectUri.includes(url.host);
  const provider = isHubSpot ? 'hubspot' : 'salesforce';

  // Exchange code for tokens
  let tokens: TokenResponse;
  try {
    tokens = await exchangeCodeForTokens(provider, code);
  } catch (err) {
    return redirectWithError(`Token exchange failed: ${err}`);
  }

  // Store tokens in database
  const supabase = createSupabaseAdmin();
  
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const { error: upsertError } = await supabase
    .from('tenant_integrations')
    .upsert({
      tenant_id: stateData.tenant_id,
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      instance_url: tokens.instance_url,
      hub_id: tokens.hub_id?.toString(),
      scopes: provider === 'hubspot' ? HUBSPOT_CONFIG.scopes : SALESFORCE_CONFIG.scopes,
      connected_by: stateData.user_id,
      connected_at: new Date().toISOString(),
      status: 'active',
    }, {
      onConflict: 'tenant_id,provider',
    });

  if (upsertError) {
    console.error('Failed to store tokens:', upsertError);
    return redirectWithError('Failed to save connection');
  }

  // Redirect back to app with success
  const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';
  return Response.redirect(
    `${appUrl}/settings/integrations?connected=${provider}`,
    302
  );
}

// ============================================================================
// Token Exchange
// ============================================================================

async function exchangeCodeForTokens(
  provider: string,
  code: string
): Promise<TokenResponse> {
  if (provider === 'hubspot') {
    const config = HUBSPOT_CONFIG;
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot token exchange failed: ${error}`);
    }

    return response.json();
  } else {
    const config = SALESFORCE_CONFIG;
    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce token exchange failed: ${error}`);
    }

    return response.json();
  }
}

// ============================================================================
// Refresh Tokens
// ============================================================================

async function handleRefresh(req: Request): Promise<Response> {
  const { provider, tenant_id } = await req.json();

  const supabase = createSupabaseAdmin();

  // Get current integration
  const { data: integration, error: fetchError } = await supabase
    .from('tenant_integrations')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('provider', provider)
    .single();

  if (fetchError || !integration) {
    return jsonResponse({ error: 'Integration not found' }, 404);
  }

  if (!integration.refresh_token) {
    return jsonResponse({ error: 'No refresh token available' }, 400);
  }

  // Refresh the token
  let tokens: TokenResponse;
  try {
    tokens = await refreshAccessToken(provider, integration.refresh_token);
  } catch (err) {
    // Mark integration as expired
    await supabase
      .from('tenant_integrations')
      .update({ status: 'expired', error_message: String(err) })
      .eq('id', integration.id);

    return jsonResponse({ error: `Token refresh failed: ${err}` }, 400);
  }

  // Update stored tokens
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const { error: updateError } = await supabase
    .from('tenant_integrations')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || integration.refresh_token,
      token_expires_at: expiresAt,
      last_refreshed_at: new Date().toISOString(),
      status: 'active',
      error_message: null,
    })
    .eq('id', integration.id);

  if (updateError) {
    return jsonResponse({ error: 'Failed to update tokens' }, 500);
  }

  return jsonResponse({ success: true, expires_at: expiresAt });
}

async function refreshAccessToken(
  provider: string,
  refreshToken: string
): Promise<TokenResponse> {
  if (provider === 'hubspot') {
    const config = HUBSPOT_CONFIG;
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot token refresh failed: ${error}`);
    }

    return response.json();
  } else {
    const config = SALESFORCE_CONFIG;
    const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce token refresh failed: ${error}`);
    }

    return response.json();
  }
}

// ============================================================================
// Disconnect Integration
// ============================================================================

async function handleDisconnect(req: Request): Promise<Response> {
  const { provider, tenant_id } = await req.json();

  // Verify user is admin
  const supabase = createSupabaseClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const isAdmin = await verifyTenantAdmin(supabase, tenant_id, user.id);
  if (!isAdmin) {
    return jsonResponse({ error: 'Only admins can disconnect integrations' }, 403);
  }

  // Mark as revoked (keep record for audit)
  const adminSupabase = createSupabaseAdmin();
  const { error } = await adminSupabase
    .from('tenant_integrations')
    .update({
      status: 'revoked',
      access_token: null,
      refresh_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenant_id)
    .eq('provider', provider);

  if (error) {
    return jsonResponse({ error: 'Failed to disconnect' }, 500);
  }

  return jsonResponse({ success: true });
}

// ============================================================================
// Check Connection Status
// ============================================================================

async function handleStatus(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const tenant_id = url.searchParams.get('tenant_id');

  if (!tenant_id) {
    return jsonResponse({ error: 'Missing tenant_id' }, 400);
  }

  const supabase = createSupabaseClient(req);
  
  // Get integrations (RLS will filter)
  const { data: integrations, error } = await supabase
    .from('tenant_integrations')
    .select('provider, status, connected_at, connected_by, scopes, error_message')
    .eq('tenant_id', tenant_id);

  if (error) {
    return jsonResponse({ error: 'Failed to fetch status' }, 500);
  }

  const status: Record<string, {
    connected: boolean;
    status: string;
    connectedAt?: string;
    scopes?: string[];
    error?: string;
  }> = {
    hubspot: { connected: false, status: 'not_connected' },
    salesforce: { connected: false, status: 'not_connected' },
  };

  for (const integration of integrations || []) {
    status[integration.provider] = {
      connected: integration.status === 'active',
      status: integration.status,
      connectedAt: integration.connected_at,
      scopes: integration.scopes,
      error: integration.error_message,
    };
  }

  return jsonResponse(status);
}

// ============================================================================
// Helpers
// ============================================================================

function createSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    }
  );
}

function createSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );
}

async function verifyTenantAdmin(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();

  return data?.role === 'admin' || data?.role === 'owner';
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

function redirectWithError(message: string): Response {
  const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';
  return Response.redirect(
    `${appUrl}/settings/integrations?error=${encodeURIComponent(message)}`,
    302
  );
}
