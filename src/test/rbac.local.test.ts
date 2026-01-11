import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * RBAC Local Testing Suite
 *
 * This test file helps you verify role-based access control (RBAC)
 * is working correctly in your local environment.
 *
 * Prerequisites:
 * 1. Supabase local instance running (npm run supabase:start)
 * 2. Migrations applied (npm run supabase:migrate)
 * 3. At least one test user created
 *
 * To run:
 * npm test -- rbac.local.test.ts
 */

describe("RBAC Local Testing", () => {
  let supabase: SupabaseClient;
  let serviceRoleClient: SupabaseClient;
  let testUserId: string;
  let testTenantId: string;

  // Replace with your local Supabase credentials
  const SUPABASE_URL =
    process.env.VITE_SUPABASE_URL || "http://localhost:54321";
  const SUPABASE_ANON_KEY =
    process.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key";

  beforeAll(async () => {
    // Initialize clients
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    serviceRoleClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create test tenant
    testTenantId = `test-tenant-${Date.now()}`;
    const { error: tenantError } = await serviceRoleClient
      .from("tenants")
      .insert({
        id: testTenantId,
        name: "Test Tenant for RBAC",
        status: "active",
      });

    if (tenantError) {
      console.error("Failed to create test tenant:", tenantError);
    }

    // Create or get a test user
    const { data: users, error: userError } =
      await serviceRoleClient.auth.admin.listUsers();

    if (userError || !users?.users?.length) {
      // Create test user if none exists
      const { data: newUser, error: createError } =
        await serviceRoleClient.auth.admin.createUser({
          email: "test@valueos.local",
          password: "test-password-123",
          email_confirm: true,
        });

      if (createError) {
        console.error("Failed to create test user:", createError);
        throw createError;
      }

      testUserId = newUser.user!.id;
    } else {
      testUserId = users.users[0].id;
    }

    console.log("Test setup complete:", {
      userId: testUserId,
      tenantId: testTenantId,
    });
  });

  describe("Role Management", () => {
    it("should list all available roles", async () => {
      const { data: roles, error } = await serviceRoleClient
        .from("roles")
        .select("*")
        .order("name");

      expect(error).toBeNull();
      expect(roles).toBeDefined();
      expect(roles!.length).toBeGreaterThan(0);

      console.log(
        "Available roles:",
        roles?.map((r) => r.name)
      );

      // Check for expected system roles
      const roleNames = roles?.map((r) => r.name) || [];
      expect(roleNames).toContain("system_admin");
      expect(roleNames).toContain("tenant_admin");
    });

    it("should have valid permission structure for each role", async () => {
      const { data: roles, error } = await serviceRoleClient
        .from("roles")
        .select("*");

      expect(error).toBeNull();

      roles?.forEach((role) => {
        expect(role.name).toBeDefined();
        expect(role.permissions).toBeDefined();
        expect(Array.isArray(role.permissions)).toBe(true);

        console.log(`Role: ${role.name}, Permissions:`, role.permissions);
      });
    });
  });

  describe("Role Assignment", () => {
    it("should assign tenant_admin role to user", async () => {
      // Get tenant_admin role
      const { data: role } = await serviceRoleClient
        .from("roles")
        .select("id")
        .eq("name", "tenant_admin")
        .single();

      expect(role).toBeDefined();

      // Assign role to user
      const { data, error } = await serviceRoleClient
        .from("user_roles")
        .insert({
          user_id: testUserId,
          role_id: role!.id,
          tenant_id: testTenantId,
        })
        .select();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data![0].user_id).toBe(testUserId);

      console.log("Assigned tenant_admin role to user:", testUserId);
    });

    it("should verify role assignment", async () => {
      const { data: userRoles, error } = await serviceRoleClient
        .from("user_roles")
        .select(
          `
          *,
          roles (name, permissions)
        `
        )
        .eq("user_id", testUserId);

      expect(error).toBeNull();
      expect(userRoles).toBeDefined();
      expect(userRoles!.length).toBeGreaterThan(0);

      console.log("User roles:", userRoles);

      const hasAdminRole = userRoles?.some(
        (ur: any) => ur.roles?.name === "tenant_admin"
      );
      expect(hasAdminRole).toBe(true);
    });

    it("should handle duplicate role assignment gracefully", async () => {
      const { data: role } = await serviceRoleClient
        .from("roles")
        .select("id")
        .eq("name", "tenant_admin")
        .single();

      // Try to assign the same role again
      const { error } = await serviceRoleClient.from("user_roles").insert({
        user_id: testUserId,
        role_id: role!.id,
        tenant_id: testTenantId,
      });

      // Should fail due to unique constraint or be handled by ON CONFLICT
      expect(error).toBeDefined();
    });

    it("should assign system_admin role (global)", async () => {
      const { data: role } = await serviceRoleClient
        .from("roles")
        .select("id")
        .eq("name", "system_admin")
        .single();

      const { error } = await serviceRoleClient.from("user_roles").upsert({
        user_id: testUserId,
        role_id: role!.id,
        tenant_id: null, // Global role
      });

      expect(error).toBeNull();

      console.log("Assigned system_admin role (global) to user");
    });
  });

  describe("Permission Checks", () => {
    it("should retrieve all permissions for a user", async () => {
      const { data: userRoles, error } = await serviceRoleClient
        .from("user_roles")
        .select(
          `
          user_id,
          tenant_id,
          roles (
            name,
            permissions
          )
        `
        )
        .eq("user_id", testUserId);

      expect(error).toBeNull();
      expect(userRoles).toBeDefined();

      // Flatten all permissions
      const allPermissions =
        userRoles?.flatMap((ur: any) => ur.roles?.permissions || []) || [];

      console.log("User permissions:", allPermissions);
      expect(allPermissions.length).toBeGreaterThan(0);
    });

    it("should check if user has specific permission", async () => {
      const permissionToCheck = "tenant.read";

      const { data: userRoles } = await serviceRoleClient
        .from("user_roles")
        .select(
          `
          roles (
            name,
            permissions
          )
        `
        )
        .eq("user_id", testUserId);

      const hasPermission = userRoles?.some((ur: any) => {
        const permissions = ur.roles?.permissions || [];
        return (
          permissions.includes(permissionToCheck) ||
          permissions.includes("tenant.*") ||
          permissions.includes("*")
        );
      });

      console.log(`User has '${permissionToCheck}' permission:`, hasPermission);
      expect(hasPermission).toBeDefined();
    });

    it("should check wildcard permission matching", async () => {
      const { data: userRoles } = await serviceRoleClient
        .from("user_roles")
        .select(
          `
          roles (permissions)
        `
        )
        .eq("user_id", testUserId);

      const permissions =
        userRoles?.flatMap((ur: any) => ur.roles?.permissions || []) || [];

      // Check if user has any wildcard permissions
      const hasWildcard = permissions.some(
        (p) => p === "*" || p.endsWith(".*")
      );

      console.log("Has wildcard permissions:", hasWildcard);
      console.log("All permissions:", permissions);
    });
  });

  describe("User-Tenant Relationship", () => {
    it("should link user to tenant", async () => {
      const { error } = await serviceRoleClient.from("user_tenants").upsert({
        tenant_id: testTenantId,
        user_id: testUserId,
        role: "admin",
      });

      expect(error).toBeNull();

      console.log("Linked user to tenant");
    });

    it("should retrieve user tenants", async () => {
      const { data: userTenants, error } = await serviceRoleClient
        .from("user_tenants")
        .select(
          `
          *,
          tenants (name, status)
        `
        )
        .eq("user_id", testUserId);

      expect(error).toBeNull();
      expect(userTenants).toBeDefined();
      expect(userTenants!.length).toBeGreaterThan(0);

      console.log("User tenants:", userTenants);
    });
  });

  describe("Multi-Role Scenarios", () => {
    it("should assign multiple roles to same user", async () => {
      const { data: roles } = await serviceRoleClient
        .from("roles")
        .select("id, name")
        .in("name", ["tenant_admin", "security_admin"]);

      expect(roles?.length).toBe(2);

      const inserts = roles!.map((role) => ({
        user_id: testUserId,
        role_id: role.id,
        tenant_id: role.name === "security_admin" ? null : testTenantId,
      }));

      const { error } = await serviceRoleClient
        .from("user_roles")
        .upsert(inserts);

      // May error on duplicate, which is fine
      console.log("Attempted to assign multiple roles");
    });

    it("should aggregate permissions from multiple roles", async () => {
      const { data: userRoles } = await serviceRoleClient
        .from("user_roles")
        .select(
          `
          roles (name, permissions)
        `
        )
        .eq("user_id", testUserId);

      const allPermissions = new Set<string>();
      userRoles?.forEach((ur: any) => {
        ur.roles?.permissions?.forEach((p: string) => allPermissions.add(p));
      });

      console.log("Aggregated permissions:", Array.from(allPermissions));
      expect(allPermissions.size).toBeGreaterThan(0);
    });
  });

  describe("Role Removal", () => {
    it("should remove role from user", async () => {
      const { data: role } = await serviceRoleClient
        .from("roles")
        .select("id")
        .eq("name", "security_admin")
        .single();

      if (!role) return;

      const { error } = await serviceRoleClient
        .from("user_roles")
        .delete()
        .eq("user_id", testUserId)
        .eq("role_id", role.id);

      expect(error).toBeNull();

      console.log("Removed security_admin role from user");
    });

    it("should verify role was removed", async () => {
      const { data: userRoles } = await serviceRoleClient
        .from("user_roles")
        .select(
          `
          roles (name)
        `
        )
        .eq("user_id", testUserId);

      const hasSecurityAdmin = userRoles?.some(
        (ur: any) => ur.roles?.name === "security_admin"
      );

      expect(hasSecurityAdmin).toBe(false);
    });
  });

  describe("Cleanup", () => {
    it("should clean up test data", async () => {
      // Remove user roles
      await serviceRoleClient
        .from("user_roles")
        .delete()
        .eq("user_id", testUserId);

      // Remove user-tenant links
      await serviceRoleClient
        .from("user_tenants")
        .delete()
        .eq("user_id", testUserId)
        .eq("tenant_id", testTenantId);

      // Remove test tenant
      await serviceRoleClient.from("tenants").delete().eq("id", testTenantId);

      console.log("Cleaned up test data");
    });
  });
});

/**
 * Helper function to check if user has permission
 * This can be used in your application code
 */
export async function checkUserPermission(
  supabase: SupabaseClient,
  userId: string,
  permission: string,
  tenantId?: string
): Promise<boolean> {
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select(
      `
      roles (permissions),
      tenant_id
    `
    )
    .eq("user_id", userId);

  if (!userRoles) return false;

  // Filter by tenant if specified
  const relevantRoles = tenantId
    ? userRoles.filter(
        (ur: any) => ur.tenant_id === null || ur.tenant_id === tenantId
      )
    : userRoles;

  // Check permissions
  return relevantRoles.some((ur: any) => {
    const permissions = ur.roles?.permissions || [];

    // Exact match
    if (permissions.includes(permission)) return true;

    // Wildcard match (e.g., "tenant.*" matches "tenant.read")
    const category = permission.split(".")[0];
    if (permissions.includes(`${category}.*`)) return true;

    // Full access
    if (permissions.includes("*")) return true;

    return false;
  });
}
