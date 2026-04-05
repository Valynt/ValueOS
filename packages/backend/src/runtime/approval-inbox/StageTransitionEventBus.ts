import { EventEmitter } from "events";

export type StageTransitionSource = "execution-runtime" | "decision-router";

export interface StageTransitionEvent {
  source: StageTransitionSource;
  organizationId: string;
  runId: string;
  stageId: string;
  transition: "stage_started" | "stage_completed" | "stage_failed" | "stage_waiting_approval" | "stage_routed";
  metadata: Record<string, unknown>;
}

const STAGE_TRANSITION_EVENT_NAME = "stage-transition";

export class StageTransitionEventBus {
  private readonly emitter = new EventEmitter();

  publish(event: StageTransitionEvent): void {
    this.emitter.emit(STAGE_TRANSITION_EVENT_NAME, event);
  }

  subscribe(handler: (event: StageTransitionEvent) => void): () => void {
    this.emitter.on(STAGE_TRANSITION_EVENT_NAME, handler);
    return () => this.emitter.off(STAGE_TRANSITION_EVENT_NAME, handler);
  }
}

export const stageTransitionEventBus = new StageTransitionEventBus();
