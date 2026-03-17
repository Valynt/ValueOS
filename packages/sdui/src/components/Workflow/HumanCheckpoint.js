import { useEffect, useMemo, useState } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

import { useHumanCheckpointDependencies } from "./HumanCheckpointDependencies";

export const HumanCheckpoint = ({ sessionId, tenantId, onApproval, onPause, onResume, auth: authProp, broker: brokerProp, }) => {
    const [pendingActions, setPendingActions] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const dependencies = useHumanCheckpointDependencies();
    const auth = useMemo(() => {
        return authProp ?? dependencies?.auth ?? null;
    }, [authProp, dependencies?.auth]);
    const broker = useMemo(() => {
        return brokerProp ?? dependencies?.broker ?? null;
    }, [brokerProp, dependencies?.broker]);
    useEffect(() => {
        if (!broker) {
            return;
        }
        let isMounted = true;
        let unsubscribe;
        const subscribeToCheckpointEvents = async () => {
            const nextUnsubscribe = await broker.subscribe(async (event) => {
                if (event.name !== "agent.action.checkpoint") {
                    return;
                }
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
    const handleApproval = async (actionId, approved, reason) => {
        if (!broker) {
            return;
        }
        const nextPendingActions = pendingActions.filter((action) => action.id !== actionId);
        const shouldResume = nextPendingActions.length === 0;
        setPendingActions(nextPendingActions);
        await broker.publishCheckpointEvent({
            schemaVersion: "1.0.0",
            idempotencyKey: `${actionId}:${approved ? "approved" : "rejected"}`,
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
    return (_jsx("div", { className: "human-checkpoint-overlay", children: _jsxs("div", { className: "checkpoint-modal", children: [_jsx("h3", { children: "Agent Action Requires Approval" }), pendingActions.map((action) => (_jsxs("div", { className: "checkpoint-action", children: [_jsxs("div", { className: "action-details", children: [_jsx("strong", { children: action.actionType }), _jsx("p", { children: action.reason }), _jsx("pre", { children: JSON.stringify(action.actionData, null, 2) })] }), _jsxs("div", { className: "action-controls", children: [_jsx("button", { onClick: () => handleApproval(action.id, true), className: "approve-btn", children: "Approve" }), _jsx("button", { onClick: () => {
                                        const rejectionReason = prompt("Reason for rejection:");
                                        void handleApproval(action.id, false, rejectionReason || undefined);
                                    }, className: "reject-btn", children: "Reject" })] })] }, action.id))), isPaused && (_jsx("div", { className: "pause-indicator", children: "Agent execution is paused pending your approval." }))] }) }));
};
