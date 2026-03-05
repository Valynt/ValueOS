import React, { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import {
  HumanCheckpointAuth,
  HumanCheckpointBroker,
  useHumanCheckpointDependencies,
} from "./HumanCheckpointDependencies";

interface HumanCheckpointProps {
  sessionId: string;
  tenantId: string;
  onApproval: (approved: boolean, reason?: string) => void;
  onPause: () => void;
  onResume: () => void;
  auth?: HumanCheckpointAuth;
  broker?: HumanCheckpointBroker;
}

interface CheckpointAction {
  id: string;
  actionType: string;
  actionData: Record<string, unknown>;
  requiresApproval: boolean;
  reason: string;
  timestamp: string;
}

export const HumanCheckpoint: React.FC<HumanCheckpointProps> = ({
  sessionId,
  tenantId,
  onApproval,
  onPause,
  onResume,
  auth: authProp,
  broker: brokerProp,
}) => {
  const [pendingActions, setPendingActions] = useState<CheckpointAction[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const dependencies = useHumanCheckpointDependencies();

  const auth = useMemo<HumanCheckpointAuth | null>(() => {
    return authProp ?? dependencies?.auth ?? null;
  }, [authProp, dependencies?.auth]);

  const broker = useMemo<HumanCheckpointBroker | null>(() => {
    return brokerProp ?? dependencies?.broker ?? null;
  }, [brokerProp, dependencies?.broker]);

  useEffect(() => {
    if (!broker) {
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const subscribeToCheckpointEvents = async () => {
      const nextUnsubscribe = await broker.subscribe(async (event) => {
        if (event.name !== "agent.action.checkpoint") {
          return;
        }

        const payload = event.payload;
        if (
          payload.sessionId === sessionId &&
          payload.tenantId === tenantId &&
          payload.requiresApproval
        ) {
          const checkpointAction: CheckpointAction = {
            id: payload.idempotencyKey,
            actionType: payload.actionType,
            actionData: payload.actionData,
            requiresApproval: payload.requiresApproval,
            reason: payload.reason,
            timestamp: payload.emittedAt,
          };

          setPendingActions((prev) => {
            if (prev.some((action) => action.id === checkpointAction.id)) {
              return prev;
            }
            return [...prev, checkpointAction];
          });
          setIsPaused(true);
          onPause();
        }
      });

      if (!isMounted) {
        nextUnsubscribe();
        return;
      }

      unsubscribe = nextUnsubscribe;
    };

    void subscribeToCheckpointEvents();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [broker, onPause, sessionId, tenantId]);

  const handleApproval = async (
    actionId: string,
    approved: boolean,
    reason?: string,
  ) => {
    if (!broker) {
      return;
    }

    const nextPendingActions = pendingActions.filter((action) => action.id !== actionId);
    const shouldResume = nextPendingActions.length === 0;
    setPendingActions(nextPendingActions);

    await broker.publishCheckpointEvent({
      schemaVersion: "1.0.0",
      idempotencyKey: uuidv4(),
      checkpointIdempotencyKey: actionId,
      emittedAt: new Date().toISOString(),
      tenantId,
      sessionId,
      userId: auth?.userId ?? "anonymous",
      actionType: "approval_response",
      actionData: { actionId, approved, reason },
      requiresApproval: false,
      reason: approved
        ? "Action approved by user"
        : `Action rejected: ${reason || "No reason provided"}`,
    });

    onApproval(approved, reason);

    if (shouldResume) {
      setIsPaused(false);
      onResume();
    }
  };

  if (pendingActions.length === 0) {
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
                  const rejectionReason = prompt("Reason for rejection:");
                  void handleApproval(action.id, false, rejectionReason || undefined);
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
