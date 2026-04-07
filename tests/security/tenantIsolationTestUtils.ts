import crypto from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface TenantJwtContext {
  tenantId: string;
  userId: string;
  email: string;
  accessToken: string;
  client: SupabaseClient;
}

export interface TenantIsolationFixture {
  adminClient: SupabaseClient;
  tenantOne: TenantJwtContext;
  tenantTwo: TenantJwtContext;
  cleanup: () => Promise<void>;
}

const resolveEnv = (...names: string[]): string | undefined =>
  names.map((name) => process.env[name]).find((value) => Boolean(value));

function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = resolveEnv("VITE_SUPABASE_URL", "SUPABASE_URL")!;
  const serviceKey = resolveEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY")!;

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: undefined,
    },
    global: {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  });
}

const createTenantClient = (
  supabaseUrl: string,
  anonKey: string,
  accessToken: string
): SupabaseClient =>
  createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, storage: undefined },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

interface BootstrapUserInput {
  adminClient: SupabaseClient;
  tenantId: string;
  suffix: string;
  supabaseUrl: string;
  anonKey: string;
  cleanupIds: { users: string[]; tenants: string[] };
}

const bootstrapTenantUser = async ({
  adminClient,
  tenantId,
  suffix,
  supabaseUrl,
  anonKey,
  cleanupIds,
}: BootstrapUserInput): Promise<TenantJwtContext> => {
  const uniqueSuffix = `${suffix}-${crypto.randomUUID()}`;
  const email = `tenant-${uniqueSuffix}@example.com`;
  const password = `P@ssword-${uniqueSuffix}`;

  // Phase 1: Auth operations with setup client
  const { data: createdUser, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        tenant_id: tenantId,
        organization_id: tenantId,
      },
      app_metadata: {
        roles: ["member"],
        tier: "test",
      },
    });

  if (createUserError || !createdUser.user?.id) {
    throw new Error(
      `Failed to create user for tenant ${tenantId}: ${createUserError?.message}`
    );
  }

  cleanupIds.users.push(createdUser.user.id);

  // Phase 2: Table operations with FRESH client (never used for auth)
  const tableClient = createServiceRoleClient();

  const { error: userTenantError } = await tableClient
    .from("user_tenants")
    .insert({
      user_id: createdUser.user.id,
      tenant_id: tenantId,
      status: "active",
    });

  if (userTenantError) {
    throw new Error(
      `Failed to link user to tenant ${tenantId}: ${userTenantError.message}`
    );
  }

  // Phase 3: Sign in with setup client
  const { data: signInData, error: signInError } =
    await adminClient.auth.signInWithPassword({
      email,
      password,
    });

  const accessToken = signInData.session?.access_token;
  if (signInError || !accessToken) {
    throw new Error(
      `Failed to sign in tenant user for ${tenantId}: ${signInError?.message}`
    );
  }

  return {
    tenantId,
    userId: createdUser.user.id,
    email,
    accessToken,
    client: createTenantClient(supabaseUrl, anonKey, accessToken),
  };
};

export const createTenantIsolationFixture =
  async (): Promise<TenantIsolationFixture | null> => {
    const supabaseUrl = resolveEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
    const serviceRoleKey = resolveEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_KEY"
    );
    const anonKey = resolveEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");

    // Fail hard if required env vars are absent — a missing secret must not
    // produce a green CI run with zero tests executed.
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error(
        "Tenant isolation tests require a Supabase URL (VITE_SUPABASE_URL or SUPABASE_URL), " +
          "a service key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY), and an anon key " +
          "(SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY). Set these secrets in CI " +
          "(GitHub Actions → Settings → Secrets) and locally in .env."
      );
    }

    // Phase 1: Setup - Use dedicated client for auth operations only
    const setupClient = createServiceRoleClient();

    const cleanupIds: { users: string[]; tenants: string[] } = {
      users: [],
      tenants: [],
    };

    const tenantOneId = crypto.randomUUID();
    const tenantTwoId = crypto.randomUUID();

    cleanupIds.tenants.push(tenantOneId, tenantTwoId);

    // Phase 2: Table Operations - Use FRESH service role client (never used for auth)
    const tableClient = createServiceRoleClient();

    const { error: tenantInsertError } = await tableClient
      .from("tenants")
      .insert([
        {
          id: tenantOneId,
          name: `Security Tenant A ${Date.now()}`,
          slug: `security-a-${Date.now()}`,
          status: "active",
        },
        {
          id: tenantTwoId,
          name: `Security Tenant B ${Date.now()}`,
          slug: `security-b-${Date.now()}`,
          status: "active",
        },
      ]);

    if (tenantInsertError) {
      throw new Error(
        `Failed to insert test tenants: ${tenantInsertError.message}`
      );
    }

    const tenantOne = await bootstrapTenantUser({
      adminClient: setupClient,
      tenantId: tenantOneId,
      suffix: "a",
      supabaseUrl,
      anonKey,
      cleanupIds,
    });

    const tenantTwo = await bootstrapTenantUser({
      adminClient: setupClient,
      tenantId: tenantTwoId,
      suffix: "b",
      supabaseUrl,
      anonKey,
      cleanupIds,
    });

    const cleanup = async () => {
      await tableClient.from("agent_predictions").delete().like("id", "sec-%");
      await tableClient.from("agent_sessions").delete().like("id", "sec-%");

      for (const userId of cleanupIds.users) {
        await tableClient.from("user_tenants").delete().eq("user_id", userId);
        await setupClient.auth.admin.deleteUser(userId);
      }

      for (const tenantId of cleanupIds.tenants) {
        await tableClient.from("tenants").delete().eq("id", tenantId);
      }
    };

    return {
      adminClient: tableClient,
      tenantOne,
      tenantTwo,
      cleanup,
    };
  };
