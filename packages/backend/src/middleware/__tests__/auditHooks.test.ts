import { beforeEach, describe, expect, it, vi } from "vitest";

const logAuditMock = vi.fn(async () => undefined);

vi.mock("../../services/AuditLogService", () => ({
  auditLogService: {
    logAudit: logAuditMock,
  },
}));

const { auditBulkDelete, auditOperation, auditPermissionChange, auditRoleAssignment } = await import("../auditHooks");
const { AUDIT_ACTION } = await import("../../types/audit");

describe("auditHooks taxonomy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits canonical RBAC permission actions", async () => {
    const middleware = auditPermissionChange();
    const req: any = { method: "POST", body: { userId: "u1", permission: "x" }, params: {}, ip: "1.1.1.1", get: vi.fn() };
    const res: any = { statusCode: 200, json: vi.fn((d: unknown) => d) };
    middleware(req, res, vi.fn());
    res.json({});
    await new Promise((r) => setImmediate(r));
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: AUDIT_ACTION.RBAC_PERMISSION_GRANT }));
  });

  it("emits canonical RBAC role actions", async () => {
    const middleware = auditRoleAssignment();
    const req: any = { method: "DELETE", body: { userId: "u1", role: "admin", assigned: false }, params: {}, ip: "1.1.1.1", get: vi.fn() };
    const res: any = { statusCode: 200, json: vi.fn((d: unknown) => d) };
    middleware(req, res, vi.fn());
    res.json({});
    await new Promise((r) => setImmediate(r));
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: AUDIT_ACTION.RBAC_ROLE_REMOVE }));
  });

  it("maps bulk delete to canonical data.delete", async () => {
    const middleware = auditBulkDelete("team");
    const req: any = { body: { ids: ["1"] }, params: {}, ip: "1.1.1.1", get: vi.fn() };
    const res: any = { statusCode: 200, json: vi.fn((d: unknown) => d) };
    middleware(req, res, vi.fn());
    res.json({ deletedCount: 1 });
    await new Promise((r) => setImmediate(r));
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: AUDIT_ACTION.DATA_DELETE }));
  });

  it("requires taxonomy action for generic operations", async () => {
    const middleware = auditOperation(AUDIT_ACTION.ADMIN_SECURITY, "admin");
    const req: any = { method: "POST", path: "/api/admin", params: {}, ip: "1.1.1.1", get: vi.fn() };
    const res: any = { statusCode: 200, json: vi.fn((d: unknown) => d) };
    middleware(req, res, vi.fn());
    res.json({});
    await new Promise((r) => setImmediate(r));
    expect(logAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: AUDIT_ACTION.ADMIN_SECURITY }));
  });
});
