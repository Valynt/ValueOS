import React, { ReactNode, createContext, useContext } from "react";

export interface HumanCheckpointEventPayload {
  schemaVersion: string;
  idempotencyKey: string;
  emittedAt: string;
  tenantId: string;
  sessionId: string;
  userId: string;
  actionType: string;
  actionData: Record<string, unknown>;
  requiresApproval: boolean;
  reason: string;
  checkpointIdempotencyKey?: string;
}

export interface HumanCheckpointEvent {
  name: "agent.action.checkpoint";
  payload: HumanCheckpointEventPayload;
}

export interface HumanCheckpointBroker {
  subscribe(handler: (event: HumanCheckpointEvent) => Promise<void> | void): Promise<() => void> | (() => void);
  publishCheckpointEvent(payload: HumanCheckpointEventPayload): Promise<void>;
}

export interface HumanCheckpointAuth {
  userId: string | null;
}

export interface HumanCheckpointDependencies {
  auth: HumanCheckpointAuth;
  broker: HumanCheckpointBroker;
}

const HumanCheckpointDependenciesContext = createContext<HumanCheckpointDependencies | null>(null);

interface HumanCheckpointDependenciesProviderProps {
  children: ReactNode;
  value: HumanCheckpointDependencies;
}

export function HumanCheckpointDependenciesProvider({
  children,
  value,
}: HumanCheckpointDependenciesProviderProps) {
  return (
    <HumanCheckpointDependenciesContext.Provider value={value}>
      {children}
    </HumanCheckpointDependenciesContext.Provider>
  );
}

export function useHumanCheckpointDependencies(): HumanCheckpointDependencies | null {
  return useContext(HumanCheckpointDependenciesContext);
}
