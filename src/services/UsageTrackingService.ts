/**
 * Usage Tracking Service
 * 
 * Tracks tenant resource usage for billing and limit enforcement.
 * Provides real-time usage monitoring and reporting.
 */

import { logger } from '../lib/logger';
import { getConfig } from '../config/environment';
import { TenantUsage, TenantLimits, isWithinLimits } from './TenantProvisioning';

/**
 * Usage event type
 */
export type UsageEventType =
  | 'user_added'
  | 'user_removed'
  | 'team_created'
  | 'team_deleted'
  | 'project_created'
  | 'project_deleted'
  | 'storage_added'
  | 'storage_removed'
  | 'api_call'
  | 'agent_call';

/**
 * Usage event
 */
export interface UsageEvent {
  organizationId: string;
  type: UsageEventType;
  amount: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Usage summary
 */
export interface UsageSummary {
  organizationId: string;
  period: string;
  current: TenantUsage;
  limits: TenantLimits;
  percentages: {
    users: number;
    teams: number;
    projects: number;
    storage: number;
    apiCalls: number;
    agentCalls: number;
  };
  warnings: string[];
  exceeded: string[];
}

/**
 * In-memory usage cache
 */
const usageCache = new Map<string, TenantUsage>();

/**
 * Track a usage event
 */
export async function trackUsage(event: UsageEvent): Promise<void> {
  const config = getConfig();

  if (!config.features.usageTracking) {
    return;
  }

  const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM
  const cacheKey = `${event.organizationId}:${currentPeriod}`;

  // Get current usage
  let usage = usageCache.get(cacheKey);
  if (!usage) {
    usage = await getUsage(event.organizationId, currentPeriod);
    usageCache.set(cacheKey, usage);
  }

  // Update usage based on event type
  switch (event.type) {
    case 'user_added':
      usage.users += event.amount;
      break;
    case 'user_removed':
      usage.users = Math.max(0, usage.users - event.amount);
      break;
    case 'team_created':
      usage.teams += event.amount;
      break;
    case 'team_deleted':
      usage.teams = Math.max(0, usage.teams - event.amount);
      break;
    case 'project_created':
      usage.projects += event.amount;
      break;
    case 'project_deleted':
      usage.projects = Math.max(0, usage.projects - event.amount);
      break;
    case 'storage_added':
      usage.storage += event.amount;
      break;
    case 'storage_removed':
      usage.storage = Math.max(0, usage.storage - event.amount);
      break;
    case 'api_call':
      usage.apiCalls += event.amount;
      break;
    case 'agent_call':
      usage.agentCalls += event.amount;
      break;
  }

  usage.lastUpdated = new Date();

  // Update cache
  usageCache.set(cacheKey, usage);

  // Persist to database (async, non-blocking)
  persistUsage(usage).catch((error) => {
    logger.error('Failed to persist usage', error instanceof Error ? error : undefined);
  });

  // Log event
  logger.debug('Usage tracked: ${event.type} for ${event.organizationId} (${event.amount})');
}

/**
 * Get current usage for organization
 */
export async function getUsage(
  organizationId: string,
  period?: string
): Promise<TenantUsage> {
  const currentPeriod = period || new Date().toISOString().substring(0, 7);
  const cacheKey = `${organizationId}:${currentPeriod}`;

  // Check cache first
  const cached = usageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // TODO: Fetch from database
  // const result = await supabase
  //   .from('tenant_usage')
  //   .select('*')
  //   .eq('organization_id', organizationId)
  //   .eq('period', currentPeriod)
  //   .single();

  // For now, return default
  const usage: TenantUsage = {
    organizationId,
    period: currentPeriod,
    users: 0,
    teams: 0,
    projects: 0,
    storage: 0,
    apiCalls: 0,
    agentCalls: 0,
    lastUpdated: new Date(),
  };

  usageCache.set(cacheKey, usage);
  return usage;
}

/**
 * Get usage summary with limits
 */
export async function getUsageSummary(
  organizationId: string,
  limits: TenantLimits
): Promise<UsageSummary> {
  const currentPeriod = new Date().toISOString().substring(0, 7);
  const usage = await getUsage(organizationId, currentPeriod);

  // Calculate percentages
  const percentages = {
    users: limits.maxUsers === -1 ? 0 : (usage.users / limits.maxUsers) * 100,
    teams: limits.maxTeams === -1 ? 0 : (usage.teams / limits.maxTeams) * 100,
    projects: limits.maxProjects === -1 ? 0 : (usage.projects / limits.maxProjects) * 100,
    storage: limits.maxStorage === -1 ? 0 : (usage.storage / limits.maxStorage) * 100,
    apiCalls: limits.maxApiCalls === -1 ? 0 : (usage.apiCalls / limits.maxApiCalls) * 100,
    agentCalls: limits.maxAgentCalls === -1 ? 0 : (usage.agentCalls / limits.maxAgentCalls) * 100,
  };

  // Generate warnings
  const warnings: string[] = [];
  const warningThreshold = 80; // 80% of limit

  if (percentages.users >= warningThreshold) {
    warnings.push(`User limit at ${percentages.users.toFixed(0)}%`);
  }
  if (percentages.teams >= warningThreshold) {
    warnings.push(`Team limit at ${percentages.teams.toFixed(0)}%`);
  }
  if (percentages.projects >= warningThreshold) {
    warnings.push(`Project limit at ${percentages.projects.toFixed(0)}%`);
  }
  if (percentages.storage >= warningThreshold) {
    warnings.push(`Storage limit at ${percentages.storage.toFixed(0)}%`);
  }
  if (percentages.apiCalls >= warningThreshold) {
    warnings.push(`API call limit at ${percentages.apiCalls.toFixed(0)}%`);
  }
  if (percentages.agentCalls >= warningThreshold) {
    warnings.push(`Agent call limit at ${percentages.agentCalls.toFixed(0)}%`);
  }

  // Check for exceeded limits
  const { exceeded } = isWithinLimits(usage, limits);

  return {
    organizationId,
    period: currentPeriod,
    current: usage,
    limits,
    percentages,
    warnings,
    exceeded,
  };
}

/**
 * Check if organization can perform action
 */
export async function canPerformAction(
  organizationId: string,
  action: UsageEventType,
  limits: TenantLimits
): Promise<{ allowed: boolean; reason?: string }> {
  const usage = await getUsage(organizationId);

  switch (action) {
    case 'user_added':
      if (limits.maxUsers !== -1 && usage.users >= limits.maxUsers) {
        return { allowed: false, reason: 'User limit reached' };
      }
      break;
    case 'team_created':
      if (limits.maxTeams !== -1 && usage.teams >= limits.maxTeams) {
        return { allowed: false, reason: 'Team limit reached' };
      }
      break;
    case 'project_created':
      if (limits.maxProjects !== -1 && usage.projects >= limits.maxProjects) {
        return { allowed: false, reason: 'Project limit reached' };
      }
      break;
    case 'api_call':
      if (limits.maxApiCalls !== -1 && usage.apiCalls >= limits.maxApiCalls) {
        return { allowed: false, reason: 'API call limit reached for this period' };
      }
      break;
    case 'agent_call':
      if (limits.maxAgentCalls !== -1 && usage.agentCalls >= limits.maxAgentCalls) {
        return { allowed: false, reason: 'Agent call limit reached for this period' };
      }
      break;
  }

  return { allowed: true };
}

/**
 * Persist usage to database
 */
async function persistUsage(usage: TenantUsage): Promise<void> {
  // TODO: Implement database upsert
  // await supabase
  //   .from('tenant_usage')
  //   .upsert({
  //     organization_id: usage.organizationId,
  //     period: usage.period,
  //     users: usage.users,
  //     teams: usage.teams,
  //     projects: usage.projects,
  //     storage: usage.storage,
  //     api_calls: usage.apiCalls,
  //     agent_calls: usage.agentCalls,
  //     last_updated: usage.lastUpdated.toISOString(),
  //   });

  logger.debug('Usage persisted for ${usage.organizationId}');
}

/**
 * Reset usage for new period
 */
export async function resetUsageForNewPeriod(
  organizationId: string
): Promise<void> {
  const newPeriod = new Date().toISOString().substring(0, 7);
  const cacheKey = `${organizationId}:${newPeriod}`;

  // Get current usage to carry over non-resetting metrics
  const oldUsage = await getUsage(organizationId);

  const newUsage: TenantUsage = {
    organizationId,
    period: newPeriod,
    users: oldUsage.users, // Carry over
    teams: oldUsage.teams, // Carry over
    projects: oldUsage.projects, // Carry over
    storage: oldUsage.storage, // Carry over
    apiCalls: 0, // Reset
    agentCalls: 0, // Reset
    lastUpdated: new Date(),
  };

  usageCache.set(cacheKey, newUsage);
  await persistUsage(newUsage);

  logger.debug('Usage reset for new period: ${newPeriod}');
}

/**
 * Get usage history
 */
export async function getUsageHistory(
  organizationId: string,
  months: number = 12
): Promise<TenantUsage[]> {
  // TODO: Implement database query
  // const result = await supabase
  //   .from('tenant_usage')
  //   .select('*')
  //   .eq('organization_id', organizationId)
  //   .order('period', { ascending: false })
  //   .limit(months);

  // For now, return empty array
  return [];
}

/**
 * Clear usage cache
 */
export function clearUsageCache(organizationId?: string): void {
  if (organizationId) {
    // Clear specific organization
    for (const key of usageCache.keys()) {
      if (key.startsWith(organizationId)) {
        usageCache.delete(key);
      }
    }
  } else {
    // Clear all
    usageCache.clear();
  }
}

/**
 * React hook for usage tracking
 */
export function useUsageTracking(organizationId: string, limits: TenantLimits) {
  const [summary, setSummary] = React.useState<UsageSummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function loadUsage() {
      try {
        const usageSummary = await getUsageSummary(organizationId, limits);
        if (mounted) {
          setSummary(usageSummary);
          setLoading(false);
        }
      } catch (error) {
        logger.error('Failed to load usage', error instanceof Error ? error : undefined);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUsage();

    // Refresh every minute
    const interval = setInterval(loadUsage, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [organizationId, limits]);

  const track = React.useCallback(async (event: Omit<UsageEvent, 'organizationId' | 'timestamp'>) => {
    await trackUsage({
      ...event,
      organizationId,
      timestamp: new Date(),
    });

    // Refresh summary
    const newSummary = await getUsageSummary(organizationId, limits);
    setSummary(newSummary);
  }, [organizationId, limits]);

  return {
    summary,
    loading,
    track,
  };
}

// Import React for the hook
import React from 'react';
