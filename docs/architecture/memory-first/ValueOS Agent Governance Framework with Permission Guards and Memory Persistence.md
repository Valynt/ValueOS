```typescript
import { createHash, randomUUID } from 'node:crypto';
import {
  UUID,
  Fact,
  FactStatus,
  NarrativeStatus,
  HybridSearchResult,
  ArtifactChunk,
  ModelRun
} from './types';
import { MemoryService, MemoryServiceError } from './memory-service';

/**
 * AUTHORITY LEVELS (1-5)
 * Defines the governance boundaries for autonomous and semi-autonomous agents.
 */
export enum AuthorityLevel {
  LEVEL_1_OBSERVER = 1,   // Read-only + Telemetry logs
  LEVEL_2_RESEARCHER = 2, // Extract metadata/entities
  LEVEL_3_ANALYST = 3,    // Propose Facts (DRAFT status)
  LEVEL_4_EDITOR = 4,     // Create Narratives & Update Facts
  LEVEL_5_ARCHITECT = 5   // Final Model Runs & Truth Approval
}

/**
 * RESOURCE TYPES
 * Target memory layers for permission checks.
 */
export type MemoryResource = 'logs' | 'facts' | 'model_runs' | 'narratives';

/**
 * AGENT ENVELOPE
 * Wraps agent interactions with the memory-first substrate for auditing and lineage.
 */
export interface AgentEnvelope {
  execution_id: UUID;
  agent_id: string;
  authority_level: AuthorityLevel;
  value_case_id: UUID;
  timestamp: Date;
  
  // Input Context
  context: {
    retrieved_facts: Fact[];
    retrieved_chunks: HybridSearchResult[];
  };
  
  // Execution Output
  output: {
    raw_response: string;
    suggested_actions: Array<{
      type: MemoryResource;
      payload: any;
    }>;
  };

  // Lineage & Security
  evidence_lineage: {
    chunk_ids: UUID[];
    fact_ids: UUID[];
  };
  verification_hash: string;
}

/**
 * PERMISSION GUARD
 * Enforces the ValueOS Governance Model across all agentic writes.
 */
export class PermissionGuard {
  private static readonly POLICY: Record<AuthorityLevel, MemoryResource[]> = {
    [AuthorityLevel.LEVEL_1_OBSERVER]: ['logs'],
    [AuthorityLevel.LEVEL_2_RESEARCHER]: ['logs'],
    [AuthorityLevel.LEVEL_3_ANALYST]: ['logs', 'facts'],
    [AuthorityLevel.LEVEL_4_EDITOR]: ['logs', 'facts', 'narratives'],
    [AuthorityLevel.LEVEL_5_ARCHITECT]: ['logs', 'facts', 'narratives', 'model_runs']
  };

  public static canWrite(level: AuthorityLevel, resource: MemoryResource): boolean {
    return this.POLICY[level].includes(resource);
  }

  public static validateFactWrite(level: AuthorityLevel, status: FactStatus): boolean {
    if (level < AuthorityLevel.LEVEL_3_ANALYST) return false;
    // Level 3 can only propose DRAFT. Level 5 can create APPROVED facts directly.
    if (level < AuthorityLevel.LEVEL_5_ARCHITECT && status === FactStatus.APPROVED) return false;
    return true;
  }
}

/**
 * AGENT FABRIC
 * The central orchestrator for agent lifecycles, retrieval-augmentation, 
 * and evidence-backed persistence.
 */
export class AgentFabric {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly tenantId: UUID,
    private readonly llmApiKey: string // e.g., Together AI
  ) {}

  /**
   * Main execution loop for an agent.
   */
  public async runAgent(params: {
    agentId: string;
    authority: AuthorityLevel;
    valueCaseId: UUID;
    prompt: string;
    embedding: number[]; // From the user's current query/intent
  }): Promise<AgentEnvelope> {
    const executionId = randomUUID() as UUID;

    // 1. PRE-EXECUTION: Context Loading (Episodic + Semantic)
    const context = await this.memoryService.retrieveContext(
      params.valueCaseId,
      params.prompt,
      params.embedding
    );

    // 2. EXECUTION: Calling Together AI (Mocked Pattern)
    const { response, usage } = await this.invokeTogetherAI({
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      systemPrompt: this.constructSystemPrompt(params.authority, context),
      userPrompt: params.prompt
    });

    // 3. POST-EXECUTION: Lineage Tracking
    // We extract which specific IDs were present in the retrieved context
    const lineage = {
      chunk_ids: context.chunks.map(c => c.id),
      fact_ids: context.facts.map(f => f.id)
    };

    // 4. PERSISTENCE & GOVERNANCE
    const envelope: AgentEnvelope = {
      execution_id: executionId,
      agent_id: params.agentId,
      authority_level: params.authority,
      value_case_id: params.valueCaseId,
      timestamp: new Date(),
      context,
      output: {
        raw_response: response,
        suggested_actions: this.parseSuggestedActions(response)
      },
      evidence_lineage: lineage,
      verification_hash: ''
    };

    // Calculate cryptographic signature of the execution
    envelope.verification_hash = this.computeVerificationHash(envelope);

    // 5. COMMIT TO MEMORY (Conditional on permissions)
    await this.commitToMemory(envelope);

    return envelope;
  }

  /**
   * Commits agent outputs to the database, enforcing PermissionGuard rules.
   */
  private async commitToMemory(envelope: AgentEnvelope): Promise<void> {
    const { authority_level, output, value_case_id, execution_id } = envelope;

    // A. Audit Logging (Allowed for all levels)
    await this.memoryService.logModelRun({
      model_name: envelope.agent_id,
      input_prompt: envelope.output.raw_response, // Summary of reasoning
      output_response: JSON.stringify(envelope.output.suggested_actions),
      tokens_used: 0, // Mock usage
      latency_ms: 0,
      evidence_fact_ids: envelope.evidence_lineage.fact_ids
    });

    // B. Suggested Actions Persistence
    for (const action of output.suggested_actions) {
      if (PermissionGuard.canWrite(authority_level, action.type)) {
        try {
          switch (action.type) {
            case 'facts':
              await this.memoryService.createFact(
                action.payload.claim,
                action.payload.evidence,
                execution_id // Attributed to this agent execution
              );
              break;
            case 'narratives':
              // Logic to persist to narratives table via Supabase client
              break;
          }
        } catch (err) {
          console.error(`Failed to commit ${action.type}:`, err);
        }
      }
    }
  }

  /**
   * Generates a deterministic hash representing the integrity of the execution.
   */
  private computeVerificationHash(env: AgentEnvelope): string {
    const state = JSON.stringify({
      agent_id: env.agent_id,
      input_context: env.evidence_lineage,
      output: env.output.raw_response,
      tenant_id: this.tenantId
    });
    return createHash('sha256').update(state).digest('hex');
  }

  /**
   * MOCK: Together AI API Call Pattern
   */
  private async invokeTogetherAI(params: any): Promise<{ response: string; usage: any }> {
    // In production, use: fetch('https://api.together.xyz/v1/chat/completions', ...)
    return {
      response: "Extracted Fact: Customer reduces manual churn by 20%. [Action: Propose Fact]",
      usage: { prompt_tokens: 450, completion_tokens: 50, total_tokens: 500 }
    };
  }

  /**
   * Constructs a system prompt that enforces grounding in retrieved context.
   */
  private constructSystemPrompt(level: AuthorityLevel, context: any): string {
    const factClaims = context.facts.map((f: Fact) => `- ${f.claim}`).join('\n');
    return `
      You are a ValueOS Agent (Auth Level: ${level}).
      GROUNDING DATA:
      ${factClaims}
      
      INSTRUCTIONS:
      1. Only use the provided facts.
      2. If proposing a new fact, use the format [Action: Propose Fact] { "claim": "...", "evidence": [...] }.
      3. Your current Authority Level allows: ${PermissionGuard.canWrite(level, 'facts') ? 'Proposing Facts' : 'Observation Only'}.
    `;
  }

  /**
   * Basic parser for agent suggested actions.
   */
  private parseSuggestedActions(text: string): Array<{ type: MemoryResource, payload: any }> {
    const actions: Array<{ type: MemoryResource, payload: any }> = [];
    if (text.includes('[Action: Propose Fact]')) {
      // Mock parsing logic
      actions.push({
        type: 'facts',
        payload: { claim: "New insight found", evidence: [] }
      });
    }
    return actions;
  }
}
```