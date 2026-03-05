import {
  HumanCheckpointBroker,
  HumanCheckpointEvent,
  HumanCheckpointEventPayload,
} from "@valueos/sdui";

import { logger } from "@/utils/logger";

import { RedisStreamBroker, StreamEvent } from "./RedisStreamBroker";

export class HumanCheckpointBrokerAdapter implements HumanCheckpointBroker {
  private readonly subscribers = new Set<
    (event: HumanCheckpointEvent) => Promise<void> | void
  >();
  private consumerStarted = false;

  constructor(private readonly broker: RedisStreamBroker) {}

  subscribe(handler: (event: HumanCheckpointEvent) => Promise<void> | void): () => void {
    this.subscribers.add(handler);
    this.ensureConsumer();

    return () => {
      this.subscribers.delete(handler);
    };
  }

  async publishCheckpointEvent(payload: HumanCheckpointEventPayload): Promise<void> {
    await this.broker.publish("agent.action.checkpoint", payload);
  }

  private ensureConsumer(): void {
    if (this.consumerStarted) {
      return;
    }

    this.consumerStarted = true;
    void this.broker
      .startConsumer(async (event: StreamEvent<"agent.action.checkpoint">) => {
        if (event.name !== "agent.action.checkpoint") {
          return;
        }

        const mappedEvent: HumanCheckpointEvent = {
          name: event.name,
          payload: event.payload,
        };

        for (const subscriber of this.subscribers) {
          await subscriber(mappedEvent);
        }
      })
      .catch((error: unknown) => {
        logger.error("Human checkpoint broker consumer stopped", error as Error);
        this.consumerStarted = false;
      });
  }
}
