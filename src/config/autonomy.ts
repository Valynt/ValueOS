/**
 * Phase 2: Agent Autonomy and Approval Configuration
 * 
 * Defines autonomy levels, cost limits, and approval requirements for all agents.
 * Prevents unauthorized or expensive operations without human oversight.
 */

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : process.env ?? {};

const getEnv = (key: string, defaultValue: string) => (env[key] ?? defaultValue) as string;

export type AutonomyLevel = 'low' | 'medium' | 'high';

export interface AgentAutonomyConfig {
  level: AutonomyLevel;
  maxCost: number;  // USD
  maxDuration: number;  // milliseconds
  requiresApproval: {
    highCost: boolean;
    destructive: boolean;
    dataExport: boolean;
  };
}

export interface AutonomyConfig {
  // Global settings
  killSwitchEnabled: boolean;
  maxCostUsd: number;
  maxDurationMs: number;
  requireApprovalForDestructive: boolean;
  serviceIdentityToken?: string;
  
  // Agent-specific settings
  agents: Record<string, AgentAutonomyConfig>;
  
  // Global limits
  global: {
    maxTotalCostPerHour: number;
    maxConcurrentAgents: number;
    alwaysRequireApproval: string[];
  };
  
  // Legacy support
  agentAutonomyLevels?: Record<string, 'observe' | 'assist' | 'act'>;
  destructiveActions?: string[];
  agentKillSwitches?: Record<string, boolean>;
  agentMaxIterations?: Record<string, number>;
}

/**
 * Default agent autonomy configuration (Phase 2)
 */
const defaultAgentConfig: Record<string, AgentAutonomyConfig> = {
  CoordinatorAgent: {
    level: 'medium',
    maxCost: 100,        // USD
    maxDuration: 3600000,   // 1 hour
    requiresApproval: {
      highCost: true,    // > $100
      destructive: true, // DELETE operations
      dataExport: true,  // Data exports
    },
  },
  
  OpportunityAgent: {
    level: 'high',
    maxCost: 50,
    maxDuration: 1800000,   // 30 minutes
    requiresApproval: {
      highCost: true,    // > $50
      destructive: false,
      dataExport: false,
    },
  },
  
  IntegrityAgent: {
    level: 'low',
    maxCost: 10,
    maxDuration: 600000,   // 10 minutes
    requiresApproval: {
      highCost: false,
      destructive: true,
      dataExport: true,
    },
  },
  
  RiskAgent: {
    level: 'medium',
    maxCost: 25,
    maxDuration: 900000,   // 15 minutes
    requiresApproval: {
      highCost: true,
      destructive: true,
      dataExport: true,
    },
  },
  
  SystemMapperAgent: {
    level: 'medium',
    maxCost: 30,
    maxDuration: 1200000,   // 20 minutes
    requiresApproval: {
      highCost: true,
      destructive: false,
      dataExport: true,
    },
  },
};

export function getAutonomyConfig(): AutonomyConfig {
  return {
    // Global kill switch
    killSwitchEnabled: getEnv('AUTONOMY_KILL_SWITCH', 'false') === 'true',
    maxCostUsd: Number(getEnv('AUTONOMY_MAX_COST_USD', '50')),
    maxDurationMs: Number(getEnv('AUTONOMY_MAX_DURATION_MS', `${5 * 60 * 1000}`)),
    requireApprovalForDestructive: getEnv('AUTONOMY_REQUIRE_APPROVAL', 'true') === 'true',
    serviceIdentityToken: getEnv('SERVICE_IDENTITY_TOKEN', ''),
    
    // Agent-specific configuration
    agents: defaultAgentConfig,
    
    // Global limits
    global: {
      maxTotalCostPerHour: 500,  // Max $500/hour across all agents
      maxConcurrentAgents: 10,   // Max 10 agents running simultaneously
      
      // Actions that ALWAYS require approval
      alwaysRequireApproval: [
        'DELETE_USER',
        'DELETE_CASE',
        'EXPORT_ALL_DATA',
        'MODIFY_BILLING',
        'GRANT_ADMIN_ACCESS',
        'PURGE_DATABASE',
        'DISABLE_SECURITY',
      ],
    },
    
    // Legacy support (deprecated)
    agentAutonomyLevels: JSON.parse(getEnv('AGENT_AUTONOMY_LEVELS', '{}')),
    destructiveActions: getEnv('DESTRUCTIVE_ACTIONS', 'DELETE,PURGE,DROP').split(',').map((v) => v.trim()).filter(Boolean),
    agentKillSwitches: JSON.parse(getEnv('AGENT_KILL_SWITCHES', '{}')),
    agentMaxIterations: JSON.parse(getEnv('AGENT_MAX_ITERATIONS', '{}')),
  };
}

/**
 * Check if an action requires approval
 */
export function requiresApproval(
  agentName: string,
  action: string,
  estimatedCost: number,
  isDestructive: boolean,
  involvesDataExport: boolean
): boolean {
  const config = getAutonomyConfig();
  
  // Check global always-approve list
  if (config.global.alwaysRequireApproval.includes(action)) {
    return true;
  }
  
  // Get agent config
  const agentConfig = config.agents[agentName];
  if (!agentConfig) {
    // Unknown agent - require approval by default
    return true;
  }
  
  // Check agent-specific rules
  if (agentConfig.requiresApproval.destructive && isDestructive) {
    return true;
  }
  
  if (agentConfig.requiresApproval.highCost && estimatedCost > agentConfig.maxCost) {
    return true;
  }
  
  if (agentConfig.requiresApproval.dataExport && involvesDataExport) {
    return true;
  }
  
  return false;
}

/**
 * Check if dual control is required (for very high-cost or sensitive actions)
 */
export function requiresDualControl(estimatedCost: number, action: string): boolean {
  // Dual control for costs > $100
  if (estimatedCost > 100) {
    return true;
  }
  
  // Dual control for sensitive actions
  const sensitiveActions = [
    'DELETE_USER',
    'PURGE_DATABASE',
    'MODIFY_BILLING',
    'GRANT_ADMIN_ACCESS',
  ];
  
  if (sensitiveActions.includes(action)) {
    return true;
  }
  
  return false;
}

export default getAutonomyConfig;
