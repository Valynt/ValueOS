import assert from "node:assert/strict";
import test from "node:test";

class TenantIsolatedStore {
  #rows = new Map();

  write(contextTenantId, row) {
    if (!contextTenantId) throw new Error("tenant_required");

    const effectiveTenant = row.tenantId ?? contextTenantId;
    if (effectiveTenant !== contextTenantId) {
      throw new Error("cross_tenant_write_blocked");
    }

    this.#rows.set(row.id, { ...row, tenantId: contextTenantId });
  }

  read(contextTenantId, id) {
    if (!contextTenantId) throw new Error("tenant_required");

    const row = this.#rows.get(id);
    if (!row) return null;
    if (row.tenantId !== contextTenantId) return null;
    return row;
  }

  size() {
    return this.#rows.size;
  }
}

test("multi-tenant chaos: no cross-tenant read/write leakage", () => {
  const store = new TenantIsolatedStore();
  const idsA = [];
  const idsB = [];

  for (let i = 0; i < 150; i += 1) {
    const context = i % 2 === 0 ? "tenant-a" : "tenant-b";
    const target = Math.random() > 0.8 ? (context === "tenant-a" ? "tenant-b" : "tenant-a") : context;
    const id = `${context}-${i}`;

    if (target !== context) {
      assert.throws(() => store.write(context, { id, tenantId: target, payload: "blocked" }), /cross_tenant_write_blocked/);
    } else {
      store.write(context, { id, payload: `payload-${i}` });
      if (context === "tenant-a") idsA.push(id);
      else idsB.push(id);
    }
  }

  for (const id of idsA) {
    assert.equal(store.read("tenant-a", id)?.tenantId, "tenant-a");
    assert.equal(store.read("tenant-b", id), null);
  }

  for (const id of idsB) {
    assert.equal(store.read("tenant-b", id)?.tenantId, "tenant-b");
    assert.equal(store.read("tenant-a", id), null);
  }

  assert.ok(store.size() > 0);
});

test("multi-tenant invariants: fail closed without tenant context", () => {
  const store = new TenantIsolatedStore();
  assert.throws(() => store.write(undefined, { id: "x", payload: "y" }), /tenant_required/);
  assert.throws(() => store.read(undefined, "x"), /tenant_required/);
});
