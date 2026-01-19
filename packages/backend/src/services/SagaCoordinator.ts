/**
 * Saga Coordinator Service
 *
 * Implements saga patterns for reliable workflow orchestration with
 * compensation logic for error handling and rollback.
 */

import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";
import { getEventProducer } from "./EventProducer";
import { EVENT_TOPICS } from "@shared/types/events";

export interface SagaStep {
  stepId: string;
  stepType: string;
  action: () => Promise<any>;
  compensate: () => Promise<void>;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface SagaDefinition {
  sagaType: string;
  steps: SagaStep[];
  onComplete?: (result: any) => Promise<void>;
  onFailure?: (error: Error) => Promise<void>;
  timeout?: number;
}

export type SagaStatus =
  | "started"
  | "executing"
  | "compensating"
  | "completed"
  | "failed"
  | "aborted";

export interface SagaState {
  sagaId: string;
  sagaType: string;
  correlationId: string;
  status: SagaStatus;
  currentStep: number;
  steps: Array<{
    stepId: string;
    status: "pending" | "executing" | "completed" | "failed" | "compensated";
    result?: any;
    error?: string;
    startTime?: Date;
    endTime?: Date;
    retryCount: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
  timeout?: number;
  error?: string;
}

export class SagaCoordinator {
  private activeSagas: Map<string, SagaState> = new Map();
  private sagaDefinitions: Map<string, SagaDefinition> = new Map();
  private eventProducer = getEventProducer();

  /**
   * Register a saga definition
   */
  registerSaga(definition: SagaDefinition): void {
    this.sagaDefinitions.set(definition.sagaType, definition);
    logger.info("Saga definition registered", {
      sagaType: definition.sagaType,
      stepCount: definition.steps.length,
    });
  }

  /**
   * Start a new saga
   */
  async startSaga(sagaType: string, correlationId: string, initialData?: any): Promise<string> {
    const definition = this.sagaDefinitions.get(sagaType);
    if (!definition) {
      throw new Error(`Saga definition not found: ${sagaType}`);
    }

    const sagaId = uuidv4();
    const now = new Date();

    const sagaState: SagaState = {
      sagaId,
      sagaType,
      correlationId,
      status: "started",
      currentStep: 0,
      steps: definition.steps.map((step) => ({
        stepId: step.stepId,
        status: "pending",
        retryCount: 0,
      })),
      createdAt: now,
      updatedAt: now,
      timeout: definition.timeout,
    };

    this.activeSagas.set(sagaId, sagaState);

    // Publish saga start event
    await this.eventProducer.publish(EVENT_TOPICS.SAGA_COMMANDS, {
      eventId: uuidv4(),
      correlationId,
      eventType: "saga.command",
      timestamp: now,
      version: "1.0.0",
      source: "saga-coordinator",
      payload: {
        sagaId,
        sagaType,
        command: "start_saga",
        payload: initialData,
      },
    });

    logger.info("Saga started", {
      sagaId,
      sagaType,
      correlationId,
      stepCount: definition.steps.length,
    });

    // Start executing the saga
    this.executeSaga(sagaState, definition).catch((error) => {
      logger.error("Saga execution failed", error as Error, {
        sagaId,
        sagaType,
        correlationId,
      });
    });

    return sagaId;
  }

  /**
   * Get saga state
   */
  getSagaState(sagaId: string): SagaState | null {
    return this.activeSagas.get(sagaId) || null;
  }

  /**
   * Abort a running saga
   */
  async abortSaga(sagaId: string, reason: string): Promise<void> {
    const sagaState = this.activeSagas.get(sagaId);
    if (!sagaState) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    if (sagaState.status === "completed" || sagaState.status === "failed") {
      logger.warn("Cannot abort completed or failed saga", {
        sagaId,
        sagaType: sagaState.sagaType,
      });
      return;
    }

    sagaState.status = "aborted";
    sagaState.error = reason;
    sagaState.updatedAt = new Date();

    // Publish abort event
    await this.eventProducer.publish(EVENT_TOPICS.SAGA_COMMANDS, {
      eventId: uuidv4(),
      correlationId: sagaState.correlationId,
      eventType: "saga.command",
      timestamp: new Date(),
      version: "1.0.0",
      source: "saga-coordinator",
      payload: {
        sagaId,
        sagaType: sagaState.sagaType,
        command: "abort_saga",
        reason,
      },
    });

    logger.info("Saga aborted", {
      sagaId,
      sagaType: sagaState.sagaType,
      reason,
    });

    this.activeSagas.delete(sagaId);
  }

  /**
   * Execute saga steps
   */
  private async executeSaga(sagaState: SagaState, definition: SagaDefinition): Promise<void> {
    const timeout = definition.timeout || 300000; // 5 minutes default
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Saga timeout")), timeout);
    });

    try {
      sagaState.status = "executing";

      // Execute each step
      for (let i = 0; i < definition.steps.length; i++) {
        const step = definition.steps[i];
        const stepState = sagaState.steps[i];

        await Promise.race([
          this.executeStep(sagaState, step, stepState, definition),
          timeoutPromise,
        ]);

        sagaState.currentStep = i + 1;

        // If step failed and we can't compensate, abort the saga
        if (stepState.status === "failed") {
          await this.compensateSaga(sagaState, definition, i);
          break;
        }
      }

      // Complete the saga
      if (sagaState.status === "executing") {
        sagaState.status = "completed";
        sagaState.updatedAt = new Date();

        // Call completion handler
        if (definition.onComplete) {
          await definition.onComplete(sagaState);
        }

        // Publish completion event
        await this.eventProducer.publish(EVENT_TOPICS.SAGA_COMMANDS, {
          eventId: uuidv4(),
          correlationId: sagaState.correlationId,
          eventType: "saga.command",
          timestamp: new Date(),
          version: "1.0.0",
          source: "saga-coordinator",
          payload: {
            sagaId: sagaState.sagaId,
            sagaType: sagaState.sagaType,
            command: "complete_saga",
          },
        });

        logger.info("Saga completed successfully", {
          sagaId: sagaState.sagaId,
          sagaType: sagaState.sagaType,
          correlationId: sagaState.correlationId,
        });
      }
    } catch (error) {
      sagaState.status = "failed";
      sagaState.error = (error as Error).message;
      sagaState.updatedAt = new Date();

      // Call failure handler
      if (definition.onFailure) {
        await definition.onFailure(error as Error);
      }

      logger.error("Saga failed", error as Error, {
        sagaId: sagaState.sagaId,
        sagaType: sagaState.sagaType,
        correlationId: sagaState.correlationId,
      });
    }

    // Clean up completed sagas after a delay
    setTimeout(() => {
      this.activeSagas.delete(sagaState.sagaId);
    }, 60000); // Keep for 1 minute for debugging
  }

  /**
   * Execute a single saga step with retry logic
   */
  private async executeStep(
    sagaState: SagaState,
    step: SagaStep,
    stepState: SagaState["steps"][0],
    definition: SagaDefinition
  ): Promise<void> {
    const maxRetries = step.retryCount || 3;
    const retryDelay = step.retryDelay || 1000;

    stepState.status = "executing";
    stepState.startTime = new Date();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        stepState.retryCount = attempt;

        const result = await step.action();
        stepState.result = result;
        stepState.status = "completed";
        stepState.endTime = new Date();

        // Publish step completion event
        await this.eventProducer.publish(EVENT_TOPICS.WORKFLOW_EVENTS, {
          eventId: uuidv4(),
          correlationId: sagaState.correlationId,
          eventType: "workflow.step",
          timestamp: new Date(),
          version: "1.0.0",
          source: "saga-coordinator",
          payload: {
            workflowId: sagaState.sagaId,
            stepId: step.stepId,
            workflowType: sagaState.sagaType,
            stepType: step.stepType,
            status: "completed",
            input: stepState.result,
            output: result,
            duration: stepState.endTime.getTime() - stepState.startTime!.getTime(),
          },
        });

        return;
      } catch (error) {
        logger.warn("Saga step failed, retrying", {
          sagaId: sagaState.sagaId,
          stepId: step.stepId,
          attempt: attempt + 1,
          maxRetries,
          error: (error as Error).message,
        });

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        } else {
          stepState.status = "failed";
          stepState.error = (error as Error).message;
          stepState.endTime = new Date();

          // Publish step failure event
          await this.eventProducer.publish(EVENT_TOPICS.WORKFLOW_EVENTS, {
            eventId: uuidv4(),
            correlationId: sagaState.correlationId,
            eventType: "workflow.step",
            timestamp: new Date(),
            version: "1.0.0",
            source: "saga-coordinator",
            payload: {
              workflowId: sagaState.sagaId,
              stepId: step.stepId,
              workflowType: sagaState.sagaType,
              stepType: step.stepType,
              status: "failed",
              input: stepState.result,
              error: (error as Error).message,
              duration: stepState.endTime.getTime() - stepState.startTime!.getTime(),
              retryCount: attempt,
            },
          });

          throw error;
        }
      }
    }
  }

  /**
   * Compensate failed saga steps
   */
  private async compensateSaga(
    sagaState: SagaState,
    definition: SagaDefinition,
    failedStepIndex: number
  ): Promise<void> {
    sagaState.status = "compensating";
    sagaState.updatedAt = new Date();

    logger.info("Starting saga compensation", {
      sagaId: sagaState.sagaId,
      sagaType: sagaState.sagaType,
      failedStepIndex,
    });

    // Compensate completed steps in reverse order
    for (let i = failedStepIndex - 1; i >= 0; i--) {
      const step = definition.steps[i];
      const stepState = sagaState.steps[i];

      if (stepState.status === "completed") {
        try {
          await step.compensate();
          stepState.status = "compensated";

          // Publish compensation event
          await this.eventProducer.publish(EVENT_TOPICS.WORKFLOW_EVENTS, {
            eventId: uuidv4(),
            correlationId: sagaState.correlationId,
            eventType: "workflow.step",
            timestamp: new Date(),
            version: "1.0.0",
            source: "saga-coordinator",
            payload: {
              workflowId: sagaState.sagaId,
              stepId: step.stepId,
              workflowType: sagaState.sagaType,
              stepType: step.stepType,
              status: "compensated",
            },
          });

          logger.info("Saga step compensated", {
            sagaId: sagaState.sagaId,
            stepId: step.stepId,
          });
        } catch (compensationError) {
          logger.error("Saga compensation failed", compensationError as Error, {
            sagaId: sagaState.sagaId,
            stepId: step.stepId,
          });
          // Continue compensating other steps even if one fails
        }
      }
    }

    sagaState.status = "failed";
  }

  /**
   * Get active sagas count
   */
  getActiveSagasCount(): number {
    return this.activeSagas.size;
  }

  /**
   * Get registered saga types
   */
  getRegisteredSagaTypes(): string[] {
    return Array.from(this.sagaDefinitions.keys());
  }
}

/**
 * Singleton saga coordinator instance
 */
let sagaCoordinator: SagaCoordinator | null = null;

export function getSagaCoordinator(): SagaCoordinator {
  if (!sagaCoordinator) {
    sagaCoordinator = new SagaCoordinator();
  }
  return sagaCoordinator;
}
