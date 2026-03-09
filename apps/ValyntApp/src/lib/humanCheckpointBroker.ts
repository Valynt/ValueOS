/**
 * HTTP-based HumanCheckpointBroker for the frontend.
 *
 * Publishes checkpoint events to the backend API instead of connecting
 * to Redis directly. Subscriptions are handled via SSE from the backend.
 */

import type {
  HumanCheckpointBroker,
  HumanCheckpointEvent,
  HumanCheckpointEventPayload,
} from "@valueos/sdui";

export class HttpHumanCheckpointBroker implements HumanCheckpointBroker {
  private readonly handlers = new Set<
    (event: HumanCheckpointEvent) => Promise<void> | void
  >();
  private eventSource: EventSource | null = null;

  subscribe(
    handler: (event: HumanCheckpointEvent) => Promise<void> | void,
  ): () => void {
    this.handlers.add(handler);
    this.ensureEventSource();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) {
        this.eventSource?.close();
        this.eventSource = null;
      }
    };
  }

  async publishCheckpointEvent(payload: HumanCheckpointEventPayload): Promise<void> {
    await fetch("/api/checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  private ensureEventSource(): void {
    if (this.eventSource) return;
    this.eventSource = new EventSource("/api/checkpoints/stream");
    this.eventSource.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as HumanCheckpointEvent;
        for (const handler of this.handlers) {
          void handler(event);
        }
      } catch {
        // malformed event — ignore
      }
    };
  }
}

export const humanCheckpointBroker = new HttpHumanCheckpointBroker();
