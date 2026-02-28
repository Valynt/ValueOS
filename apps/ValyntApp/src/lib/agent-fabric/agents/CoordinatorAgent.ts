import { v4 as uuidv4 } from "uuid";

import type { CreateTaskIntent } from "../../../legacy-restored/types/Subgoal";

interface SubgoalRecord {
  id: string;
  parent_task_id: string;
  subgoal_type: string;
  description: string;
  assigned_agent: string;
  dependencies: string[];
  status: "pending" | "completed";
  priority: number;
  estimated_complexity: number;
  context: Record<string, unknown>;
  created_at: string;
  output?: Record<string, unknown>;
}

interface TaskPlan {
  task_id: string;
  subgoals: SubgoalRecord[];
  execution_order: string[];
  complexity_score: number;
  requires_simulation: boolean;
}

interface SubgoalRouting {
  subgoal_id: string;
  agent_name: string;
  confidence: number;
  routing_reason: string;
  alternative_agents: string[];
}

interface SDUILayout {
  type: "page";
  sections: Array<{ type: string; content?: Record<string, unknown> }>;
}

const TASK_PATTERNS: Record<
  string,
  Array<{
    subgoal_type: string;
    description: string;
    assigned_agent: string;
    estimated_complexity: number;
  }>
> = {
  create_business_case: [
    {
      subgoal_type: "discovery",
      description: "Gather initial opportunity inputs",
      assigned_agent: "OpportunityAgent",
      estimated_complexity: 0.35,
    },
    {
      subgoal_type: "analysis",
      description: "Map system relationships and constraints",
      assigned_agent: "SystemMapperAgent",
      estimated_complexity: 0.55,
    },
    {
      subgoal_type: "design",
      description: "Propose intervention strategies",
      assigned_agent: "InterventionDesignerAgent",
      estimated_complexity: 0.65,
    },
    {
      subgoal_type: "validation",
      description: "Validate outcomes and risks",
      assigned_agent: "ValueEvalAgent",
      estimated_complexity: 0.7,
    },
  ],
  analyze_opportunity: [
    {
      subgoal_type: "discovery",
      description: "Capture opportunity context",
      assigned_agent: "OpportunityAgent",
      estimated_complexity: 0.3,
    },
    {
      subgoal_type: "analysis",
      description: "Evaluate impact and dependencies",
      assigned_agent: "SystemMapperAgent",
      estimated_complexity: 0.45,
    },
  ],
  design_intervention: [
    {
      subgoal_type: "design",
      description: "Draft intervention plan",
      assigned_agent: "InterventionDesignerAgent",
      estimated_complexity: 0.4,
    },
  ],
  generate_report: [
    {
      subgoal_type: "report",
      description: "Generate summary report",
      assigned_agent: "CommunicatorAgent",
      estimated_complexity: 0.2,
    },
  ],
};

const AGENT_CAPABILITIES: Record<string, string[]> = {
  SystemMapperAgent: ["system_analysis", "dependency_mapping", "leverage_detection"],
  InterventionDesignerAgent: ["intervention_design", "prioritization", "sequencing"],
  OpportunityAgent: ["opportunity_scoping", "value_estimation"],
  ValueEvalAgent: ["validation", "risk_assessment"],
  CommunicatorAgent: ["summarization", "storytelling"],
};

export class CoordinatorAgent {
  async planTask(intent: CreateTaskIntent): Promise<TaskPlan> {
    const task_id = `task-${uuidv4()}`;
    const subgoals = await this.generateSubgoals({
      ...intent,
      id: task_id,
    });

    const execution_order = subgoals.map((subgoal) => subgoal.id);
    const complexity_score = this.calculateComplexityScore(subgoals);

    return {
      task_id,
      subgoals,
      execution_order,
      complexity_score,
      requires_simulation: intent.intent_type === "create_business_case",
    };
  }

  async generateSubgoals(intent: CreateTaskIntent & { id: string }): Promise<SubgoalRecord[]> {
    const pattern = TASK_PATTERNS[intent.intent_type];

    if (!pattern) {
      throw new Error(`Unsupported intent type: ${intent.intent_type}`);
    }

    return pattern.map((definition, index) => ({
      id: `subgoal-${intent.id}-${index + 1}`,
      parent_task_id: intent.id,
      subgoal_type: definition.subgoal_type,
      description: definition.description,
      assigned_agent: definition.assigned_agent,
      dependencies: index === 0 ? [] : [`subgoal-${intent.id}-${index}`],
      status: "pending",
      priority: Math.max(1, 5 - index),
      estimated_complexity: definition.estimated_complexity,
      context: intent.context ?? {},
      created_at: new Date().toISOString(),
    }));
  }

  async routeSubgoal(subgoal: SubgoalRecord): Promise<SubgoalRouting> {
    return {
      subgoal_id: subgoal.id,
      agent_name: subgoal.assigned_agent,
      confidence: 0.82,
      routing_reason: `Assigned based on ${subgoal.subgoal_type} pattern`,
      alternative_agents: ["IntegrityAgent", "ExpansionAgent"],
    };
  }

  async produceSDUILayout(subgoal: SubgoalRecord): Promise<SDUILayout> {
    if (!subgoal.output) {
      throw new Error("Subgoal output is required to build SDUI layout");
    }

    return {
      type: "page",
      sections: [
        {
          type: "layout.directive",
          content: {
            title: `Subgoal ${subgoal.subgoal_type}`,
            summary: subgoal.description,
            output: subgoal.output,
          },
        },
      ],
    };
  }

  getAgentCapabilities(agentName: string): string[] {
    return AGENT_CAPABILITIES[agentName] ?? [];
  }

  getAvailableAgents(): string[] {
    return Object.keys(AGENT_CAPABILITIES);
  }

  getTaskPatterns(): string[] {
    return Object.keys(TASK_PATTERNS);
  }

  private calculateComplexityScore(subgoals: SubgoalRecord[]): number {
    if (subgoals.length === 0) {
      return 0;
    }

    const averageComplexity =
      subgoals.reduce((total, subgoal) => total + subgoal.estimated_complexity, 0) / subgoals.length;

    return Math.min(1, Math.max(0, averageComplexity));
  }
}
