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

const requiredEnv = (
  name: "VITE_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "SUPABASE_ANON_KEY"
): string | undefined => {
  return process.env[name];
};

const createTenantClient = (
  supabaseUrl: string,
  anonKey: string,
  accessToken: string
): SupabaseClient =>
  createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
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

  const { error: userTenantError } = await adminClient
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
    const supabaseUrl = requiredEnv("VITE_SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");

    // Skip if env vars not set
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.warn("Skipping tenant isolation tests - env vars not set");
      return null;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const cleanupIds: { users: string[]; tenants: string[] } = {
      users: [],
      tenants: [],
    };

    const tenantOneId = crypto.randomUUID();
    const tenantTwoId = crypto.randomUUID();

    cleanupIds.tenants.push(tenantOneId, tenantTwoId);

    const { error: tenantInsertError } = await adminClient
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
      adminClient,
      tenantId: tenantOneId,
      suffix: "a",
      supabaseUrl,
      anonKey,
      cleanupIds,
    });

    const tenantTwo = await bootstrapTenantUser({
      adminClient,
      tenantId: tenantTwoId,
      suffix: "b",
      supabaseUrl,
      anonKey,
      cleanupIds,
    });

    const cleanup = async () => {
      await adminClient.from("agent_predictions").delete().like("id", "sec-%");
      await adminClient.from("agent_sessions").delete().like("id", "sec-%");

      for (const userId of cleanupIds.users) {
        await adminClient.from("user_tenants").delete().eq("user_id", userId);
        await adminClient.auth.admin.deleteUser(userId);
      }

      for (const tenantId of cleanupIds.tenants) {
        await adminClient.from("tenants").delete().eq("id", tenantId);
      }
    };

    return {
      adminClient,
      tenantOne,
      tenantTwo,
      cleanup,
    };
  };
