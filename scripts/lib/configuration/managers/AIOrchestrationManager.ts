/**
 * AI Orchestration Settings Manager
 * 
 * Manages AI and agent fabric settings including:
 * - LLM spending limits and budget controls
 * - Model routing and fallback strategies
 * - Agent toggles and enablement
 * - Human-in-the-loop (HITL) thresholds
 * - Ground truth synchronization
 * - Formula versioning
 */

import { ConfigurationManager } from '../ConfigurationManager';
import type {
  LLMSpendingLimitsConfig,
  ModelRoutingConfig,
  AgentTogglesConfig,
  HITLThresholdsConfig,
  GroundTruthSyncConfig,
  FormulaVersioningConfig,
  ConfigurationScope,
  ConfigurationAccessLevel
} from '../types/settings-matrix';

export class AIOrchestrationManager {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  // ========================================================================
  // LLM Spending Limits
  // ========================================================================

  async getLLMSpendingLimits(
    scope: ConfigurationScope
  ): Promise<LLMSpendingLimitsConfig> {
    return this.configManager.getConfiguration<LLMSpendingLimitsConfig>(
      'llm_spending_limits',
      scope
    );
  }

  async updateLLMSpendingLimits(
    scope: ConfigurationScope,
    config: Partial<LLMSpendingLimitsConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<LLMSpendingLimitsConfig> {
    const current = await this.getLLMSpendingLimits(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'llm_spending_limits',
      updated,
      scope,
      accessLevel
    );
  }

  async setMonthlyHardCap(
    organizationId: string,
    amount: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<LLMSpendingLimitsConfig> {
    const current = await this.getLLMSpendingLimits({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'llm_spending_limits',
      { ...current, monthlyHardCap: amount },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setMonthlySoftCap(
    organizationId: string,
    amount: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<LLMSpendingLimitsConfig> {
    const current = await this.getLLMSpendingLimits({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'llm_spending_limits',
      { ...current, monthlySoftCap: amount },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setPerRequestLimit(
    organizationId: string,
    amount: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<LLMSpendingLimitsConfig> {
    const current = await this.getLLMSpendingLimits({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'llm_spending_limits',
      { ...current, perRequestLimit: amount },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAlertThreshold(
    organizationId: string,
    percentage: number,
    recipients: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<LLMSpendingLimitsConfig> {
    const current = await this.getLLMSpendingLimits({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'llm_spending_limits',
      {
        ...current,
        alertThreshold: percentage,
        alertRecipients: recipients
      },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setUserLimits(
    organizationId: string,
    limits: Record<string, number>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<LLMSpendingLimitsConfig> {
    const current = await this.getLLMSpendingLimits({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'llm_spending_limits',
      { ...current, perUserLimits: limits },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Model Routing
  // ========================================================================

  async getModelRouting(
    scope: ConfigurationScope
  ): Promise<ModelRoutingConfig> {
    return this.configManager.getConfiguration<ModelRoutingConfig>(
      'model_routing',
      scope
    );
  }

  async updateModelRouting(
    scope: ConfigurationScope,
    config: Partial<ModelRoutingConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ModelRoutingConfig> {
    const current = await this.getModelRouting(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'model_routing',
      updated,
      scope,
      accessLevel
    );
  }

  async setDefaultModel(
    organizationId: string,
    model: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ModelRoutingConfig> {
    const current = await this.getModelRouting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'model_routing',
      { ...current, defaultModel: model },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async addRoutingRule(
    organizationId: string,
    rule: {
      condition: string;
      targetModel: string;
      priority: number;
    },
    accessLevel: ConfigurationAccessLevel
  ): Promise<ModelRoutingConfig> {
    const current = await this.getModelRouting({
      type: 'tenant',
      tenantId: organizationId
    });

    const routingRules = [...(current.routingRules || []), rule];

    return this.configManager.updateConfiguration(
      'model_routing',
      { ...current, routingRules },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async removeRoutingRule(
    organizationId: string,
    ruleIndex: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ModelRoutingConfig> {
    const current = await this.getModelRouting({
      type: 'tenant',
      tenantId: organizationId
    });

    const routingRules = (current.routingRules || []).filter((_, i) => i !== ruleIndex);

    return this.configManager.updateConfiguration(
      'model_routing',
      { ...current, routingRules },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableAutoDowngrade(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<ModelRoutingConfig> {
    const current = await this.getModelRouting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'model_routing',
      { ...current, enableAutoDowngrade: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setFallbackChain(
    organizationId: string,
    chain: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<ModelRoutingConfig> {
    const current = await this.getModelRouting({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'model_routing',
      { ...current, fallbackChain: chain },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Agent Toggles
  // ========================================================================

  async getAgentToggles(
    scope: ConfigurationScope
  ): Promise<AgentTogglesConfig> {
    return this.configManager.getConfiguration<AgentTogglesConfig>(
      'agent_toggles',
      scope
    );
  }

  async updateAgentToggles(
    scope: ConfigurationScope,
    config: Partial<AgentTogglesConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AgentTogglesConfig> {
    const current = await this.getAgentToggles(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'agent_toggles',
      updated,
      scope,
      accessLevel
    );
  }

  async enableAgent(
    organizationId: string,
    agentName: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AgentTogglesConfig> {
    const current = await this.getAgentToggles({
      type: 'tenant',
      tenantId: organizationId
    });

    const enabledAgents = {
      ...current.enabledAgents,
      [agentName]: enable
    };

    return this.configManager.updateConfiguration(
      'agent_toggles',
      { ...current, enabledAgents },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableAllAgents(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AgentTogglesConfig> {
    const current = await this.getAgentToggles({
      type: 'tenant',
      tenantId: organizationId
    });

    const enabledAgents = Object.keys(current.enabledAgents).reduce(
      (acc, key) => ({ ...acc, [key]: enable }),
      {}
    );

    return this.configManager.updateConfiguration(
      'agent_toggles',
      { ...current, enabledAgents },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setAgentConfig(
    organizationId: string,
    agentName: string,
    config: Record<string, any>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<AgentTogglesConfig> {
    const current = await this.getAgentToggles({
      type: 'tenant',
      tenantId: organizationId
    });

    const agentConfigs = {
      ...current.agentConfigs,
      [agentName]: config
    };

    return this.configManager.updateConfiguration(
      'agent_toggles',
      { ...current, agentConfigs },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // HITL Thresholds
  // ========================================================================

  async getHITLThresholds(
    scope: ConfigurationScope
  ): Promise<HITLThresholdsConfig> {
    return this.configManager.getConfiguration<HITLThresholdsConfig>(
      'hitl_thresholds',
      scope
    );
  }

  async updateHITLThresholds(
    scope: ConfigurationScope,
    config: Partial<HITLThresholdsConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<HITLThresholdsConfig> {
    const current = await this.getHITLThresholds(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'hitl_thresholds',
      updated,
      scope,
      accessLevel
    );
  }

  async setAutoApprovalThreshold(
    organizationId: string,
    threshold: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<HITLThresholdsConfig> {
    const current = await this.getHITLThresholds({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'hitl_thresholds',
      { ...current, autoApprovalThreshold: threshold },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setHumanReviewThreshold(
    organizationId: string,
    threshold: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<HITLThresholdsConfig> {
    const current = await this.getHITLThresholds({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'hitl_thresholds',
      { ...current, humanReviewThreshold: threshold },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setRejectionThreshold(
    organizationId: string,
    threshold: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<HITLThresholdsConfig> {
    const current = await this.getHITLThresholds({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'hitl_thresholds',
      { ...current, rejectionThreshold: threshold },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setReviewers(
    organizationId: string,
    reviewers: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<HITLThresholdsConfig> {
    const current = await this.getHITLThresholds({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'hitl_thresholds',
      { ...current, reviewers },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setEscalationRules(
    organizationId: string,
    rules: Array<{ condition: string; escalateTo: string }>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<HITLThresholdsConfig> {
    const current = await this.getHITLThresholds({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'hitl_thresholds',
      { ...current, escalationRules: rules },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Ground Truth Sync
  // ========================================================================

  async getGroundTruthSync(
    scope: ConfigurationScope
  ): Promise<GroundTruthSyncConfig | null> {
    return this.configManager.getConfiguration<GroundTruthSyncConfig>(
      'ground_truth_sync',
      scope
    );
  }

  async updateGroundTruthSync(
    scope: ConfigurationScope,
    config: GroundTruthSyncConfig,
    accessLevel: ConfigurationAccessLevel
  ): Promise<GroundTruthSyncConfig> {
    return this.configManager.updateConfiguration(
      'ground_truth_sync',
      config,
      scope,
      accessLevel
    );
  }

  async enableGroundTruthSync(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<GroundTruthSyncConfig> {
    const current = await this.getGroundTruthSync({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: GroundTruthSyncConfig = {
      ...current,
      enabled: enable,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'ground_truth_sync',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setSyncFrequency(
    organizationId: string,
    frequencyHours: number,
    accessLevel: ConfigurationAccessLevel
  ): Promise<GroundTruthSyncConfig> {
    const current = await this.getGroundTruthSync({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: GroundTruthSyncConfig = {
      ...current,
      syncFrequencyHours: frequencyHours,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'ground_truth_sync',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setDataSources(
    organizationId: string,
    sources: string[],
    accessLevel: ConfigurationAccessLevel
  ): Promise<GroundTruthSyncConfig> {
    const current = await this.getGroundTruthSync({
      type: 'tenant',
      tenantId: organizationId
    });

    const updated: GroundTruthSyncConfig = {
      ...current,
      dataSources: sources,
      updatedAt: new Date().toISOString()
    };

    return this.configManager.updateConfiguration(
      'ground_truth_sync',
      updated,
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Formula Versioning
  // ========================================================================

  async getFormulaVersioning(
    scope: ConfigurationScope
  ): Promise<FormulaVersioningConfig> {
    return this.configManager.getConfiguration<FormulaVersioningConfig>(
      'formula_versioning',
      scope
    );
  }

  async updateFormulaVersioning(
    scope: ConfigurationScope,
    config: Partial<FormulaVersioningConfig>,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FormulaVersioningConfig> {
    const current = await this.getFormulaVersioning(scope);
    const updated = { ...current, ...config };

    return this.configManager.updateConfiguration(
      'formula_versioning',
      updated,
      scope,
      accessLevel
    );
  }

  async setActiveVersion(
    organizationId: string,
    version: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FormulaVersioningConfig> {
    const current = await this.getFormulaVersioning({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'formula_versioning',
      { ...current, activeVersion: version },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async addAvailableVersion(
    organizationId: string,
    version: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FormulaVersioningConfig> {
    const current = await this.getFormulaVersioning({
      type: 'tenant',
      tenantId: organizationId
    });

    const availableVersions = [...(current.availableVersions || [])];
    if (!availableVersions.includes(version)) {
      availableVersions.push(version);
    }

    return this.configManager.updateConfiguration(
      'formula_versioning',
      { ...current, availableVersions },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async enableAutoUpdate(
    organizationId: string,
    enable: boolean,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FormulaVersioningConfig> {
    const current = await this.getFormulaVersioning({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'formula_versioning',
      { ...current, autoUpdate: enable },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  async setRollbackVersion(
    organizationId: string,
    version: string,
    accessLevel: ConfigurationAccessLevel
  ): Promise<FormulaVersioningConfig> {
    const current = await this.getFormulaVersioning({
      type: 'tenant',
      tenantId: organizationId
    });

    return this.configManager.updateConfiguration(
      'formula_versioning',
      { ...current, rollbackVersion: version },
      { type: 'tenant', tenantId: organizationId },
      accessLevel
    );
  }

  // ========================================================================
  // Bulk Operations
  // ========================================================================

  async getAllAISettings(
    organizationId: string
  ): Promise<{
    llmSpendingLimits: LLMSpendingLimitsConfig;
    modelRouting: ModelRoutingConfig;
    agentToggles: AgentTogglesConfig;
    hitlThresholds: HITLThresholdsConfig;
    groundTruthSync: GroundTruthSyncConfig | null;
    formulaVersioning: FormulaVersioningConfig;
  }> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    const [
      llmSpendingLimits,
      modelRouting,
      agentToggles,
      hitlThresholds,
      groundTruthSync,
      formulaVersioning
    ] = await Promise.all([
      this.getLLMSpendingLimits(scope),
      this.getModelRouting(scope),
      this.getAgentToggles(scope),
      this.getHITLThresholds(scope),
      this.getGroundTruthSync(scope),
      this.getFormulaVersioning(scope)
    ]);

    return {
      llmSpendingLimits,
      modelRouting,
      agentToggles,
      hitlThresholds,
      groundTruthSync,
      formulaVersioning
    };
  }

  async clearCache(organizationId: string): Promise<void> {
    const scope: ConfigurationScope = {
      type: 'tenant',
      tenantId: organizationId
    };

    await Promise.all([
      this.configManager.clearCache('llm_spending_limits', scope),
      this.configManager.clearCache('model_routing', scope),
      this.configManager.clearCache('agent_toggles', scope),
      this.configManager.clearCache('hitl_thresholds', scope),
      this.configManager.clearCache('ground_truth_sync', scope),
      this.configManager.clearCache('formula_versioning', scope)
    ]);
  }
}
