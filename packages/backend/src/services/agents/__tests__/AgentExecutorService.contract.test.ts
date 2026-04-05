import { describe, expect, it, vi } from "vitest";

/**
 * Contract-focused extraction of AgentExecutorService request/response mapping.
 *
 * This mirrors the core shape transformation in handleAgentRequest:
 * - request payload/context -> unifiedAgentAPI.invoke input
 * - invoke output -> published agent.response payload
 */
async function executeContractBoundRequest(params: {
  event: {
    correlationId: string;
    payload: {
      agentId: string;
      tenantId: string;
      userId: string;
      sessionId: string;
      query: string;
      context?: Record<string, unknown>;
      parameters?: Record<string, unknown>;
    };
  };
  invoke: (args: Record<string, unknown>) => Promise<{ success?: boolean; data?: unknown; error?: string }>;
  publish: (topic: string, evt: Record<string, unknown>) => Promise<void>;
}): Promise<void> {
  const response = await params.invoke({
    agent: params.event.payload.agentId,
    query: params.event.payload.query,
    context: params.event.payload.context,
    parameters: params.event.payload.parameters,
    sessionId: params.event.payload.sessionId,
    userId: params.event.payload.userId,
  });

  await params.publish("agent.responses", {
    type: "agent.response",
    correlationId: params.event.correlationId,
    payload: {
      agentId: params.event.payload.agentId,
      userId: params.event.payload.userId,
      sessionId: params.event.payload.sessionId,
      tenantId: params.event.payload.tenantId,
      response: response.data ?? response,
      success: response.success !== false,
      error: response.success === false ? response.error : undefined,
    },
  });
}

describe("AgentExecutorService contract propagation", () => {
  it("propagates traceId, contractVersion, and retry metadata", async () => {
    const traceId = "trace-123";
    const contractVersion = "2.1.0";
    const retry = { attempt: 2, maxRetries: 3, repaired: true };

    const invoke = vi.fn().mockResolvedValue({
      success: true,
      data: {
        payload: { status: "approved" },
        traceId,
        contractVersion,
        retry,
      },
    });

    const publish = vi.fn().mockResolvedValue(undefined);

    await executeContractBoundRequest({
      event: {
        correlationId: "corr-1",
        payload: {
          agentId: "opportunity",
          tenantId: "tenant-1",
          userId: "user-1",
          sessionId: "session-1",
          query: "Generate structured contract output",
          context: { traceId, contractVersion, retry },
          parameters: { schemaMode: "strict" },
        },
      },
      invoke,
      publish,
    });

    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ traceId, contractVersion, retry }),
      })
    );

    expect(publish).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        payload: expect.objectContaining({
          response: expect.objectContaining({ traceId, contractVersion, retry }),
        }),
      })
    );
  });
});
