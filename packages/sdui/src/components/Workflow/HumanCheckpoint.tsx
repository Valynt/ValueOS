import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

// TODO: RedisStreamBroker and useAuth were imported via broken cross-package
// paths (../../../app/src/...).  These should be injected via props or context
// rather than imported directly from the app layer.  Stubbed here so the
// backend production build (esbuild) can compile the sdui package.
interface StreamEvent {
  name: string;
  payload: Record<string, any>;
}
interface RedisStreamBroker {
  initialize(): Promise<void>;
  startConsumer(handler: (event: StreamEvent) => Promise<void>): void;
  publish(stream: string, data: Record<string, any>): Promise<void>;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RedisStreamBroker = class implements RedisStreamBroker {
  constructor(_opts: { streamName: string; consumerName: string }) { }
  async initialize() { }
  startConsumer(_handler: (event: StreamEvent) => Promise<void>) { }
  async publish(_stream: string, _data: Record<string, any>) { }
};
function useAuth(): { user: { id: string } | null } {
  return { user: null };
}

interface HumanCheckpointProps {
  sessionId: string;
  tenantId: string;
  onApproval: (approved: boolean, reason?: string) => void;
  onPause: () => void;
  onResume: () => void;
}

interface CheckpointAction {
  id: string;
  actionType: string;
  actionData: Record<string, any>;
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
}) => {
  const [pendingActions, setPendingActions] = useState<CheckpointAction[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [broker, setBroker] = useState<RedisStreamBroker | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const initializeBroker = async () => {
      const streamBroker = new RedisStreamBroker({
        streamName: "agent.checkpoints",
        consumerName: `checkpoint-${user?.id || "anonymous"}-${sessionId}`,
      });
      await streamBroker.initialize();
      setBroker(streamBroker);

      // Listen for checkpoint events
      streamBroker.startConsumer(async (event) => {
        if (event.name === "agent.action.checkpoint") {
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
            setPendingActions((prev) => [...prev, checkpointAction]);
            setIsPaused(true);
            onPause();
          }
        }
      });
    };

    initializeBroker();

    return () => {
      // Cleanup
    };
  }, [sessionId, tenantId, user?.id, onPause]);

  const handleApproval = async (actionId: string, approved: boolean, reason?: string) => {
    if (!broker) return;

    // Remove from pending actions
    setPendingActions((prev) => prev.filter((action) => action.id !== actionId));

    // Publish approval decision
    await broker.publish("agent.action.checkpoint", {
      schemaVersion: "1.0.0",
      idempotencyKey: uuidv4(),
      emittedAt: new Date().toISOString(),
      tenantId,
      sessionId,
      userId: user?.id || "anonymous",
      actionType: "approval_response",
      actionData: { actionId, approved, reason },
      requiresApproval: false,
      reason: approved
        ? "Action approved by user"
        : `Action rejected: ${reason || "No reason provided"}`,
    });

    onApproval(approved, reason);

    // If no more pending actions, resume
    if (pendingActions.length <= 1) {
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
                  const reason = prompt("Reason for rejection:");
                  handleApproval(action.id, false, reason || undefined);
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
