import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  HumanCheckpoint,
  HumanCheckpointBroker,
  HumanCheckpointDependencies,
  HumanCheckpointStreamEvent,
} from "../HumanCheckpoint";

class MockHumanCheckpointBroker implements HumanCheckpointBroker {
  private handler: ((event: HumanCheckpointStreamEvent) => Promise<void>) | null = null;
  public readonly publish = vi.fn(async () => undefined);
  public readonly unsubscribe = vi.fn();

  async emit(event: HumanCheckpointStreamEvent): Promise<void> {
    if (this.handler) {
      await this.handler(event);
    }
  }

  subscribe(handler: (event: HumanCheckpointStreamEvent) => Promise<void>) {
    this.handler = handler;

    return () => {
      this.unsubscribe();
      this.handler = null;
    };
  }
}

function renderCheckpoint(
  broker: MockHumanCheckpointBroker,
  overrides?: Partial<React.ComponentProps<typeof HumanCheckpoint>>
) {
  const dependencies: HumanCheckpointDependencies = {
    auth: { user: { id: "user-123" } },
    broker,
  };

  const onApproval = vi.fn();
  const onPause = vi.fn();
  const onResume = vi.fn();

  const result = render(
    <HumanCheckpoint
      sessionId="session-1"
      tenantId="tenant-1"
      onApproval={onApproval}
      onPause={onPause}
      onResume={onResume}
      dependencies={dependencies}
      {...overrides}
    />
  );

  return { ...result, onApproval, onPause, onResume };
}

describe("HumanCheckpoint", () => {
  it("subscribes to checkpoint events and unsubscribes on unmount", async () => {
    const broker = new MockHumanCheckpointBroker();
    const { unmount, onPause } = renderCheckpoint(broker);

    await broker.emit({
      name: "agent.action.checkpoint",
      payload: {
        idempotencyKey: "checkpoint-1",
        sessionId: "session-1",
        tenantId: "tenant-1",
        actionType: "deploy",
        actionData: { target: "prod" },
        requiresApproval: true,
        reason: "High risk deployment",
        emittedAt: new Date().toISOString(),
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Agent Action Requires Approval")).toBeInTheDocument();
    });
    expect(onPause).toHaveBeenCalledTimes(1);

    unmount();
    expect(broker.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("publishes approval decisions with tenant/session and idempotency references", async () => {
    const broker = new MockHumanCheckpointBroker();
    const { onApproval, onResume } = renderCheckpoint(broker);

    await broker.emit({
      name: "agent.action.checkpoint",
      payload: {
        idempotencyKey: "checkpoint-approve",
        sessionId: "session-1",
        tenantId: "tenant-1",
        actionType: "publish_report",
        actionData: { reportId: "r-1" },
        requiresApproval: true,
        reason: "Requires legal signoff",
        emittedAt: new Date().toISOString(),
      },
    });

    fireEvent.click(await screen.findByText("Approve"));

    await waitFor(() => {
      expect(broker.publish).toHaveBeenCalledTimes(1);
    });

    expect(broker.publish).toHaveBeenCalledWith(
      "agent.action.checkpoint",
      expect.objectContaining({
        tenantId: "tenant-1",
        sessionId: "session-1",
        checkpointIdempotencyKey: "checkpoint-approve",
        idempotencyKey: "checkpoint-approve:approved",
        actionData: expect.objectContaining({ approved: true }),
      })
    );
    expect(onApproval).toHaveBeenCalledWith(true, undefined);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("publishes rejection decisions with reason", async () => {
    const broker = new MockHumanCheckpointBroker();
    const { onApproval } = renderCheckpoint(broker);

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Needs revision");

    await broker.emit({
      name: "agent.action.checkpoint",
      payload: {
        idempotencyKey: "checkpoint-reject",
        sessionId: "session-1",
        tenantId: "tenant-1",
        actionType: "send_invoice",
        actionData: { invoiceId: "inv-5" },
        requiresApproval: true,
        reason: "Amount exceeds threshold",
        emittedAt: new Date().toISOString(),
      },
    });

    fireEvent.click(await screen.findByText("Reject"));

    await waitFor(() => {
      expect(broker.publish).toHaveBeenCalledTimes(1);
    });

    expect(broker.publish).toHaveBeenCalledWith(
      "agent.action.checkpoint",
      expect.objectContaining({
        checkpointIdempotencyKey: "checkpoint-reject",
        idempotencyKey: "checkpoint-reject:rejected",
        actionData: expect.objectContaining({ approved: false, reason: "Needs revision" }),
      })
    );
    expect(onApproval).toHaveBeenCalledWith(false, "Needs revision");

    promptSpy.mockRestore();
  });
});
