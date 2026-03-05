import {
  HumanCheckpointBroker,
  HumanCheckpointStreamEvent,
} from "@valueos/sdui";

import { EventPayloadMap } from "./EventSchemas";
import { RedisStreamBroker } from "./RedisStreamBroker";

const CHECKPOINT_STREAM = "agent.action.checkpoint" as const;

type CheckpointHandler = (event: HumanCheckpointStreamEvent) => Promise<void>;

export class SDUIHumanCheckpointBrokerAdapter implements HumanCheckpointBroker {
  private readonly broker: RedisStreamBroker;
  private readonly handlers = new Set<CheckpointHandler>();
  private consumerStarted = false;

  constructor(broker?: RedisStreamBroker) {
    this.broker = broker ?? new RedisStreamBroker({ streamName: "agent.checkpoints" });
  }

  subscribe(handler: CheckpointHandler): () => void {
    this.handlers.add(handler);

    if (!this.consumerStarted) {
      this.consumerStarted = true;
      void this.broker.startConsumer(async (event) => {
        if (event.name !== CHECKPOINT_STREAM) {
          return;
        }

        const normalizedEvent: HumanCheckpointStreamEvent = {
          name: event.name,
          payload: event.payload as Record<string, unknown>,
        };

        await Promise.all(Array.from(this.handlers).map((activeHandler) => activeHandler(normalizedEvent)));
      });
    }

    return () => {
      this.handlers.delete(handler);
    };
  }

  async publish(stream: string, data: Record<string, unknown>): Promise<void> {
    if (stream !== CHECKPOINT_STREAM) {
      throw new Error(`Unsupported checkpoint stream: ${stream}`);
    }

    await this.broker.publish(CHECKPOINT_STREAM, data as EventPayloadMap[typeof CHECKPOINT_STREAM]);
  }
}
