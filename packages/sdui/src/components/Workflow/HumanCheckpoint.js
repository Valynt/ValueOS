import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { RedisStreamBroker } from "../../../app/src/services/messaging/RedisStreamBroker";
import { useAuth } from "../../../app/src/app/providers/AuthProvider";
import { v4 as uuidv4 } from "uuid";
export const HumanCheckpoint = ({ sessionId, tenantId, onApproval, onPause, onResume, }) => {
    const [pendingActions, setPendingActions] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const [broker, setBroker] = useState(null);
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
                    if (payload.sessionId === sessionId &&
                        payload.tenantId === tenantId &&
                        payload.requiresApproval) {
                        const checkpointAction = {
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
    const handleApproval = async (actionId, approved, reason) => {
        if (!broker)
            return;
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
    return (_jsx("div", { className: "human-checkpoint-overlay", children: _jsxs("div", { className: "checkpoint-modal", children: [_jsx("h3", { children: "Agent Action Requires Approval" }), pendingActions.map((action) => (_jsxs("div", { className: "checkpoint-action", children: [_jsxs("div", { className: "action-details", children: [_jsx("strong", { children: action.actionType }), _jsx("p", { children: action.reason }), _jsx("pre", { children: JSON.stringify(action.actionData, null, 2) })] }), _jsxs("div", { className: "action-controls", children: [_jsx("button", { onClick: () => handleApproval(action.id, true), className: "approve-btn", children: "Approve" }), _jsx("button", { onClick: () => {
                                        const reason = prompt("Reason for rejection:");
                                        handleApproval(action.id, false, reason || undefined);
                                    }, className: "reject-btn", children: "Reject" })] })] }, action.id))), isPaused && (_jsx("div", { className: "pause-indicator", children: "Agent execution is paused pending your approval." }))] }) }));
};
//# sourceMappingURL=HumanCheckpoint.js.map