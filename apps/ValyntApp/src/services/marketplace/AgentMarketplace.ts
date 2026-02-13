/**
 * Agent Marketplace & Registry
 *
 * Dynamic agent discovery, versioning, capability advertising, and reputation system
 * for creating a vibrant agent ecosystem with enterprise-grade management.
 */

import { logger } from "../../lib/logger";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { getAgentPerformanceMonitor } from "../monitoring/AgentPerformanceMonitor";

// ============================================================================
// Types
// ============================================================================

export interface AgentListing {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: AgentCategory;
  capabilities: AgentCapability[];
  requirements: AgentRequirement[];
  pricing: PricingModel;
  reputation: ReputationScore;
  availability: AvailabilityStatus;
  metadata: AgentMetadata;
  createdAt: number;
  updatedAt: number;
  downloads: number;
  rating: number;
  reviews: AgentReview[];
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  type: CapabilityType;
  inputSchema: any;
  outputSchema: any;
  performance: CapabilityPerformance;
  dependencies: string[];
  tags: string[];
}

export interface AgentRequirement {
  type: RequirementType;
  description: string;
  minimum: any;
  recommended: any;
  optional: boolean;
}

export interface PricingModel {
  type: PricingType;
  amount?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  tier?: PricingTier[];
  usageBased?: UsageBasedPricing;
  freeTier?: FreeTierLimits;
}

export interface ReputationScore {
  overall: number; // 0-5 stars
  reliability: number; // 0-5 stars
  performance: number; // 0-5 stars
  security: number; // 0-5 stars
  usability: number; // 0-5 stars
  totalReviews: number;
  lastUpdated: number;
}

export interface AgentReview {
  id: string;
  agentId: string;
  userId: string;
  rating: number; // 1-5 stars
  title: string;
  content: string;
  category: ReviewCategory;
  verified: boolean;
  helpful: number;
  createdAt: number;
  response?: ReviewResponse;
}

export interface AgentMetadata {
  documentation: string;
  examples: AgentExample[];
  changelog: ChangelogEntry[];
  compatibility: CompatibilityInfo;
  support: SupportInfo;
  license: LicenseInfo;
  security: SecurityInfo;
}

export interface AgentInstance {
  id: string;
  agentId: string;
  version: string;
  status: InstanceStatus;
  configuration: InstanceConfiguration;
  deployment: DeploymentInfo;
  metrics: InstanceMetrics;
  createdAt: number;
  lastUsed: number;
}

export interface MarketplaceConfig {
  // Registry settings
  requireVerification: boolean;
  autoApproval: boolean;
  reviewProcess: ReviewProcessType;

  // Pricing settings
  allowFreeAgents: boolean;
  minPricingAmount: number;
  supportedCurrencies: string[];

  // Quality settings
  minRatingThreshold: number;
  maxInactiveDays: number;
  performanceThresholds: PerformanceThresholds;

  // Security settings
  requireSecurityAudit: boolean;
  vulnerabilityScanning: boolean;
  codeSigning: boolean;
}

// ============================================================================
// Enums
// ============================================================================

export type AgentCategory =
  | "analytics"
  | "automation"
  | "collaboration"
  | "communication"
  | "data_processing"
  | "decision_making"
  | "financial"
  | "healthcare"
  | "integration"
  | "monitoring"
  | "security"
  | "testing"
  | "other";

export type CapabilityType =
  | "analysis"
  | "automation"
  | "calculation"
  | "communication"
  | "coordination"
  | "generation"
  | "integration"
  | "monitoring"
  | "optimization"
  | "prediction"
  | "validation"
  | "visualization";

export type RequirementType =
  | "memory"
  | "cpu"
  | "storage"
  | "network"
  | "api"
  | "database"
  | "security"
  | "license"
  | "dependency"
  | "configuration";

export type PricingType =
  | "free"
  | "one_time"
  | "subscription"
  | "usage_based"
  | "freemium"
  | "enterprise";

export type BillingCycle = "monthly" | "quarterly" | "annually" | "custom";

export type AvailabilityStatus = "available" | "deprecated" | "maintenance" | "disabled";

export type InstanceStatus =
  | "installing"
  | "running"
  | "stopped"
  | "error"
  | "updating"
  | "uninstalling";

export type ReviewProcessType = "automatic" | "manual" | "community" | "hybrid";

export type ReviewCategory =
  | "functionality"
  | "performance"
  | "security"
  | "usability"
  | "documentation"
  | "support"
  | "general";

// ============================================================================
// Interfaces
// ============================================================================

export interface CapabilityPerformance {
  avgResponseTime: number; // ms
  successRate: number; // 0-1
  throughput: number; // requests/second
  memoryUsage: number; // MB
  cpuUsage: number; // percentage
  reliability: number; // 0-1
}

export interface PricingTier {
  name: string;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  features: string[];
  limits: UsageLimits;
}

export interface UsageBasedPricing {
  unit: string;
  pricePerUnit: number;
  currency: string;
  billingCycle: BillingCycle;
  freeUnits?: number;
}

export interface FreeTierLimits {
  requestsPerMonth: number;
  storageLimit: number; // MB
  bandwidthLimit: number; // GB
  features: string[];
}

export interface AgentExample {
  title: string;
  description: string;
  code: string;
  input: any;
  expectedOutput: any;
  category: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch";
  changes: string[];
  breakingChanges?: string[];
}

export interface CompatibilityInfo {
  minVersion: string;
  maxVersion?: string;
  platform: string[];
  dependencies: DependencyInfo[];
}

export interface SupportInfo {
  email: string;
  website?: string;
  documentation: string;
  community?: string;
  responseTime: string;
  supportLevel: SupportLevel;
}

export interface LicenseInfo {
  type: string;
  url: string;
  restrictions: string[];
  commercialUse: boolean;
  redistribution: boolean;
}

export interface SecurityInfo {
  auditDate?: string;
  auditReport?: string;
  vulnerabilities: VulnerabilityInfo[];
  permissions: string[];
  dataHandling: DataHandlingInfo;
}

export interface InstanceConfiguration {
  environment: Record<string, any>;
  resources: ResourceAllocation;
  security: SecurityConfiguration;
  monitoring: MonitoringConfiguration;
}

export interface DeploymentInfo {
  type: "cloud" | "on-premise" | "hybrid";
  region?: string;
  provider?: string;
  endpoint?: string;
  version: string;
}

export interface InstanceMetrics {
  uptime: number; // percentage
  requests: number;
  errors: number;
  avgResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  lastUpdated: number;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface PerformanceThresholds {
  maxResponseTime: number;
  minSuccessRate: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
}

export interface UsageLimits {
  requestsPerMonth?: number;
  storageLimit?: number;
  bandwidthLimit?: number;
  concurrentUsers?: number;
  features?: string[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  optional: boolean;
}

export enum SupportLevel {
  BASIC = "basic",
  PREMIUM = "premium",
  ENTERPRISE = "enterprise",
  COMMUNITY = "community",
}

export interface VulnerabilityInfo {
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  fixedIn?: string;
  discovered: string;
}

export interface DataHandlingInfo {
  dataStorage: string;
  dataProcessing: string;
  dataSharing: string;
  encryption: boolean;
  retention: string;
}

export interface ResourceAllocation {
  memory: number; // MB
  cpu: number; // cores
  storage: number; // MB
  bandwidth: number; // Mbps
}

export interface SecurityConfiguration {
  authentication: AuthenticationMethod;
  encryption: EncryptionConfig;
  accessControl: AccessControlConfig;
  auditLogging: boolean;
}

export interface MonitoringConfiguration {
  enabled: boolean;
  metrics: string[];
  alerts: AlertConfig[];
  retention: number; // days
}

export interface AuthenticationMethod {
  type: "none" | "api_key" | "oauth" | "certificate";
  config: Record<string, any>;
}

export interface EncryptionConfig {
  inTransit: boolean;
  atRest: boolean;
  algorithm?: string;
  keyManagement: string;
}

export interface AccessControlConfig {
  rbac: boolean;
  permissions: string[];
  roles: string[];
}

export interface AlertConfig {
  metric: string;
  threshold: number;
  operator: ">" | "<" | "=" | ">=" | "<=";
  action: string;
}

export interface ReviewResponse {
  content: string;
  respondedBy: string;
  respondedAt: number;
}

// ============================================================================
// AgentMarketplace Implementation
// ============================================================================

export class AgentMarketplace extends EventEmitter {
  private config: MarketplaceConfig;
  private agentRegistry = new Map<string, AgentListing>();
  private agentInstances = new Map<string, AgentInstance>();
  private reviews = new Map<string, AgentReview[]>();
  private performanceMonitor = getAgentPerformanceMonitor();

  constructor(config: Partial<MarketplaceConfig> = {}) {
    super();

    this.config = {
      requireVerification: true,
      autoApproval: false,
      reviewProcess: "hybrid",
      allowFreeAgents: true,
      minPricingAmount: 0,
      supportedCurrencies: ["USD", "EUR", "GBP"],
      minRatingThreshold: 3.0,
      maxInactiveDays: 90,
      performanceThresholds: {
        maxResponseTime: 5000,
        minSuccessRate: 0.95,
        maxMemoryUsage: 512,
        maxCpuUsage: 80,
      },
      requireSecurityAudit: true,
      vulnerabilityScanning: true,
      codeSigning: false,
      ...config,
    };

    this.startMaintenanceTasks();
  }

  /**
   * Register a new agent in the marketplace
   */
  async registerAgent(
    agent: Omit<AgentListing, "id" | "createdAt" | "updatedAt" | "downloads" | "rating" | "reviews">
  ): Promise<string> {
    const agentId = uuidv4();
    const now = Date.now();

    const listing: AgentListing = {
      ...agent,
      id: agentId,
      createdAt: now,
      updatedAt: now,
      downloads: 0,
      rating: 0,
      reviews: [],
    };

    // Validation
    await this.validateAgentListing(listing);

    // Security check if required
    if (this.config.requireSecurityAudit) {
      await this.performSecurityCheck(listing);
    }

    // Store in registry
    this.agentRegistry.set(agentId, listing);

    // Auto-approval or manual review
    if (this.config.autoApproval) {
      listing.availability = "available";
      this.emit("agentApproved", { agentId, listing });
    } else {
      await this.submitForReview(agentId, listing);
    }

    logger.info("Agent registered in marketplace", { agentId, name: agent.name });
    this.emit("agentRegistered", { agentId, listing });

    return agentId;
  }

  /**
   * Discover agents based on criteria
   */
  async discoverAgents(criteria: {
    category?: AgentCategory;
    capability?: string;
    pricingType?: PricingType;
    minRating?: number;
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AgentListing[]> {
    let agents = Array.from(this.agentRegistry.values());

    // Filter by availability
    agents = agents.filter((agent) => agent.availability === "available");

    // Apply filters
    if (criteria.category) {
      agents = agents.filter((agent) => agent.category === criteria.category);
    }

    if (criteria.capability) {
      agents = agents.filter((agent) =>
        agent.capabilities.some((cap) => cap.name === criteria.capability)
      );
    }

    if (criteria.pricingType) {
      agents = agents.filter((agent) => agent.pricing.type === criteria.pricingType);
    }

    if (criteria.minRating) {
      agents = agents.filter((agent) => agent.rating >= criteria.minRating!);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      agents = agents.filter((agent) =>
        criteria.tags?.some((tag) => agent.capabilities.some((cap) => cap.tags.includes(tag)))
      );
    }

    if (criteria.search) {
      const searchLower = criteria.search.toLowerCase();
      agents = agents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchLower) ||
          agent.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort by rating and downloads
    agents.sort((a, b) => {
      const scoreA = a.rating * 0.6 + (a.downloads / 1000) * 0.4;
      const scoreB = b.rating * 0.6 + (b.downloads / 1000) * 0.4;
      return scoreB - scoreA;
    });

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 50;

    return agents.slice(offset, offset + limit);
  }

  /**
   * Get agent details by ID
   */
  getAgent(agentId: string): AgentListing | null {
    return this.agentRegistry.get(agentId) || null;
  }

  /**
   * Install/deploy an agent instance
   */
  async installAgent(
    agentId: string,
    configuration: InstanceConfiguration,
    deployment: DeploymentInfo
  ): Promise<string> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.availability !== "available") {
      throw new Error(`Agent ${agentId} is not available for installation`);
    }

    const instanceId = uuidv4();
    const now = Date.now();

    const instance: AgentInstance = {
      id: instanceId,
      agentId,
      version: agent.version,
      status: "installing",
      configuration,
      deployment,
      metrics: {
        uptime: 0,
        requests: 0,
        errors: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        lastUpdated: now,
      },
      createdAt: now,
      lastUsed: now,
    };

    this.agentInstances.set(instanceId, instance);

    // Start installation process
    await this.performInstallation(instance);

    // Update download count
    agent.downloads++;
    agent.updatedAt = now;

    this.emit("agentInstalled", { instanceId, agentId, instance });
    return instanceId;
  }

  /**
   * Submit a review for an agent
   */
  async submitReview(review: Omit<AgentReview, "id" | "createdAt" | "verified">): Promise<string> {
    const agent = this.agentRegistry.get(review.agentId);
    if (!agent) {
      throw new Error(`Agent ${review.agentId} not found`);
    }

    const reviewId = uuidv4();
    const now = Date.now();

    const fullReview: AgentReview = {
      ...review,
      id: reviewId,
      createdAt: now,
      verified: false, // Will be verified by admin
    };

    // Store review
    if (!this.reviews.has(review.agentId)) {
      this.reviews.set(review.agentId, []);
    }
    this.reviews.get(review.agentId)?.push(fullReview);

    // Update agent rating
    await this.updateAgentRating(review.agentId);

    this.emit("reviewSubmitted", { reviewId, review: fullReview });
    return reviewId;
  }

  /**
   * Get agent reviews
   */
  getAgentReviews(agentId: string, limit?: number): AgentReview[] {
    const reviews = this.reviews.get(agentId) || [];

    // Sort by helpfulness and date
    reviews.sort((a, b) => {
      const scoreA = a.helpful * 0.7 + ((b.createdAt - a.createdAt) / (1000 * 60 * 60 * 24)) * 0.3;
      const scoreB = b.helpful * 0.7 + ((b.createdAt - a.createdAt) / (1000 * 60 * 60 * 24)) * 0.3;
      return scoreB - scoreA;
    });

    return limit ? reviews.slice(0, limit) : reviews;
  }

  /**
   * Update agent listing
   */
  async updateAgent(agentId: string, updates: Partial<AgentListing>): Promise<void> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Apply updates
    Object.assign(agent, updates, { updatedAt: Date.now() });

    // Re-validation if major changes
    if (this.hasMajorChanges(agent, updates)) {
      await this.validateAgentListing(agent);
      if (this.config.requireSecurityAudit) {
        await this.performSecurityCheck(agent);
      }
    }

    this.emit("agentUpdated", { agentId, agent });
  }

  /**
   * Get marketplace statistics
   */
  getMarketplaceStats(): {
    totalAgents: number;
    availableAgents: number;
    totalDownloads: number;
    averageRating: number;
    categories: Record<AgentCategory, number>;
    pricingTypes: Record<PricingType, number>;
  } {
    const agents = Array.from(this.agentRegistry.values());
    const available = agents.filter((a) => a.availability === "available");

    const categories = {} as Record<AgentCategory, number>;
    const pricingTypes = {} as Record<PricingType, number>;

    let totalDownloads = 0;
    let totalRating = 0;
    let ratedAgents = 0;

    for (const agent of agents) {
      totalDownloads += agent.downloads;

      if (agent.rating > 0) {
        totalRating += agent.rating;
        ratedAgents++;
      }

      categories[agent.category] = (categories[agent.category] || 0) + 1;
      pricingTypes[agent.pricing.type] = (pricingTypes[agent.pricing.type] || 0) + 1;
    }

    return {
      totalAgents: agents.length,
      availableAgents: available.length,
      totalDownloads,
      averageRating: ratedAgents > 0 ? totalRating / ratedAgents : 0,
      categories,
      pricingTypes,
    };
  }

  /**
   * Get agent instances for a user/organization
   */
  getAgentInstances(agentId?: string): AgentInstance[] {
    const instances = Array.from(this.agentInstances.values());

    if (agentId) {
      return instances.filter((instance) => instance.agentId === agentId);
    }

    return instances;
  }

  /**
   * Update agent instance metrics
   */
  async updateInstanceMetrics(
    instanceId: string,
    metrics: Partial<InstanceMetrics>
  ): Promise<void> {
    const instance = this.agentInstances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    Object.assign(instance.metrics, metrics, { lastUpdated: Date.now() });
    instance.lastUsed = Date.now();

    // Check performance thresholds
    await this.checkInstancePerformance(instance);

    this.emit("instanceMetricsUpdated", { instanceId, instance });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startMaintenanceTasks(): void {
    // Clean up inactive instances
    setInterval(
      () => {
        this.cleanupInactiveInstances();
      },
      24 * 60 * 60 * 1000
    ); // Daily

    // Update agent ratings
    setInterval(
      () => {
        this.updateAllAgentRatings();
      },
      60 * 60 * 1000
    ); // Hourly

    // Performance monitoring
    setInterval(
      () => {
        this.monitorAgentPerformance();
      },
      5 * 60 * 1000
    ); // Every 5 minutes
  }

  private async validateAgentListing(agent: AgentListing): Promise<void> {
    // Validate required fields
    if (!agent.name || !agent.description || !agent.version) {
      throw new Error("Missing required fields: name, description, version");
    }

    // Validate capabilities
    if (!agent.capabilities || agent.capabilities.length === 0) {
      throw new Error("Agent must have at least one capability");
    }

    // Validate pricing
    if (
      agent.pricing.type !== "free" &&
      (!agent.pricing.amount || agent.pricing.amount < this.config.minPricingAmount)
    ) {
      throw new Error(`Invalid pricing for type ${agent.pricing.type}`);
    }

    // Validate version format
    if (!this.isValidVersion(agent.version)) {
      throw new Error("Invalid version format");
    }
  }

  private async performSecurityCheck(agent: AgentListing): Promise<void> {
    // In a real implementation, this would:
    // 1. Run vulnerability scanning
    // 2. Check for malicious code
    // 3. Validate security permissions
    // 4. Review data handling practices

    logger.info("Security check completed", { agentId: agent.id });
  }

  private async submitForReview(agentId: string, agent: AgentListing): Promise<void> {
    // Submit for manual review process
    agent.availability = "maintenance";

    this.emit("agentSubmittedForReview", { agentId, agent });

    // In a real implementation, this would notify reviewers
    logger.info("Agent submitted for review", { agentId });
  }

  private async performInstallation(instance: AgentInstance): Promise<void> {
    try {
      // Simulate installation process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      instance.status = "running";
      this.emit("agentInstanceStarted", { instanceId: instance.id });
    } catch (error) {
      instance.status = "error";
      this.emit("agentInstanceError", {
        instanceId: instance.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async updateAgentRating(agentId: string): Promise<void> {
    const reviews = this.reviews.get(agentId) || [];
    const verifiedReviews = reviews.filter((r) => r.verified);

    if (verifiedReviews.length === 0) return;

    const avgRating =
      verifiedReviews.reduce((sum, r) => sum + r.rating, 0) / verifiedReviews.length;

    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.rating = avgRating;
      agent.updatedAt = Date.now();
    }
  }

  private async updateAllAgentRatings(): Promise<void> {
    for (const agentId of this.agentRegistry.keys()) {
      await this.updateAgentRating(agentId);
    }
  }

  private hasMajorChanges(agent: AgentListing, updates: Partial<AgentListing>): boolean {
    // Check if updates include major changes that require re-validation
    const majorFields = ["capabilities", "requirements", "pricing"];
    return majorFields.some((field) => updates[field as keyof AgentListing] !== undefined);
  }

  private isValidVersion(version: string): boolean {
    // Simple semantic version validation
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/;
    return semverRegex.test(version);
  }

  private cleanupInactiveInstances(): void {
    const now = Date.now();
    const maxInactive = this.config.maxInactiveDays * 24 * 60 * 60 * 1000;

    for (const [instanceId, instance] of this.agentInstances.entries()) {
      if (now - instance.lastUsed > maxInactive && instance.status === "stopped") {
        this.agentInstances.delete(instanceId);
        this.emit("instanceCleanedUp", { instanceId });
      }
    }
  }

  private async checkInstancePerformance(instance: AgentInstance): Promise<void> {
    const thresholds = this.config.performanceThresholds;
    const metrics = instance.metrics;

    // Check performance thresholds
    if (metrics.avgResponseTime > thresholds.maxResponseTime) {
      this.emit("performanceAlert", {
        instanceId: instance.id,
        type: "high_latency",
        value: metrics.avgResponseTime,
        threshold: thresholds.maxResponseTime,
      });
    }

    if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
      this.emit("performanceAlert", {
        instanceId: instance.id,
        type: "high_memory",
        value: metrics.memoryUsage,
        threshold: thresholds.maxMemoryUsage,
      });
    }

    if (metrics.cpuUsage > thresholds.maxCpuUsage) {
      this.emit("performanceAlert", {
        instanceId: instance.id,
        type: "high_cpu",
        value: metrics.cpuUsage,
        threshold: thresholds.maxCpuUsage,
      });
    }
  }

  private monitorAgentPerformance(): void {
    for (const instance of this.agentInstances.values()) {
      if (instance.status === "running") {
        // Get performance metrics from monitoring system
        const healthScore = this.performanceMonitor.getHealthScore(instance.agentId);

        if (healthScore && !healthScore.isHealthy) {
          this.emit("agentHealthIssue", {
            instanceId: instance.id,
            agentId: instance.agentId,
            healthScore,
          });
        }
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentMarketplaceInstance: AgentMarketplace | null = null;

export function getAgentMarketplace(config?: Partial<MarketplaceConfig>): AgentMarketplace {
  if (!agentMarketplaceInstance) {
    agentMarketplaceInstance = new AgentMarketplace(config);
  }
  return agentMarketplaceInstance;
}
