/**
 * Agent Collaboration Service
 *
 * Sophisticated multi-agent collaboration system with team formation,
 * shared context management, conflict resolution, and consensus-based decision making.
 */

import { logger } from "../../lib/logger.js"
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { AgentMessageBroker, getAgentMessageBroker } from "../AgentMessageBroker.js"
import {
  getAgentPerformanceMonitor,
} from "../monitoring/AgentPerformanceMonitor";

// ============================================================================
// Types
// ============================================================================

export interface AgentTeam {
  id: string;
  name: string;
  description: string;
  type: TeamType;
  members: TeamMember[];
  leader: string;
  context: SharedContext;
  collaborationPattern: CollaborationPattern;
  status: TeamStatus;
  createdAt: number;
  lastActivity: number;
  goals: TeamGoal[];
}

export interface TeamMember {
  agentId: string;
  agentType: string;
  role: TeamRole;
  capabilities: string[];
  availability: AvailabilityStatus;
  performance: AgentPerformance;
  contribution: ContributionMetrics;
}

export interface TeamRole {
  type: "leader" | "specialist" | "reviewer" | "validator" | "coordinator";
  responsibilities: string[];
  authority: number; // 0-1 scale
  expertise: string[];
}

export interface AgentPerformance {
  reliability: number; // 0-1
  quality: number; // 0-1
  speed: number; // 0-1
  collaborationScore: number; // 0-1
  lastUpdated: number;
}

export interface ContributionMetrics {
  tasksCompleted: number;
  qualityScore: number;
  responseTime: number;
  collaborationRating: number;
  innovationIndex: number;
}

export interface SharedContext {
  sessionId: string;
  objective: string;
  data: Record<string, any>;
  history: ContextEntry[];
  artifacts: Artifact[];
  constraints: Constraint[];
  metadata: Record<string, any>;
}

export interface ContextEntry {
  id: string;
  agentId: string;
  type: "observation" | "conclusion" | "question" | "action";
  content: string;
  timestamp: number;
  confidence: number;
  dependencies: string[];
}

export interface Artifact {
  id: string;
  type: "report" | "analysis" | "recommendation" | "model" | "data";
  name: string;
  description: string;
  content: any;
  createdBy: string;
  createdAt: number;
  version: number;
  tags: string[];
}

export interface Constraint {
  id: string;
  type: "resource" | "time" | "quality" | "scope";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  enforceable: boolean;
  validator?: string; // agent ID that can validate
}

export interface TeamGoal {
  id: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  successCriteria: string[];
  assignedTo: string[];
  status: "pending" | "in_progress" | "completed" | "blocked";
  progress: number; // 0-1
  dueDate?: number;
}

export interface CollaborationTask {
  id: string;
  type: TaskType;
  assignedTo: string[];
  dependencies: string[];
  input: any;
  output: any;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: number;
  metadata: Record<string, any>;
}

export interface ConflictResolution {
  id: string;
  type: ConflictType;
  parties: string[];
  description: string;
  resolution: ResolutionStrategy;
  outcome: ConflictOutcome;
  resolvedBy: string;
  timestamp: number;
}

export interface ConsensusResult {
  topic: string;
  participants: string[];
  decision: string;
  confidence: number;
  votingRecord: VotingRecord[];
  consensusType: ConsensusType;
  reachedAt: number;
}

export interface VotingRecord {
  agentId: string;
  vote: "approve" | "reject" | "abstain";
  reasoning: string;
  confidence: number;
  timestamp: number;
}

// ============================================================================
// Enums
// ============================================================================

export type TeamType =
  | "master_worker"
  | "peer_review"
  | "consensus"
  | "competitive"
  | "hierarchical";
export type CollaborationPattern = "sequential" | "parallel" | "iterative" | "adaptive";
export type TeamStatus = "forming" | "storming" | "norming" | "performing" | "adjourning";
export type AvailabilityStatus = "available" | "busy" | "offline" | "unavailable";
export type TaskType = "analyze" | "validate" | "review" | "synthesize" | "decide" | "execute";
export type TaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ConflictType = "resource" | "opinion" | "approach" | "priority" | "quality";
export type ResolutionStrategy =
  | "negotiation"
  | "arbitration"
  | "voting"
  | "escalation"
  | "compromise";
export type ConflictOutcome = "resolved" | "escalated" | "deferred" | "accepted";
export type ConsensusType = "unanimous" | "majority" | "supermajority" | "weighted" | "delegated";

// ============================================================================
// AgentCollaborationService Implementation
// ============================================================================

export class AgentCollaborationService extends EventEmitter {
  private messageBroker: AgentMessageBroker;
  private performanceMonitor: any;
  private teams = new Map<string, AgentTeam>();
  private activeCollaborations = new Map<string, CollaborationTask>();
  private conflicts = new Map<string, ConflictResolution>();
  private consensusResults = new Map<string, ConsensusResult>();

  constructor() {
    super();
    this.messageBroker = getAgentMessageBroker();
    this.performanceMonitor = getAgentPerformanceMonitor();

    this.setupMessageHandlers();
  }

  /**
   * Form a new agent team for collaboration
   */
  async formTeam(
    name: string,
    type: TeamType,
    objective: string,
    memberRequirements: TeamRole[],
    context?: Partial<SharedContext>
  ): Promise<AgentTeam> {
    const teamId = uuidv4();

    // Find suitable agents based on requirements
    const members = await this.findSuitableAgents(memberRequirements);

    if (members.length === 0) {
      throw new Error("No suitable agents found for team formation");
    }

    // Select team leader
    const leader = this.selectTeamLeader(members);

    // Create shared context
    const sharedContext: SharedContext = {
      sessionId: uuidv4(),
      objective,
      data: context?.data || {},
      history: [],
      artifacts: [],
      constraints: context?.constraints || [],
      metadata: context?.metadata || {},
    };

    // Determine collaboration pattern
    const collaborationPattern = this.selectCollaborationPattern(type, members);

    const team: AgentTeam = {
      id: teamId,
      name,
      description: `Team for ${objective}`,
      type,
      members,
      leader,
      context: sharedContext,
      collaborationPattern,
      status: "forming",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      goals: [],
    };

    // Store team
    this.teams.set(teamId, team);

    // Initialize team
    await this.initializeTeam(team);

    this.emit("teamFormed", team);
    return team;
  }

  /**
   * Execute a collaborative task
   */
  async executeCollaborativeTask(teamId: string, task: CollaborationTask): Promise<any> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    // Store task
    this.activeCollaborations.set(task.id, task);

    try {
      // Update team status
      team.status = "performing";
      team.lastActivity = Date.now();

      // Execute based on collaboration pattern
      let result: any;

      switch (team.collaborationPattern) {
        case "sequential":
          result = await this.executeSequentialCollaboration(team, task);
          break;
        case "parallel":
          result = await this.executeParallelCollaboration(team, task);
          break;
        case "iterative":
          result = await this.executeIterativeCollaboration(team, task);
          break;
        case "adaptive":
          result = await this.executeAdaptiveCollaboration(team, task);
          break;
        default:
          throw new Error(`Unknown collaboration pattern: ${team.collaborationPattern}`);
      }

      // Update task status
      task.status = "completed";
      task.output = result;

      // Update team context
      await this.updateTeamContext(team, {
        type: "conclusion",
        content: `Task ${task.id} completed with result: ${JSON.stringify(result)}`,
        agentId: "system",
        timestamp: Date.now(),
        confidence: 0.9,
        dependencies: [],
      });

      this.emit("taskCompleted", { teamId, task, result });
      return result;
    } catch (error) {
      task.status = "failed";
      this.emit("taskFailed", { teamId, task, error });
      throw error;
    } finally {
      this.activeCollaborations.delete(task.id);
    }
  }

  /**
   * Resolve conflicts between agents
   */
  async resolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy,
    arbitrator?: string
  ): Promise<ConflictResolution> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    let outcome: ConflictOutcome;
    let resolvedBy: string;

    switch (strategy) {
      case "negotiation":
        outcome = await this.resolveByNegotiation(conflict);
        resolvedBy = conflict.parties[0]; // First party as facilitator
        break;

      case "arbitration":
        if (!arbitrator) {
          throw new Error("Arbitrator required for arbitration strategy");
        }
        outcome = await this.resolveByArbitration(conflict, arbitrator);
        resolvedBy = arbitrator;
        break;

      case "voting":
        outcome = await this.resolveByVoting(conflict);
        resolvedBy = "consensus";
        break;

      case "escalation":
        outcome = await this.resolveByEscalation(conflict);
        resolvedBy = "escalated";
        break;

      case "compromise":
        outcome = await this.resolveByCompromise(conflict);
        resolvedBy = "compromise";
        break;

      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }

    conflict.resolution = strategy;
    conflict.outcome = outcome;
    conflict.resolvedBy = resolvedBy;
    conflict.timestamp = Date.now();

    this.emit("conflictResolved", conflict);
    return conflict;
  }

  /**
   * Build consensus among agents
   */
  async buildConsensus(
    topic: string,
    participants: string[],
    consensusType: ConsensusType,
    options?: {
      timeLimit?: number;
      minParticipation?: number;
      votingWeight?: Record<string, number>;
    }
  ): Promise<ConsensusResult> {
    const consensusId = uuidv4();
    const startTime = Date.now();

    // Collect votes from participants
    const votes: VotingRecord[] = [];

    for (const participant of participants) {
      try {
        const vote = await this.requestVote(participant, topic, consensusType);
        votes.push(vote);
      } catch (error) {
        logger.warn(`Failed to get vote from ${participant}`, { error });
      }
    }

    // Analyze votes and determine consensus
    const decision = this.analyzeVotes(votes, consensusType, options);
    const confidence = this.calculateConsensusConfidence(votes, decision);

    const result: ConsensusResult = {
      topic,
      participants: votes.map((v) => v.agentId),
      decision,
      confidence,
      votingRecord: votes,
      consensusType,
      reachedAt: Date.now(),
    };

    this.consensusResults.set(consensusId, result);
    this.emit("consensusReached", result);

    return result;
  }

  /**
   * Get team status and performance
   */
  getTeamStatus(teamId: string): AgentTeam | null {
    return this.teams.get(teamId) || null;
  }

  /**
   * Get all active teams
   */
  getActiveTeams(): AgentTeam[] {
    return Array.from(this.teams.values()).filter((team) => team.status !== "adjourning");
  }

  /**
   * Get agent collaboration metrics
   */
  getCollaborationMetrics(agentId: string): {
    teamsParticipating: number;
    tasksCompleted: number;
    conflictsResolved: number;
    consensusParticipation: number;
    averageContribution: number;
  } {
    const teams = Array.from(this.teams.values()).filter((team) =>
      team.members.some((member) => member.agentId === agentId)
    );

    const tasks = Array.from(this.activeCollaborations.values()).filter((task) =>
      task.assignedTo.includes(agentId)
    );

    const conflicts = Array.from(this.conflicts.values()).filter((conflict) =>
      conflict.parties.includes(agentId)
    );

    const consensusVotes = Array.from(this.consensusResults.values()).filter((result) =>
      result.participants.includes(agentId)
    );

    let totalContribution = 0;
    let contributionCount = 0;

    for (const team of teams) {
      const member = team.members.find((m) => m.agentId === agentId);
      if (member) {
        totalContribution += member.contribution.tasksCompleted;
        contributionCount++;
      }
    }

    const averageContribution = contributionCount > 0 ? totalContribution / contributionCount : 0;

    return {
      teamsParticipating: teams.length,
      tasksCompleted: tasks.filter((t) => t.status === "completed").length,
      conflictsResolved: conflicts.filter((c) => c.outcome === "resolved").length,
      consensusParticipation: consensusVotes.length,
      averageContribution,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupMessageHandlers(): void {
    // Handle incoming collaboration messages
    this.messageBroker.on("message", (message: any) => {
      this.handleCollaborationMessage(message);
    });
  }

  private handleCollaborationMessage(message: any): void {
    // Process collaboration-specific messages
    if (message.type === "collaboration_request") {
      this.handleCollaborationRequest(message);
    } else if (message.type === "conflict_notification") {
      this.handleConflictNotification(message);
    } else if (message.type === "consensus_request") {
      this.handleConsensusRequest(message);
    }
  }

  private async findSuitableAgents(requirements: TeamRole[]): Promise<TeamMember[]> {
    const members: TeamMember[] = [];

    for (const requirement of requirements) {
      // Find agents matching the role requirements
      const suitableAgents = await this.findAgentsByRole(requirement);

      for (const agent of suitableAgents) {
        // Check if agent is already in team
        if (!members.some((m) => m.agentId === agent.id)) {
          members.push({
            agentId: agent.id,
            agentType: agent.type,
            role: requirement,
            capabilities: requirement.expertise,
            availability: "available",
            performance: await this.getAgentPerformance(agent.id),
            contribution: {
              tasksCompleted: 0,
              qualityScore: 0.8,
              responseTime: 1000,
              collaborationRating: 0.8,
              innovationIndex: 0.7,
            },
          });
        }
      }
    }

    return members;
  }

  private async findAgentsByRole(role: TeamRole): Promise<any[]> {
    // In practice, this would query the agent registry
    // For now, return mock agents
    return [{ id: `agent-${role.type}`, type: role.type }];
  }

  private selectTeamLeader(members: TeamMember[]): string {
    // Select agent with highest performance score
    return members.reduce((best, current) =>
      current.performance.reliability > best.performance.reliability ? current : best
    ).agentId;
  }

  private selectCollaborationPattern(type: TeamType, members: TeamMember[]): CollaborationPattern {
    switch (type) {
      case "master_worker":
        return "sequential";
      case "peer_review":
        return "iterative";
      case "consensus":
        return "parallel";
      case "competitive":
        return "parallel";
      case "hierarchical":
        return "sequential";
      default:
        return "adaptive";
    }
  }

  private async initializeTeam(team: AgentTeam): Promise<void> {
    // Send team formation notification to all members
    for (const member of team.members) {
      await this.messageBroker.sendToAgent("collaboration_service", member.agentId, {
        type: "team_formation",
        teamId: team.id,
        role: member.role,
        context: team.context,
      });
    }

    // Update team status
    team.status = "norming";
  }

  private async executeSequentialCollaboration(
    team: AgentTeam,
    task: CollaborationTask
  ): Promise<any> {
    const results: unknown[] = [];

    for (const agentId of task.assignedTo) {
      const subtask = {
        ...task,
        assignedTo: [agentId],
        input: results.length > 0 ? results[results.length - 1] : task.input,
      };

      const result = await this.assignTaskToAgent(agentId, subtask);
      results.push(result);
    }

    return this.synthesizeResults(results);
  }

  private async executeParallelCollaboration(
    team: AgentTeam,
    task: CollaborationTask
  ): Promise<any> {
    const promises = task.assignedTo.map((agentId) => this.assignTaskToAgent(agentId, task));

    const results = await Promise.all(promises);
    return this.synthesizeResults(results);
  }

  private async executeIterativeCollaboration(
    team: AgentTeam,
    task: CollaborationTask
  ): Promise<any> {
    let currentResult = task.input;
    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      const iterationTask = {
        ...task,
        input: currentResult,
      };

      const results = await this.executeParallelCollaboration(team, iterationTask);
      const synthesized = this.synthesizeResults(results);

      // Check for convergence
      if (this.hasConverged(currentResult, synthesized)) {
        break;
      }

      currentResult = synthesized;
      iterations++;
    }

    return currentResult;
  }

  private async executeAdaptiveCollaboration(
    team: AgentTeam,
    task: CollaborationTask
  ): Promise<any> {
    // Start with parallel execution
    let result = await this.executeParallelCollaboration(team, task);

    // Adapt based on results and team performance
    if (this.shouldSwitchToSequential(team, task, result)) {
      result = await this.executeSequentialCollaboration(team, task);
    } else if (this.shouldSwitchToIterative(team, task, result)) {
      result = await this.executeIterativeCollaboration(team, task);
    }

    return result;
  }

  private async assignTaskToAgent(agentId: string, task: CollaborationTask): Promise<any> {
    return await this.messageBroker.sendToAgent("collaboration_service", agentId, {
      type: "task_assignment",
      task,
    });
  }

  private synthesizeResults(results: any[]): any {
    // Simple synthesis - in practice would use more sophisticated methods
    return {
      combinedResults: results,
      synthesisTime: Date.now(),
      confidence: this.calculateSynthesisConfidence(results),
    };
  }

  private calculateSynthesisConfidence(results: any[]): number {
    if (results.length === 0) return 0;

    const avgConfidence =
      results.reduce((sum: number, result: any) => sum + (result.confidence || 0.5), 0) /
      results.length;

    return avgConfidence;
  }

  private hasConverged(previous: any, current: any): boolean {
    // Simple convergence check
    return JSON.stringify(previous) === JSON.stringify(current);
  }

  private shouldSwitchToSequential(team: AgentTeam, task: CollaborationTask, result: any): boolean {
    // Decision logic for switching to sequential
    return task.dependencies.length > 0;
  }

  private shouldSwitchToIterative(team: AgentTeam, task: CollaborationTask, result: any): boolean {
    // Decision logic for switching to iterative
    return (result.confidence || 0) < 0.8;
  }

  private async updateTeamContext(team: AgentTeam, entry: ContextEntry): Promise<void> {
    team.context.history.push(entry);
    team.lastActivity = entry.timestamp;
  }

  private async resolveByNegotiation(conflict: ConflictResolution): Promise<ConflictOutcome> {
    // Implement negotiation logic
    return "resolved";
  }

  private async resolveByArbitration(
    conflict: ConflictResolution,
    arbitrator: string
  ): Promise<ConflictOutcome> {
    // Implement arbitration logic
    return "resolved";
  }

  private async resolveByVoting(conflict: ConflictResolution): Promise<ConflictOutcome> {
    // Implement voting logic
    return "resolved";
  }

  private async resolveByEscalation(conflict: ConflictResolution): Promise<ConflictOutcome> {
    // Implement escalation logic
    return "escalated";
  }

  private async resolveByCompromise(conflict: ConflictResolution): Promise<ConflictOutcome> {
    // Implement compromise logic
    return "resolved";
  }

  private async requestVote(
    agentId: string,
    topic: string,
    consensusType: ConsensusType
  ): Promise<VotingRecord> {
    const response = await this.messageBroker.sendToAgent("collaboration_service", agentId, {
      type: "vote_request",
      topic,
      consensusType,
    });

    return {
      agentId,
      vote: response.vote || "abstain",
      reasoning: response.reasoning || "No reasoning provided",
      confidence: response.confidence || 0.5,
      timestamp: Date.now(),
    };
  }

  private analyzeVotes(votes: VotingRecord[], consensusType: ConsensusType, options?: any): string {
    const approveVotes = votes.filter((v) => v.vote === "approve").length;
    const rejectVotes = votes.filter((v) => v.vote === "reject").length;
    const totalVotes = votes.length;

    switch (consensusType) {
      case "unanimous":
        return approveVotes === totalVotes ? "approved" : "rejected";
      case "majority":
        return approveVotes > totalVotes / 2 ? "approved" : "rejected";
      case "supermajority":
        return approveVotes > totalVotes * 0.67 ? "approved" : "rejected";
      default:
        return approveVotes > rejectVotes ? "approved" : "rejected";
    }
  }

  private calculateConsensusConfidence(votes: VotingRecord[], decision: string): number {
    const relevantVotes = votes.filter((v) => v.vote !== "abstain");
    if (relevantVotes.length === 0) return 0;

    const agreementVotes = relevantVotes.filter(
      (v) =>
        (decision === "approved" && v.vote === "approve") ||
        (decision === "rejected" && v.vote === "reject")
    );

    const avgConfidence =
      relevantVotes.reduce((sum, v) => sum + v.confidence, 0) / relevantVotes.length;
    const agreementRatio = agreementVotes.length / relevantVotes.length;

    return avgConfidence * agreementRatio;
  }

  private async getAgentPerformance(agentId: string): Promise<AgentPerformance> {
    const healthScore = this.performanceMonitor.getHealthScore(agentId);

    return {
      reliability: healthScore?.reliabilityScore || 0.8,
      quality: healthScore?.qualityScore || 0.8,
      speed: healthScore?.performanceScore || 0.8,
      collaborationScore: 0.8, // Would be calculated from collaboration history
      lastUpdated: Date.now(),
    };
  }

  private handleCollaborationRequest(message: any): void {
    // Handle incoming collaboration requests
    logger.info("Collaboration request received", { from: message.from, type: message.type });
  }

  private handleConflictNotification(message: any): void {
    // Handle conflict notifications
    logger.info("Conflict notification received", {
      from: message.from,
      conflict: message.conflict,
    });
  }

  private handleConsensusRequest(message: any): void {
    // Handle consensus requests
    logger.info("Consensus request received", { from: message.from, topic: message.topic });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentCollaborationServiceInstance: AgentCollaborationService | null = null;

export function getAgentCollaborationService(): AgentCollaborationService {
  if (!agentCollaborationServiceInstance) {
    agentCollaborationServiceInstance = new AgentCollaborationService();
  }
  return agentCollaborationServiceInstance;
}
