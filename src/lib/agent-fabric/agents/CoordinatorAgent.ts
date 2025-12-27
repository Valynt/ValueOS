/**
 * CoordinatorAgent - DAG Task Decomposition & Orchestration
 *
 * The CoordinatorAgent is responsible for:
 * 1. Decomposing user intent into directed acyclic graphs (DAGs) of tasks
 * 2. Routing tasks to appropriate specialized agents
 * 3. Managing task dependencies and execution order
 * 4. Aggregating results from multiple agent executions
 */

import { z } from "zod";
import { BaseAgent } from "./BaseAgent";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LLMGateway } from "../../llm/gateway";
import type { MemorySystem } from "../../memory/system";
import type { AuditLogger } from "../../audit/logger";

// ============================================================================
// Types
// ============================================================================

export interface CoordinatorAgentConfig {
  supabase: SupabaseClient;
  llmGateway: LLMGateway;
  memorySystem: MemorySystem;
  auditLogger: AuditLogger;
  organizationId: string;
  userId: string;
}

export interface TaskNode {
  id: string;
  agentType:
    | "opportunity"
    | "target"
    | "realization"
    | "expansion"
    | "integrity"
    | "communicator";
  action: string;
  inputs: Record<string, unknown>;
  dependencies: string[]; // IDs of tasks that must complete first
  priority: "critical" | "high" | "medium" | "low";
}

export interface ExecutionDAG {
  dagId: string;
  intent: string;
  tasks: TaskNode[];
  executionOrder: string[][]; // Parallel batches of task IDs
  estimatedDuration: number; // seconds
  confidence: number;
}

export interface CoordinatorInput {
  userIntent: string;
  context?: Record<string, unknown>;
  valueCaseId?: string;
  constraints?: {
    maxTasks?: number;
    preferredAgents?: string[];
    excludeAgents?: string[];
    timeLimit?: number;
  };
}

export interface CoordinatorOutput {
  dag: ExecutionDAG;
  reasoning: string;
  recommendations: string[];
}

// ============================================================================
// Schemas
// ============================================================================

const TaskNodeSchema = z.object({
  id: z.string(),
  agentType: z.enum([
    "opportunity",
    "target",
    "realization",
    "expansion",
    "integrity",
    "communicator",
  ]),
  action: z.string(),
  inputs: z.record(z.unknown()),
  dependencies: z.array(z.string()),
  priority: z.enum(["critical", "high", "medium", "low"]),
});

const ExecutionDAGSchema = z.object({
  dagId: z.string(),
  intent: z.string(),
  tasks: z.array(TaskNodeSchema),
  executionOrder: z.array(z.array(z.string())),
  estimatedDuration: z.number(),
  confidence: z.number().min(0).max(1),
});

const CoordinatorOutputSchema = z.object({
  dag: ExecutionDAGSchema,
  reasoning: z.string(),
  recommendations: z.array(z.string()),
});

// ============================================================================
// Agent Implementation
// ============================================================================

export class CoordinatorAgent extends BaseAgent {
  readonly agentType = "coordinator" as const;
  readonly agentVersion = "1.0.0";

  private readonly config: CoordinatorAgentConfig;

  constructor(config: CoordinatorAgentConfig) {
    super({
      supabase: config.supabase,
      llmGateway: config.llmGateway,
      memorySystem: config.memorySystem,
      auditLogger: config.auditLogger,
      agentType: "coordinator",
      organizationId: config.organizationId,
      userId: config.userId,
    });
    this.config = config;
  }

  /**
   * Decompose user intent into an executable DAG of agent tasks
   */
  async execute(
    sessionId: string,
    input: CoordinatorInput
  ): Promise<CoordinatorOutput> {
    const prompt = this.buildDecompositionPrompt(input);

    const { result: output } = await this.secureInvoke(
      sessionId,
      { prompt, input },
      CoordinatorOutputSchema,
      {
        confidenceThreshold: 0.7,
        safetyLimits: {
          maxRetries: 2,
          timeoutMs: 30000,
        },
      }
    );

    // Log the DAG creation
    await this.logMetric(sessionId, "dag_created", {
      dagId: output.dag.dagId,
      taskCount: output.dag.tasks.length,
      batchCount: output.dag.executionOrder.length,
      confidence: output.dag.confidence,
    });

    // Persist DAG to memory for execution tracking
    await this.persistDAG(sessionId, output.dag);

    return output;
  }

  /**
   * Build the prompt for task decomposition
   */
  private buildDecompositionPrompt(input: CoordinatorInput): string {
    return `You are the CoordinatorAgent for ValueOS - the orchestrator of a multi-agent value engineering system.

## Your Role
Decompose the user's intent into a Directed Acyclic Graph (DAG) of tasks that specialized agents can execute.

## Available Agents
1. **OpportunityAgent** - Discovery, pain point identification, capability mapping
2. **TargetAgent** - ROI modeling, Value Trees, financial projections  
3. **RealizationAgent** - Telemetry tracking, "Committed vs Realized" comparison
4. **ExpansionAgent** - Upsell analysis, gap identification, expansion opportunities
5. **IntegrityAgent** - Manifesto compliance, benchmark validation
6. **CommunicatorAgent** - Narrative generation, executive summaries

## User Intent
<user_intent>
${this.xmlSandbox(input.userIntent)}
</user_intent>

${input.context ? `## Additional Context\n${JSON.stringify(input.context, null, 2)}` : ""}

${input.constraints ? `## Constraints\n${JSON.stringify(input.constraints, null, 2)}` : ""}

## Instructions
1. Analyze the user's intent to understand the core goal
2. Identify which agents are needed and in what sequence
3. Create task nodes with clear actions and inputs
4. Define dependencies between tasks (which must complete before others)
5. Organize into parallel execution batches where possible
6. Estimate total duration and provide confidence score

## Output Format
Return a JSON object with:
- dag: The execution DAG with tasks and execution order
- reasoning: Explain your decomposition logic
- recommendations: Any suggestions for the user

Generate a unique dagId using format: DAG-{timestamp}-{random4chars}`;
  }

  /**
   * Persist the DAG to the memory system for tracking
   */
  private async persistDAG(
    sessionId: string,
    dag: ExecutionDAG
  ): Promise<void> {
    await this.memoryStore(sessionId, `dag:${dag.dagId}`, {
      dag,
      status: "pending",
      createdAt: new Date().toISOString(),
      completedTasks: [],
      failedTasks: [],
    });
  }

  /**
   * Get the status of a DAG execution
   */
  async getDAGStatus(
    sessionId: string,
    dagId: string
  ): Promise<{
    status: "pending" | "running" | "completed" | "failed";
    completedTasks: string[];
    failedTasks: string[];
    results: Record<string, unknown>;
  }> {
    const stored = await this.memoryRetrieve(sessionId, `dag:${dagId}`);
    if (!stored) {
      throw new Error(`DAG ${dagId} not found`);
    }
    return stored as {
      status: "pending" | "running" | "completed" | "failed";
      completedTasks: string[];
      failedTasks: string[];
      results: Record<string, unknown>;
    };
  }

  /**
   * Mark a task as completed in the DAG
   */
  async markTaskCompleted(
    sessionId: string,
    dagId: string,
    taskId: string,
    result: unknown
  ): Promise<void> {
    const stored = (await this.memoryRetrieve(
      sessionId,
      `dag:${dagId}`
    )) as Record<string, unknown>;
    if (!stored) return;

    const completedTasks = (stored.completedTasks as string[]) || [];
    const results = (stored.results as Record<string, unknown>) || {};

    completedTasks.push(taskId);
    results[taskId] = result;

    const dag = stored.dag as ExecutionDAG;
    const allTaskIds = dag.tasks.map((t) => t.id);
    const status =
      completedTasks.length === allTaskIds.length ? "completed" : "running";

    await this.memoryStore(sessionId, `dag:${dagId}`, {
      ...stored,
      status,
      completedTasks,
      results,
    });
  }

  /**
   * Get next batch of tasks ready for execution
   */
  async getNextExecutableBatch(
    sessionId: string,
    dagId: string
  ): Promise<TaskNode[]> {
    const stored = (await this.memoryRetrieve(
      sessionId,
      `dag:${dagId}`
    )) as Record<string, unknown>;
    if (!stored) return [];

    const dag = stored.dag as ExecutionDAG;
    const completedTasks = new Set((stored.completedTasks as string[]) || []);
    const failedTasks = new Set((stored.failedTasks as string[]) || []);

    // Find tasks whose dependencies are all completed
    const readyTasks = dag.tasks.filter((task) => {
      if (completedTasks.has(task.id) || failedTasks.has(task.id)) {
        return false;
      }
      return task.dependencies.every((depId) => completedTasks.has(depId));
    });

    return readyTasks;
  }
}
