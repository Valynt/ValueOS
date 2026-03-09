import { logger } from "./logger";

export interface CheckpointEvent {
  checkpointId: string;
  executionId: string;
  stageId: string;
  agentId: string;
  action: string;
  riskLevel: "low" | "medium" | "high";
  confidence?: number;
  reasoning?: string;
}

export type CheckpointHandler = (event: CheckpointEvent) => void;

/**
 * SSE-based broker for human checkpoint events.
 *
 * Subscribes to the backend SSE stream and dispatches parsed events to
 * registered handlers. Follows the codebase pattern of closing and nulling
 * the EventSource on error so callers can detect disconnection and reconnect.
 */
export class HumanCheckpointBroker {
  private eventSource: EventSource | null = null;
  private readonly handlers = new Set<CheckpointHandler>();
  private readonly url: string;

  constructor(url = "/api/admin/checkpoints/stream") {
    this.url = url;
  }

  subscribe(handler: CheckpointHandler): () => void {
    this.handlers.add(handler);
    if (!this.eventSource) {
      this.connect();
    }
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) {
        this.disconnect();
      }
    };
  }

  private connect(): void {
    this.eventSource = new EventSource(this.url, { withCredentials: true });

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CheckpointEvent;
        for (const handler of this.handlers) {
          handler(data);
        }
      } catch {
        // Ignore malformed events from upstream proxies.
      }
    };

    // Close and null the source on error so subscribers can detect
    // disconnection. Matches the pattern used in useComplianceLiveStatus.
    this.eventSource.onerror = () => {
      logger.error("Human checkpoint SSE connection lost");
      this.eventSource?.close();
      this.eventSource = null;
    };
  }

  private disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

export const humanCheckpointBroker = new HumanCheckpointBroker();
