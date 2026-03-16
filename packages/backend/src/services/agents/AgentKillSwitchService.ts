/**
 * AgentKillSwitchService
 *
 * Per-agent kill switches stored in Redis. Toggling a switch prevents
 * BaseAgent.secureInvoke from executing for that agent type.
 *
 * Key format: agent_kill_switch:<agentName>
 * Value: "1" (killed) or absent (active)
 *
 * Uses Redis so the state is shared across all backend instances and
 * survives process restarts without a DB migration.
 *
 * Fails open: if Redis is unavailable, agents are allowed to run.
 */

import { getRedisClient } from "../../lib/redis.js";
import { getAgentPolicyService } from "../policy/AgentPolicyService.js";
import { logger } from "../../lib/logger.js";

const KEY_PREFIX = "agent_kill_switch:";
const KNOWN_AGENTS = [
  "opportunity-agent",
  "target-agent",
  "financial-modeling-agent",
  "integrity-agent",
  "realization-agent",
  "expansion-agent",
  "narrative-agent",
  "compliance-auditor-agent",
] as const;

export type AgentName = (typeof KNOWN_AGENTS)[number];

export interface AgentStatus {
  name: string;
  policy_version: string;
  killed: boolean;
}

export class AgentKillSwitchService {
  private redisKey(agentName: string): string {
    return `${KEY_PREFIX}${agentName}`;
  }

  async isKilled(agentName: string): Promise<boolean> {
    try {
      const redis = await getRedisClient();
      if (!redis) return false;
      const val = await redis.get(this.redisKey(agentName));
      return val === "1";
    } catch (err) {
      // Fail open — Redis unavailable should not block agent execution.
      logger.warn("AgentKillSwitchService: Redis unavailable, defaulting to active", {
        agentName,
        err,
      });
      return false;
    }
  }

  async setKilled(agentName: string, killed: boolean): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) {
      throw new Error("Redis unavailable — cannot update kill switch");
    }
    if (killed) {
      await redis.set(this.redisKey(agentName), "1");
      logger.info("AgentKillSwitchService: agent killed", { agentName });
    } else {
      await redis.del(this.redisKey(agentName));
      logger.info("AgentKillSwitchService: agent re-enabled", { agentName });
    }
  }

  async listAll(): Promise<AgentStatus[]> {
    const policyService = getAgentPolicyService();
    return Promise.all(
      KNOWN_AGENTS.map(async (name) => {
        let policy_version = "unknown";
        try {
          policy_version = policyService.getPolicy(name).version;
        } catch {
          // Policy may not exist for every agent name variant — use fallback.
        }
        const killed = await this.isKilled(name);
        return { name, policy_version, killed };
      }),
    );
  }
}

export const agentKillSwitchService = new AgentKillSwitchService();
