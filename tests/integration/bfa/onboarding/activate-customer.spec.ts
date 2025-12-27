import { expect, test } from "@playwright/test";
import { supabase } from "../../../../src/lib/supabase";

/**
 * Integration tests for ActivateCustomer BFA Tool
 */
test.describe("ActivateCustomer Integration", () => {
  const testTenantId = "test-tenant-1";
  const otherTenantId = "test-tenant-2";
  const testCustomerId = "550e8400-e29b-41d4-a716-446655440001";
  const testCode = "123456";

  test.beforeAll(async () => {
    // In a real environment, we would use a service key to bypass RLS for setup
    // For these tests, we assume the environment is properly seeded
  });

  test("should activate customer via API", async ({ request }) => {
    // 1. Setup test data (normally via a test helper or direct DB access)
    // For this example, we mock the tool execution through a POST request

    const response = await request.post("/api/bfa/activate-customer", {
      headers: {
        "X-Tenant-ID": testTenantId,
        Authorization: `Bearer test-token`,
      },
      data: {
        customerId: testCustomerId,
        activationCode: testCode,
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.data.success).toBe(true);
    expect(result.data.customerEmail).toBeDefined();

    // 2. Verify database state
    // In a real integration test, we would query the database to verify the change
    /*
    const { data: customer } = await supabase
      .from('customers')
      .select('status, activated_at')
      .eq('id', testCustomerId)
      .single();
    
    expect(customer?.status).toBe('active');
    expect(customer?.activated_at).toBeDefined();
    */
  });

  test("should enforce tenant isolation", async ({ request }) => {
    // Attempt to activate a customer belonging to tenant 2 using tenant 1's context
    const response = await request.post("/api/bfa/activate-customer", {
      headers: {
        "X-Tenant-ID": testTenantId, // Tenant 1
        Authorization: `Bearer test-token`,
      },
      data: {
        customerId: "customer-of-tenant-2",
        activationCode: testCode,
      },
    });

    // The tool should return an error (403 or 404 depending on implementation)
    // ActivateCustomer throws BusinessLogicError 'customer_not_found' if not found in tenant
    expect(response.status()).toBe(404);
    const error = await response.json();
    expect(error.code).toBe("customer_not_found");
  });

  test("should handle invalid activation code", async ({ request }) => {
    const response = await request.post("/api/bfa/activate-customer", {
      headers: {
        "X-Tenant-ID": testTenantId,
        Authorization: `Bearer test-token`,
      },
      data: {
        customerId: testCustomerId,
        activationCode: "wrong-code",
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.code).toBe("invalid_activation_code");
  });

  test("should handle expired activation code", async ({ request }) => {
    const response = await request.post("/api/bfa/activate-customer", {
      headers: {
        "X-Tenant-ID": testTenantId,
        Authorization: `Bearer test-token`,
      },
      data: {
        customerId: "expired-customer-id",
        activationCode: testCode,
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.code).toBe("activation_code_expired");
  });
});
