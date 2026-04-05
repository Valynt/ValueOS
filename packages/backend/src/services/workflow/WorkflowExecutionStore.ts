import type { AgentEvent, AgentState } from "../../types/agent";
import { getIoRedisClient } from "../../lib/ioredisClient.js";

const redis = getIoRedisClient();

class WorkflowExecutionStore {
  async persistTransition(
    id: string,
    fromState: AgentState,
    event: string,
    data?: unknown
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const transitionEvent: AgentEvent = {
        type: "state_change",
        timestamp: new Date().toISOString(),
        data: { fromState, toState: event, transitionData: data },
      };

      // Use Redis transaction for atomic state update
      const pipeline = redis.pipeline();
      pipeline.set(`agent:${id}:state`, event);
      pipeline.rpush(`agent:${id}:events`, JSON.stringify(transitionEvent));

      await pipeline.exec();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async calculateNewState(
    id: string,
    currentState: string,
    event: string
  ): Promise<string> {
    // Implement your state transition logic here
    return event === "RESET" ? "idle" : currentState;
  }

  async setStatus(id: string, status: string): Promise<void> {
    await redis.set(`workflow:${id}:status`, status);
  }

  async getStatus(id: string): Promise<string> {
    const status = await redis.get(`workflow:${id}:status`);
    return status || "RUNNING";
  }

  async addEvent(id: string, event: unknown): Promise<void> {
    const history = await this.getHistory(id);
    history.push(event);
    await redis.set(`workflow:${id}:history`, JSON.stringify(history));
  }

  async getHistory(id: string): Promise<AgentEvent[]> {
    const history = await redis.get(`workflow:${id}:history`);
    return history ? JSON.parse(history) : [];
  }

  async resetState(id: string): Promise<void> {
    await redis.del(`workflow:${id}:status`);
    await redis.del(`workflow:${id}:history`);
  }

  // NEW: Get current agent state
  async getState(id: string): Promise<AgentState> {
    const state = await redis.get(`agent:${id}:state`);
    return (state as AgentState) || "idle";
  }

  // NEW: Set agent state
  async setState(id: string, state: AgentState): Promise<void> {
    await redis.set(`agent:${id}:state`, state);
  }

  // NEW: Get agent events history
  async getAgentEvents(id: string): Promise<AgentEvent[]> {
    const events = await redis.lrange(`agent:${id}:events`, 0, -1);
    return events.map((event) => JSON.parse(event));
  }

  // NEW: Load full agent state snapshot
  async loadAgentState(id: string): Promise<{ state: AgentState; events: AgentEvent[] }> {
    const [state, events] = await Promise.all([this.getState(id), this.getAgentEvents(id)]);
    return { state, events };
  }
}

export const workflowExecutionStore = new WorkflowExecutionStore();
