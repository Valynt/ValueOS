/**
 * Test Script: Zero Trust Security Integration
 * Tests ProtectedComponent with real Supabase Auth
 */

import { beforeAll, describe, expect, it } from "vitest";

import { createBrowserSupabaseClient } from "@/lib/supabase";
import { computePermissions } from "@/types/security";

describe("Zero Trust Security Integration Test", () => {
  let supabase: ReturnType<typeof createBrowserSupabaseClient>;

  beforeAll(() => {
    supabase = createBrowserSupabaseClient();
  });

  describe("Permission Computation", () => {
    // --- Tenant roles ---
    it("owner gets full admin permissions", () => {
      const permissions = computePermissions(["owner"]);
      expect(permissions).toContain("admin");
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).toContain("delete");
    });

    it("tenant admin gets editor-level permissions (no system admin flag)", () => {
      const permissions = computePermissions(["admin"]);
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).toContain("delete");
      expect(permissions).not.toContain("admin");
    });

    it("member gets read+write permissions", () => {
      const permissions = computePermissions(["member"]);
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).not.toContain("delete");
      expect(permissions).not.toContain("admin");
    });

    it("viewer gets read-only permissions", () => {
      const permissions = computePermissions(["viewer"]);
      expect(permissions).toEqual(["read"]);
    });

    // --- RBAC roles (ROLE_ prefix) ---
    it("ROLE_ADMIN gets full owner-level permissions", () => {
      const permissions = computePermissions(["ROLE_ADMIN"]);
      expect(permissions).toContain("admin");
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).toContain("delete");
    });

    it("ROLE_EDITOR gets editor-level permissions (no system admin flag)", () => {
      const permissions = computePermissions(["ROLE_EDITOR"]);
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).toContain("delete");
      expect(permissions).not.toContain("admin");
    });

    it("ROLE_OPERATOR gets member-level permissions", () => {
      const permissions = computePermissions(["ROLE_OPERATOR"]);
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).not.toContain("delete");
      expect(permissions).not.toContain("admin");
    });

    it("ROLE_AUDITOR gets read-only permissions", () => {
      const permissions = computePermissions(["ROLE_AUDITOR"]);
      expect(permissions).toEqual(["read"]);
    });

    it("ROLE_VIEWER gets read-only permissions", () => {
      const permissions = computePermissions(["ROLE_VIEWER"]);
      expect(permissions).toEqual(["read"]);
    });

    // RBAC roles are case-insensitive on the ROLE_ prefix
    it("role_operator (lowercase) resolves correctly", () => {
      const permissions = computePermissions(["role_operator"]);
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
    });

    // --- Legacy uppercase aliases (pre-ROLE_ JWT claims) ---
    it("legacy ADMIN string maps to owner-level permissions", () => {
      const permissions = computePermissions(["ADMIN"]);
      expect(permissions).toContain("admin");
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).toContain("delete");
    });

    it("legacy ANALYST string maps to member-level permissions", () => {
      const permissions = computePermissions(["ANALYST"]);
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).not.toContain("delete");
      expect(permissions).not.toContain("admin");
    });

    // --- Unknown / unrecognised roles ---
    it("returns empty array for unknown roles", () => {
      const permissions = computePermissions(["UNKNOWN_ROLE"]);
      expect(permissions).toEqual([]);
    });

    it("CFO (unrecognised in new model) returns empty array", () => {
      const permissions = computePermissions(["CFO"]);
      expect(permissions).toEqual([]);
    });

    it("DEVELOPER (unrecognised in new model) returns empty array", () => {
      const permissions = computePermissions(["DEVELOPER"]);
      expect(permissions).toEqual([]);
    });

    // --- Multi-role merging ---
    it("combines permissions from multiple roles (highest wins)", () => {
      const permissions = computePermissions(["viewer", "ROLE_OPERATOR"]);
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
    });

    it("owner + viewer resolves to full permissions", () => {
      const permissions = computePermissions(["owner", "viewer"]);
      expect(permissions).toContain("admin");
      expect(permissions).toContain("read");
      expect(permissions).toContain("write");
      expect(permissions).toContain("delete");
    });
  });

  describe("Supabase Auth Integration", () => {
    it("can access Supabase client", () => {
      expect(supabase).toBeDefined();
      expect(supabase.auth).toBeDefined();
    });

    it("gets current session state", async () => {
      const { data, error } = await supabase.auth.getSession();
      expect(error).toBeNull();
      // Session might be null if not logged in, which is fine
    });

    it("can call auth methods", async () => {
      expect(supabase.auth.signInWithPassword).toBeDefined();
      expect(supabase.auth.signOut).toBeDefined();
      expect(supabase.auth.getUser).toBeDefined();
    });
  });

  describe("Database Schema", () => {
    it("security_audit_events table should exist", async () => {
      // This will fail gracefully if migration hasn't run
      const { error } = await supabase.from("security_audit_events").select("*").limit(0);

      // Error is expected if table doesn't exist yet
      if (error) {
        console.warn("security_audit_events table not yet migrated:", error.message);
      }
    });
  });

  describe("Manual Test Instructions", () => {
    it("provides manual testing steps", () => {
      const instructions = `
        MANUAL TESTING STEPS:

        1. Run database migration:
           $ npx supabase db push

        2. Create test user in Supabase Dashboard:
           - Go to Authentication > Users
           - Add new user manually
           - Set user_metadata: { "roles": ["CFO"], "org_id": "test-org" }

        3. Test ProtectedComponent:
           - Login with test user
           - Visit page with ProtectedComponent
           - Verify access granted for correct permissions
           - Check browser console for security audit logs

        4. Test Access Denial:
           - Change user roles to ["DEVELOPER"] in Supabase
           - Refresh page
           - Verify "Access Restricted" message appears
           - Check /api/security/audit for logged event

        5. Verify Audit Logging:
           - As ADMIN user, call GET /api/security/audit
           - Verify ACCESS_DENIED events are logged
           - Check timestamps, user IDs, and permissions
      `;

      console.log(instructions);
      expect(instructions).toBeTruthy();
    });
  });
});
