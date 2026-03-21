import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const canonicalIdentityMigrationPath = path.join(
  repoRoot,
  "infra/supabase/supabase/migrations/20260213000010_canonical_identity_baseline.sql",
);
const missingTablesMigrationPath = path.join(
  repoRoot,
  "infra/supabase/supabase/migrations/20260331000000_p1_missing_tables.sql",
);

const canonicalIdentityMigration = readFileSync(canonicalIdentityMigrationPath, "utf8");
const missingTablesMigration = readFileSync(missingTablesMigrationPath, "utf8");

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const runtimeLaneEnabled = Boolean(supabaseUrl && anonKey && serviceRoleKey);
const runtimeDescribe = runtimeLaneEnabled ? describe : describe.skip;

type RuntimeUserContext = {
  accessToken: string;
  client: SupabaseClient;
  email: string;
  password: string;
  tenantId: string;
  userId: string;
};

function createScopedClient(url: string, key: string, accessToken: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function createSeededValueCase(tenantId: string) {
  return {
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    name: `tenant-case-${crypto.randomUUID()}`,
    status: "draft",
    stage: "discovery",
  };
}

function assertRlsPredicate(content: string, tableName: string) {
  expect(content).toMatch(
    new RegExp(`ALTER TABLE public\\.${tableName} ENABLE ROW LEVEL SECURITY;`, "m"),
  );
  expect(content).toMatch(
    new RegExp(
      `CREATE POLICY ${tableName}_[a-z_]+ ON public\\.${tableName}[\\s\\S]*security\\.user_has_tenant_access\\(`,
      "m",
    ),
  );
}

function assertMigrationContainsIndexes(content: string, indexNames: string[]) {
  for (const indexName of indexNames) {
    expect(content).toContain(`CREATE INDEX IF NOT EXISTS ${indexName}`);
  }
}

function runPsqlQuery(sql: string): string[] {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for runtime index introspection");
  }

  const result = spawnSync("psql", [databaseUrl, "-At", "-F", "\t", "-c", sql], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || `psql exited with status ${result.status}`);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

describe("Tenant Isolation Verification - static fallback lane", () => {
  it("pins the tenant membership helper to active user_tenants rows and auth.uid()", () => {
    expect(canonicalIdentityMigration).toContain("CREATE OR REPLACE FUNCTION security.current_tenant_id()");
    expect(canonicalIdentityMigration).toContain("current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'");
    expect(canonicalIdentityMigration).toContain("CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id TEXT)");
    expect(canonicalIdentityMigration).toContain("FROM public.user_tenants AS ut");
    expect(canonicalIdentityMigration).toContain("ut.user_id   = (auth.uid())::text");
    expect(canonicalIdentityMigration).toContain("ut.status = 'active'");
  });

  it("keeps value_cases tenant controls enforceable in active migrations", () => {
    assertRlsPredicate(canonicalIdentityMigration, "value_cases");
    expect(canonicalIdentityMigration).toContain("CREATE POLICY value_cases_tenant_insert ON public.value_cases");
    expect(canonicalIdentityMigration).toContain("CREATE POLICY value_cases_tenant_update ON public.value_cases");
    expect(canonicalIdentityMigration).toContain("WITH CHECK (");
    assertMigrationContainsIndexes(canonicalIdentityMigration, [
      "idx_value_cases_tenant_id",
      "idx_value_cases_tenant_status",
    ]);
  });

  it("keeps messages tenant controls and hot-path indexes in active migrations", () => {
    assertRlsPredicate(missingTablesMigration, "messages");
    expect(missingTablesMigration).toContain("CREATE POLICY messages_tenant_insert ON public.messages");
    expect(missingTablesMigration).toContain("CREATE POLICY messages_tenant_update ON public.messages");
    assertMigrationContainsIndexes(missingTablesMigration, [
      "idx_messages_user_tenant",
      "idx_messages_tenant_created",
    ]);
  });

  it("keeps user_tenants membership indexes available for tenant authorization hot paths", () => {
    expect(canonicalIdentityMigration).toContain("CREATE TABLE IF NOT EXISTS public.user_tenants");
    expect(canonicalIdentityMigration).toContain("ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;");
    assertMigrationContainsIndexes(canonicalIdentityMigration, [
      "idx_user_tenants_tenant",
      "idx_user_tenants_user",
      "idx_user_tenants_status",
    ]);
  });
});

runtimeDescribe("Tenant Isolation Verification - trusted runtime lane", () => {
  let adminClient: SupabaseClient;
  let tenant1Context: RuntimeUserContext;
  let tenant2Context: RuntimeUserContext;
  let outsiderContext: RuntimeUserContext;
  let createdUserIds: string[] = [];
  let createdTenantIds: string[] = [];
  let createdValueCaseIds: string[] = [];
  let createdMessageIds: string[] = [];

  async function createRuntimeUser(tenantId: string, emailPrefix: string): Promise<RuntimeUserContext> {
    if (!supabaseUrl || !anonKey) {
      throw new Error("Missing Supabase URL or anon key for runtime tenant isolation tests");
    }

    const email = `${emailPrefix}-${Date.now()}-${crypto.randomUUID()}@example.com`;
    const password = `ValueOS-${crypto.randomUUID()}!`;
    const authAdmin = adminClient.auth.admin;

    const { data: createdUser, error: createUserError } = await authAdmin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { tenant_id: tenantId },
      app_metadata: { tenant_id: tenantId },
    });

    if (createUserError) {
      throw createUserError;
    }

    createdUserIds.push(createdUser.user.id);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signedIn.session) {
      throw signInError || new Error(`Failed to sign in runtime user ${email}`);
    }

    return {
      accessToken: signedIn.session.access_token,
      client: createScopedClient(supabaseUrl, anonKey, signedIn.session.access_token),
      email,
      password,
      tenantId,
      userId: createdUser.user.id,
    };
  }

  beforeAll(async () => {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return;
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const tenant1Id = crypto.randomUUID();
    const tenant2Id = crypto.randomUUID();
    createdTenantIds = [tenant1Id, tenant2Id];

    const { error: tenantInsertError } = await adminClient.from("tenants").insert([
      { id: tenant1Id, name: `Tenant ${tenant1Id}`, status: "active" },
      { id: tenant2Id, name: `Tenant ${tenant2Id}`, status: "active" },
    ]);

    if (tenantInsertError) {
      throw tenantInsertError;
    }

    tenant1Context = await createRuntimeUser(tenant1Id, "tenant-1-user");
    tenant2Context = await createRuntimeUser(tenant2Id, "tenant-2-user");
    outsiderContext = await createRuntimeUser(crypto.randomUUID(), "tenant-outsider-user");

    const { error: membershipInsertError } = await adminClient.from("user_tenants").insert([
      {
        tenant_id: tenant1Context.tenantId,
        user_id: tenant1Context.userId,
        role: "member",
        status: "active",
      },
      {
        tenant_id: tenant2Context.tenantId,
        user_id: tenant2Context.userId,
        role: "member",
        status: "active",
      },
    ]);

    if (membershipInsertError) {
      throw membershipInsertError;
    }
  });

  afterAll(async () => {
    if (!adminClient) {
      return;
    }

    if (createdMessageIds.length > 0) {
      await adminClient.from("messages").delete().in("id", createdMessageIds);
    }

    if (createdValueCaseIds.length > 0) {
      await adminClient.from("value_cases").delete().in("id", createdValueCaseIds);
    }

    if (createdTenantIds.length > 0) {
      await adminClient.from("user_tenants").delete().in("tenant_id", createdTenantIds);
      await adminClient.from("tenants").delete().in("id", createdTenantIds);
    }

    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  });

  it("confirms the active Supabase schema exposes tenant-scoped tables used by the control", async () => {
    const [tenantsResult, membershipsResult, valueCasesResult, messagesResult] = await Promise.all([
      adminClient.from("tenants").select("id").limit(1),
      adminClient.from("user_tenants").select("tenant_id,user_id").limit(1),
      adminClient.from("value_cases").select("id,tenant_id").limit(1),
      adminClient.from("messages").select("id,tenant_id").limit(1),
    ]);

    expect(tenantsResult.error).toBeNull();
    expect(membershipsResult.error).toBeNull();
    expect(valueCasesResult.error).toBeNull();
    expect(messagesResult.error).toBeNull();
  });

  it("rejects tenant mismatch inserts for JWT-scoped value_cases clients", async () => {
    const { data, error } = await tenant1Context.client
      .from("value_cases")
      .insert({
        tenant_id: tenant2Context.tenantId,
        name: `cross-tenant-insert-${crypto.randomUUID()}`,
        status: "draft",
        stage: "discovery",
      })
      .select();

    expect(data ?? []).toHaveLength(0);
    expect(error).toBeTruthy();
  });

  it("blocks cross-tenant reads, updates, and deletes on value_cases", async () => {
    const seededCase = createSeededValueCase(tenant1Context.tenantId);
    createdValueCaseIds.push(seededCase.id);

    const { error: insertError } = await adminClient.from("value_cases").insert(seededCase);
    expect(insertError).toBeNull();

    const ownerRead = await tenant1Context.client.from("value_cases").select("id,tenant_id,name").eq("id", seededCase.id);
    const crossTenantRead = await tenant2Context.client
      .from("value_cases")
      .select("id,tenant_id,name")
      .eq("id", seededCase.id);
    const outsiderRead = await outsiderContext.client.from("value_cases").select("id").eq("id", seededCase.id);

    expect(ownerRead.error).toBeNull();
    expect(ownerRead.data).toHaveLength(1);
    expect(crossTenantRead.error).toBeNull();
    expect(crossTenantRead.data ?? []).toHaveLength(0);
    expect(outsiderRead.error).toBeNull();
    expect(outsiderRead.data ?? []).toHaveLength(0);

    const crossTenantUpdate = await tenant2Context.client
      .from("value_cases")
      .update({ name: "mutated-by-tenant-2" })
      .eq("id", seededCase.id)
      .select("id,name,tenant_id");

    expect(crossTenantUpdate.error).toBeNull();
    expect(crossTenantUpdate.data ?? []).toHaveLength(0);

    const crossTenantDelete = await tenant2Context.client
      .from("value_cases")
      .delete()
      .eq("id", seededCase.id)
      .select("id");

    expect(crossTenantDelete.error).toBeNull();
    expect(crossTenantDelete.data ?? []).toHaveLength(0);

    const { data: persistedRow, error: persistedRowError } = await adminClient
      .from("value_cases")
      .select("id,name,tenant_id")
      .eq("id", seededCase.id)
      .single();

    expect(persistedRowError).toBeNull();
    expect(persistedRow?.tenant_id).toBe(tenant1Context.tenantId);
    expect(persistedRow?.name).toBe(seededCase.name);
  });

  it("keeps tenant_id effectively immutable for scoped updates", async () => {
    const { data: insertedCase, error: insertError } = await tenant1Context.client
      .from("value_cases")
      .insert({
        tenant_id: tenant1Context.tenantId,
        name: `mutable-check-${crypto.randomUUID()}`,
        status: "draft",
        stage: "discovery",
      })
      .select("id,tenant_id")
      .single();

    expect(insertError).toBeNull();
    expect(insertedCase).toBeTruthy();
    createdValueCaseIds.push(insertedCase!.id);

    const attemptedMutation = await tenant1Context.client
      .from("value_cases")
      .update({ tenant_id: tenant2Context.tenantId })
      .eq("id", insertedCase!.id)
      .select("id,tenant_id");

    expect((attemptedMutation.data ?? []).length).toBe(0);
    expect(attemptedMutation.error).toBeTruthy();

    const { data: persistedRow, error: persistedRowError } = await adminClient
      .from("value_cases")
      .select("id,tenant_id")
      .eq("id", insertedCase!.id)
      .single();

    expect(persistedRowError).toBeNull();
    expect(persistedRow?.tenant_id).toBe(tenant1Context.tenantId);
  });

  it("rejects authenticated users without matching tenant membership", async () => {
    const readAttempt = await outsiderContext.client.from("tenants").select("id");
    expect(readAttempt.error).toBeNull();
    expect(readAttempt.data ?? []).toHaveLength(0);

    const insertAttempt = await outsiderContext.client
      .from("value_cases")
      .insert({
        tenant_id: tenant1Context.tenantId,
        name: `outsider-insert-${crypto.randomUUID()}`,
        status: "draft",
        stage: "discovery",
      })
      .select("id");

    expect(insertAttempt.error).toBeTruthy();
    expect(insertAttempt.data ?? []).toHaveLength(0);
  });

  it("scopes membership and messages queries to the caller's tenant access", async () => {
    const membershipRead = await tenant1Context.client
      .from("user_tenants")
      .select("tenant_id,user_id,status")
      .order("tenant_id", { ascending: true });

    expect(membershipRead.error).toBeNull();
    expect(membershipRead.data).toEqual([
      {
        status: "active",
        tenant_id: tenant1Context.tenantId,
        user_id: tenant1Context.userId,
      },
    ]);

    const { data: insertedMessage, error: insertMessageError } = await tenant1Context.client
      .from("messages")
      .insert({
        user_id: tenant1Context.userId,
        tenant_id: tenant1Context.tenantId,
        content: `tenant-message-${crypto.randomUUID()}`,
        role: "user",
      })
      .select("id,tenant_id,user_id,content")
      .single();

    expect(insertMessageError).toBeNull();
    expect(insertedMessage).toBeTruthy();
    createdMessageIds.push(insertedMessage!.id);

    const ownerRead = await tenant1Context.client.from("messages").select("id,tenant_id").eq("id", insertedMessage!.id);
    const crossTenantRead = await tenant2Context.client.from("messages").select("id,tenant_id").eq("id", insertedMessage!.id);
    const crossTenantInsert = await tenant2Context.client
      .from("messages")
      .insert({
        user_id: tenant2Context.userId,
        tenant_id: tenant1Context.tenantId,
        content: `tenant-mismatch-message-${crypto.randomUUID()}`,
        role: "user",
      })
      .select("id");

    expect(ownerRead.error).toBeNull();
    expect(ownerRead.data).toHaveLength(1);
    expect(crossTenantRead.error).toBeNull();
    expect(crossTenantRead.data ?? []).toHaveLength(0);
    expect(crossTenantInsert.error).toBeTruthy();
    expect(crossTenantInsert.data ?? []).toHaveLength(0);
  });

  const runtimeIndexDescribe = databaseUrl ? describe : describe.skip;

  runtimeIndexDescribe("Tenant Isolation Verification - runtime index introspection", () => {
    it("finds tenant hot-path indexes in the active Supabase schema", () => {
      const rows = runPsqlQuery(`
        SELECT tablename || ':' || indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND (
            (tablename = 'value_cases' AND indexname IN ('idx_value_cases_tenant_id', 'idx_value_cases_tenant_status'))
            OR (tablename = 'messages' AND indexname IN ('idx_messages_user_tenant', 'idx_messages_tenant_created'))
            OR (tablename = 'user_tenants' AND indexname IN ('idx_user_tenants_tenant', 'idx_user_tenants_user'))
          )
        ORDER BY tablename, indexname;
      `);

      expect(rows).toEqual(
        expect.arrayContaining([
          'messages:idx_messages_tenant_created',
          'messages:idx_messages_user_tenant',
          'user_tenants:idx_user_tenants_tenant',
          'user_tenants:idx_user_tenants_user',
          'value_cases:idx_value_cases_tenant_id',
          'value_cases:idx_value_cases_tenant_status',
        ]),
      );
    });
  });
});
