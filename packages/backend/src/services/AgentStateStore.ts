import type { AgentEvent, AgentState } from "./types";

import { getIoRedisClient } from "../lib/ioredisClient.js";

const redis = getIoRedisClient();

export interface AgentStateData {
  id: string;
  state: AgentState;
  history: AgentEvent[];
}

class AgentStateStore {
  async setState(id: string, state: AgentState): Promise<void> {
    await redis.set(`agent:${id}:state`, state);
  }

  async getState(id: string): Promise<AgentState> {
    const state = await redis.get(`agent:${id}:state`);
    return (state as AgentState) || "idle";
  }

  async addEvent(id: string, event: AgentEvent): Promise<void> {
    await redis.rpush(`agent:${id}:history`, JSON.stringify(event));
  }

  async getHistory(id: string): Promise<AgentEvent[]> {
    const history = await redis.lrange(`agent:${id}:history`, 0, -1);
    return history.map((h) => JSON.parse(h));
  }

  async getFullState(id: string): Promise<AgentStateData> {
    const [state, history] = await Promise.all([this.getState(id), this.getHistory(id)]);
    return { id, state, history };
  }

  async setFullState(data: AgentStateData): Promise<void> {
    const pipeline = redis.pipeline();
    pipeline.set(`agent:${data.id}:state`, data.state);
    pipeline.del(`agent:${data.id}:history`);
    data.history.forEach((event) => {
      pipeline.rpush(`agent:${data.id}:history`, JSON.stringify(event));
    });
    await pipeline.exec();
  }
}

export const agentStateStore = new AgentStateStore();
