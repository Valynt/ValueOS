import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface HumanCheckpointUser {
  id: string;
}

export interface HumanCheckpointAuth {
  user: HumanCheckpointUser | null;
}

export interface HumanCheckpointStreamEvent {
  name: string;
  payload: Record<string, unknown>;
}

export interface HumanCheckpointBroker {
  subscribe(handler: (event: HumanCheckpointStreamEvent) => Promise<void>): Promise<() => void> | (() => void);
  publish(stream: string, data: Record<string, unknown>): Promise<void>;
}

export interface HumanCheckpointDependencies {
  auth: HumanCheckpointAuth;
  broker: HumanCheckpointBroker;
}

const HumanCheckpointDependenciesContext = createContext<HumanCheckpointDependencies | null>(null);

export interface HumanCheckpointProviderProps {
  dependencies: HumanCheckpointDependencies;
  children: React.ReactNode;
}

export function HumanCheckpointProvider({ dependencies, children }: HumanCheckpointProviderProps) {
  return (
    <HumanCheckpointDependenciesContext.Provider value={dependencies}>
      {children}
    </HumanCheckpointDependenciesContext.Provider>
  );
}

function useHumanCheckpointDependencies(
  dependencies?: HumanCheckpointDependencies
): HumanCheckpointDependencies | null {
  const contextDependencies = useContext(HumanCheckpointDependenciesContext);
  return dependencies ?? contextDependencies;
}

interface HumanCheckpointProps {
  sessionId: string;
  tenantId: string;
  onApproval: (approved: boolean, reason?: string) => void;
  onPause: () => void;
  onResume: () => void;
  dependencies?: HumanCheckpointDependencies;
}

interface CheckpointAction {
  id: string;
  actionType: string;
  actionData: Record<string, unknown>;
  requiresApproval: boolean;
  reason: string;
  timestamp: string;
}

function toCheckpointAction(payload: Record<string, unknown>): CheckpointAction | null {
  const idempotencyKey = payload.idempotencyKey;
  const actionType = payload.actionType;
  const actionData = payload.actionData;
  const requiresApproval = payload.requiresApproval;
  const reason = payload.reason;
  const emittedAt = payload.emittedAt;

  if (
    typeof idempotencyKey !== "string" ||
    typeof actionType !== "string" ||
    typeof reason !== "string" ||
    typeof emittedAt !== "string" ||
    typeof requiresApproval !== "boolean" ||
    !actionData ||
    typeof actionData !== "object"
  ) {
    return null;
  }

  return {
    id: idempotencyKey,
    actionType,
    actionData: actionData as Record<string, unknown>,
    requiresApproval,
    reason,
    timestamp: emittedAt,
  };
}

export const HumanCheckpoint: React.FC<HumanCheckpointProps> = ({
  sessionId,
  tenantId,
  onApproval,
  onPause,
  onResume,
  dependencies,
}) => {
  const [pendingActions, setPendingActions] = useState<CheckpointAction[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const resolvedDependencies = useHumanCheckpointDependencies(dependencies);

  const userId = resolvedDependencies?.auth.user?.id ?? "anonymous";
  const broker = resolvedDependencies?.broker ?? null;

  const consumerKey = useMemo(
    () => `checkpoint-${userId}-${sessionId}`,
    [sessionId, userId]
  );

  useEffect(() => {
    if (!broker) {
      return undefined;
    }

    let isActive = true;
    let unsubscribe = () => undefined;

    const subscribe = async () => {
      const stop = await broker.subscribe(async (event) => {
        if (!isActive || event.name !== "agent.action.checkpoint") {
          return;
        }

        const rawPayload = event.payload;
        const payloadSessionId = rawPayload.sessionId;
        const payloadTenantId = rawPayload.tenantId;

        if (
          typeof payloadSessionId !== "string" ||
          typeof payloadTenantId !== "string" ||
          payloadSessionId !== sessionId ||
          payloadTenantId !== tenantId
        ) {
          return;
        }

        const checkpointAction = toCheckpointAction(rawPayload);
        if (!checkpointAction || !checkpointAction.requiresApproval) {
          return;
        }

        setPendingActions((prev) => {
          if (prev.some((action) => action.id === checkpointAction.id)) {
            return prev;
          }

          return [...prev, checkpointAction];
        });
        setIsPaused(true);
        onPause();
      });

      unsubscribe = stop;
    };

    void subscribe();

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [broker, consumerKey, onPause, sessionId, tenantId]);

  const handleApproval = async (actionId: string, approved: boolean, reason?: string) => {
    if (!broker) {
      return;
    }

    const nextPendingActions = pendingActions.filter((action) => action.id !== actionId);
    setPendingActions(nextPendingActions);

    await broker.publish("agent.action.checkpoint", {
      schemaVersion: "1.0.0",
      idempotencyKey: `${actionId}:${approved ? "approved" : "rejected"}`,
      checkpointIdempotencyKey: actionId,
      emittedAt: new Date().toISOString(),
      tenantId,
      sessionId,
      userId,
      actionType: "approval_response",
      actionData: { actionId, approved, reason },
      requiresApproval: false,
      reason: approved
        ? "Action approved by user"
        : `Action rejected: ${reason || "No reason provided"}`,
    });

    onApproval(approved, reason);

    if (nextPendingActions.length === 0) {
      setIsPaused(false);
      onResume();
    }
  };

  if (!broker || pendingActions.length === 0) {
    return null;
  }

  return (
    <div className="human-checkpoint-overlay">
      <div className="checkpoint-modal">
        <h3>Agent Action Requires Approval</h3>
        {pendingActions.map((action) => (
          <div key={action.id} className="checkpoint-action">
            <div className="action-details">
              <strong>{action.actionType}</strong>
              <p>{action.reason}</p>
              <pre>{JSON.stringify(action.actionData, null, 2)}</pre>
            </div>
            <div className="action-controls">
              <button onClick={() => handleApproval(action.id, true)} className="approve-btn">
                Approve
              </button>
              <button
                onClick={() => {
                  const rejectionReason = window.prompt("Reason for rejection:");
                  void handleApproval(action.id, false, rejectionReason ?? undefined);
                }}
                className="reject-btn"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {isPaused && (
          <div className="pause-indicator">Agent execution is paused pending your approval.</div>
        )}
      </div>
    </div>
  );
};
