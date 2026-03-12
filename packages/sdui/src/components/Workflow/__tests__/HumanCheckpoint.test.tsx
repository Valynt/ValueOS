import React from "react";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HumanCheckpoint } from "../HumanCheckpoint.tsx";
import {
  HumanCheckpointBroker,
  HumanCheckpointDependenciesProvider,
  HumanCheckpointEvent,
  HumanCheckpointEventPayload,
} from "../HumanCheckpointDependencies";

class MockBroker implements HumanCheckpointBroker {
  public publishCheckpointEvent = vi.fn<
    (payload: HumanCheckpointEventPayload) => Promise<void>
  >(async () => {});

  private handlers = new Set<(event: HumanCheckpointEvent) => Promise<void> | void>();

  subscribe(handler: (event: HumanCheckpointEvent) => Promise<void> | void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  async emit(event: HumanCheckpointEvent): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }

  get subscriberCount(): number {
    return this.handlers.size;
  }
}

function createCheckpointPayload(overrides: Partial<HumanCheckpointEventPayload> = {}): HumanCheckpointEventPayload {
  return {
    schemaVersion: "1.0.0",
    idempotencyKey: "checkpoint-1",
    emittedAt: "2026-01-01T00:00:00.000Z",
    tenantId: "tenant-1",
    sessionId: "session-1",
    userId: "user-1",
    actionType: "commit_change",
    actionData: { branch: "main" },
    requiresApproval: true,
    reason: "Needs review",
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  if (root) {
    act(() => {
      root.unmount();
    });
  }
  container?.remove();
});

function renderWithProvider(broker: MockBroker, onPause = vi.fn(), onApproval = vi.fn(), onResume = vi.fn()) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root.render(
      <HumanCheckpointDependenciesProvider value={{ auth: { userId: "user-42" }, broker }}>
        <HumanCheckpoint
          sessionId="session-1"
          tenantId="tenant-1"
          onApproval={onApproval}
          onPause={onPause}
          onResume={onResume}
        />
      </HumanCheckpointDependenciesProvider>,
    );
  });

  return { onPause, onApproval, onResume };
}

describe("HumanCheckpoint", () => {
  it("subscribes, updates pending state, and unsubscribes on unmount", async () => {
    const broker = new MockBroker();
    const { onPause } = renderWithProvider(broker);

    expect(broker.subscriberCount).toBe(1);

    await act(async () => {
      await broker.emit({
        name: "agent.action.checkpoint",
        payload: createCheckpointPayload(),
      });
    });

    expect(container.textContent).toContain("Agent Action Requires Approval");
    expect(container.textContent).toContain("Needs review");
    expect(onPause).toHaveBeenCalledTimes(1);

    await act(async () => {
      await broker.emit({
        name: "agent.action.checkpoint",
        payload: createCheckpointPayload(),
      });
    });

    expect(container.querySelectorAll(".checkpoint-action")).toHaveLength(1);

    act(() => {
      root.unmount();
    });

    expect(broker.subscriberCount).toBe(0);
  });

  it("publishes approval decision with tenant/session and idempotency linkage", async () => {
    const broker = new MockBroker();
    const { onApproval, onResume } = renderWithProvider(broker);

    await act(async () => {
      await broker.emit({
        name: "agent.action.checkpoint",
        payload: createCheckpointPayload(),
      });
    });

    const approveButton = container.querySelector(".approve-btn") as HTMLButtonElement;
    expect(approveButton).toBeTruthy();

    await act(async () => {
      approveButton.click();
    });

    expect(broker.publishCheckpointEvent).toHaveBeenCalledTimes(1);
    const publishedPayload = broker.publishCheckpointEvent.mock.calls[0]?.[0];
    expect(publishedPayload?.tenantId).toBe("tenant-1");
    expect(publishedPayload?.sessionId).toBe("session-1");
    expect(publishedPayload?.idempotencyKey).toBe("checkpoint-1:approved");
    expect(publishedPayload?.checkpointIdempotencyKey).toBe("checkpoint-1");
    expect(publishedPayload?.actionData).toMatchObject({ actionId: "checkpoint-1", approved: true });
    expect(onApproval).toHaveBeenCalledWith(true, undefined);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("publishes rejection decision with reason", async () => {
    const broker = new MockBroker();
    const { onApproval } = renderWithProvider(broker);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Insufficient evidence");

    await act(async () => {
      await broker.emit({
        name: "agent.action.checkpoint",
        payload: createCheckpointPayload(),
      });
    });

    const rejectButton = container.querySelector(".reject-btn") as HTMLButtonElement;

    await act(async () => {
      rejectButton.click();
    });

    expect(broker.publishCheckpointEvent).toHaveBeenCalledTimes(1);
    const publishedPayload = broker.publishCheckpointEvent.mock.calls[0]?.[0];
    expect(publishedPayload?.actionData).toMatchObject({
      actionId: "checkpoint-1",
      approved: false,
      reason: "Insufficient evidence",
    });
    expect(publishedPayload?.idempotencyKey).toBe("checkpoint-1:rejected");
    expect(onApproval).toHaveBeenCalledWith(false, "Insufficient evidence");

    promptSpy.mockRestore();
  });
});
