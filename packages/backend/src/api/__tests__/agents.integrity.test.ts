import request from "supertest";
import express from "express";
import agentsRouter from "../../api/agents";
import { getEventProducer } from "../../services/EventProducer";

vi.mock("../../services/EventProducer");

// Mock AuditTrailService
const mockLogImmediate = vi.fn().mockResolvedValue("audit-id-1");
vi.mock("../../services/security/AuditTrailService", () => ({
  getAuditTrailService: () => ({
    logImmediate: mockLogImmediate,
  }),
}));

describe("POST /api/agents/integrity/veto", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Inject simple auth/tenant middleware for test
    app.use((req: any, _res, next) => {
      req.user = { id: "test-user", sub: "auth0|test-user" };
      req.tenantId = "test-tenant";
      next();
    });

    app.use("/api/agents", agentsRouter);
  });

  it("enqueues integrity veto and logs audit event", async () => {
    const fakeProducer = { publish: vi.fn().mockResolvedValue(true) };
    (getEventProducer as unknown as vi.Mock).mockReturnValue(fakeProducer);

    const res = await request(app)
      .post("/api/agents/integrity/veto")
      .send({ issueId: "issue-123", resolution: "accept", modifiedOutput: { foo: "bar" } })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBeDefined();

    expect(fakeProducer.publish).toHaveBeenCalled();
    expect(mockLogImmediate).toHaveBeenCalled();

    const [[topic, event]] = fakeProducer.publish.mock.calls;
    expect(topic).toBeDefined();
    expect(event.payload.parameters.issueId).toBe("issue-123");
    expect(event.payload.externalSub).toBe("auth0|test-user");

    const [auditArg] = mockLogImmediate.mock.calls[0];
    expect(auditArg.externalSub).toBe("auth0|test-user");
  });
});
